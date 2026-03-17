import type Database from "better-sqlite3";
import { EmpireManager } from "../entities/EmpireManager.js";
import { ShipManager } from "../entities/ShipManager.js";
import { EconomySystem } from "./EconomySystem.js";
import { ResearchSystem } from "./ResearchSystem.js";
import { CombatSystem } from "./CombatSystem.js";
import type { Empire, AIState, Ship, SystemId } from "../../shared/types/index.js";
import { CONFIG } from "../../shared/config.js";

interface HyperlaneRow {
  system_a: string;
  system_b: string;
  distance: number;
}

export class AISystem {
  private empireManager: EmpireManager;
  private shipManager: ShipManager;
  private economySystem: EconomySystem;
  private researchSystem: ResearchSystem;
  private combatSystem: CombatSystem;

  constructor(private db: Database.Database) {
    this.empireManager = new EmpireManager(db);
    this.shipManager = new ShipManager(db);
    this.economySystem = new EconomySystem(db);
    this.researchSystem = new ResearchSystem(db);
    this.combatSystem = new CombatSystem(db);
  }

  processTick(): void {
    const empires = this.empireManager.getAllEmpires();

    for (const empire of empires) {
      if (empire.isPlayer) continue;
      if (!empire.aiState) continue;

      // Evaluate state transitions
      const newState = this.evaluateStateTransition(empire);
      if (newState !== empire.aiState) {
        this.empireManager.setAIState(empire.id, newState);
        empire.aiState = newState;
      }

      // Execute current state behavior
      switch (empire.aiState) {
        case "explore":
          this.executeExplore(empire);
          break;
        case "expand":
          this.executeExpand(empire);
          break;
        case "develop":
          this.executeDevelop(empire);
          break;
        case "attack":
          this.executeAttack(empire);
          break;
      }

      // Always manage research
      this.manageResearch(empire);
    }
  }

  private evaluateStateTransition(empire: Empire): AIState {
    const militaryPower = this.combatSystem.getMilitaryPower(empire.id);
    const exploredSystems = this.empireManager.getExploredSystems(empire.id);
    const scienceShips = this.shipManager.getShipsByOwnerAndClass(empire.id, "science");
    const constructorShips = this.shipManager.getShipsByOwnerAndClass(empire.id, "constructor");

    // Count owned starbases
    const starbases = this.db
      .prepare("SELECT COUNT(*) as c FROM starbases WHERE owner_id = ?")
      .get(empire.id) as { c: number };

    // Count colonized planets
    const colonies = this.db
      .prepare("SELECT COUNT(*) as c FROM planets WHERE owner_id = ? AND is_colonized = 1")
      .get(empire.id) as { c: number };

    // Check if should attack: compare military power to player
    const playerEmpire = this.empireManager.getPlayerEmpire();
    if (playerEmpire) {
      const playerPower = this.combatSystem.getMilitaryPower(playerEmpire.id);
      if (
        militaryPower > playerPower * CONFIG.ai.attackMilitaryAdvantage &&
        militaryPower > 0
      ) {
        return "attack";
      }
    }

    // Explore if we have few explored systems or idle science ships
    const idleScienceShips = scienceShips.filter((s) => !s.targetSystemId);
    if (exploredSystems.length < 10 && idleScienceShips.length > 0) {
      return "explore";
    }

    // Expand if we have resources and constructors
    if (
      constructorShips.length > 0 &&
      empire.resources.energy >= CONFIG.ai.expandMinEnergy &&
      empire.resources.minerals >= CONFIG.starbase.buildCost.minerals &&
      starbases.c < exploredSystems.length * 0.5
    ) {
      return "expand";
    }

    // Develop otherwise (build economy, build ships)
    return "develop";
  }

  private executeExplore(empire: Empire): void {
    const scienceShips = this.shipManager.getShipsByOwnerAndClass(empire.id, "science");
    const exploredSystems = new Set(this.empireManager.getExploredSystems(empire.id));

    for (const ship of scienceShips) {
      if (ship.targetSystemId) continue; // Already moving

      // Find adjacent unexplored system
      const target = this.findUnexploredNeighbor(ship.systemId, exploredSystems);
      if (target) {
        this.shipManager.moveShip(ship.id, target);
      }
    }
  }

  private executeExpand(empire: Empire): void {
    const constructors = this.shipManager.getShipsByOwnerAndClass(empire.id, "constructor");
    const exploredSystems = new Set(this.empireManager.getExploredSystems(empire.id));

    for (const ship of constructors) {
      if (ship.targetSystemId) continue;

      // Check if current system has no starbase and is explored
      const hasStarbase = this.db
        .prepare("SELECT 1 FROM starbases WHERE system_id = ?")
        .get(ship.systemId);

      if (!hasStarbase && exploredSystems.has(ship.systemId)) {
        // Build starbase here if we can afford it
        if (
          empire.resources.energy >= CONFIG.starbase.buildCost.energy &&
          empire.resources.minerals >= CONFIG.starbase.buildCost.minerals
        ) {
          this.db
            .prepare("INSERT INTO starbases (id, system_id, owner_id, level) VALUES (?, ?, ?, 1)")
            .run(`starbase-${ship.systemId}`, ship.systemId, empire.id);

          this.empireManager.updateResources(empire.id, {
            energy: -CONFIG.starbase.buildCost.energy,
            minerals: -CONFIG.starbase.buildCost.minerals,
          });

          this.shipManager.destroyShip(ship.id);
          continue;
        }
      }

      // Move to an explored system without a starbase
      const target = this.findSystemWithoutStarbase(ship.systemId, exploredSystems);
      if (target) {
        this.shipManager.moveShip(ship.id, target);
      }
    }
  }

  private executeDevelop(empire: Empire): void {
    // Build ships if we have resources
    const ownedStarbases = this.db
      .prepare("SELECT system_id FROM starbases WHERE owner_id = ?")
      .all(empire.id) as Array<{ system_id: string }>;

    if (ownedStarbases.length === 0) return;
    const homeSystem = ownedStarbases[0].system_id;

    // Priority: constructor if none, science if none, then military
    const constructors = this.shipManager.getShipsByOwnerAndClass(empire.id, "constructor");
    const scienceShips = this.shipManager.getShipsByOwnerAndClass(empire.id, "science");
    const militaryShips = this.shipManager.getShipsByOwnerAndClass(empire.id, "military");

    if (constructors.length === 0) {
      this.tryBuildShip(empire, homeSystem, "constructor");
    } else if (scienceShips.length === 0) {
      this.tryBuildShip(empire, homeSystem, "science");
    } else if (militaryShips.length < 3) {
      this.tryBuildShip(empire, homeSystem, "military");
    }

    // Colonize nearby planets
    this.tryColonize(empire);
  }

  private executeAttack(empire: Empire): void {
    const militaryShips = this.shipManager.getShipsByOwnerAndClass(empire.id, "military");
    const playerEmpire = this.empireManager.getPlayerEmpire();

    if (!playerEmpire) return;

    // Find player's home system or nearest starbase
    const playerStarbases = this.db
      .prepare("SELECT system_id FROM starbases WHERE owner_id = ?")
      .all(playerEmpire.id) as Array<{ system_id: string }>;

    if (playerStarbases.length === 0) return;

    const targetSystem = playerStarbases[0].system_id;

    // Send idle military ships toward player territory
    for (const ship of militaryShips) {
      if (ship.targetSystemId) continue;
      if (ship.systemId === targetSystem) continue;

      // Find next system on path toward target
      const nextHop = this.findNextHop(ship.systemId, targetSystem);
      if (nextHop) {
        this.shipManager.moveShip(ship.id, nextHop);
      }
    }
  }

  private manageResearch(empire: Empire): void {
    const state = this.researchSystem.getResearchState(empire.id);
    if (state.currentTech) return; // Already researching

    const choices = this.researchSystem.getAvailableChoices(empire.id);
    if (choices.length > 0) {
      // Pick the cheapest available tech
      const cheapest = choices.reduce((a, b) => (a.cost < b.cost ? a : b));
      this.researchSystem.startResearch(empire.id, cheapest.id);
    }
  }

  private tryBuildShip(
    empire: Empire,
    systemId: string,
    shipClass: "science" | "constructor" | "military" | "colony"
  ): void {
    const cost = CONFIG.ships[shipClass].cost;
    if (
      empire.resources.energy >= cost.energy &&
      empire.resources.minerals >= cost.minerals &&
      empire.resources.alloys >= cost.alloys
    ) {
      this.economySystem.buildShip(empire.id, systemId, shipClass);
    }
  }

  private tryColonize(empire: Empire): void {
    const colonyShips = this.shipManager.getShipsByOwnerAndClass(empire.id, "colony");

    for (const ship of colonyShips) {
      if (ship.targetSystemId) continue;

      // Find colonizable planet in current system
      const planet = this.db
        .prepare(
          `SELECT id FROM planets
           WHERE system_id = ? AND is_colonized = 0
           AND planet_type NOT IN ('gas_giant', 'barren')
           LIMIT 1`
        )
        .get(ship.systemId) as { id: string } | undefined;

      if (planet) {
        // Colonize with a default role based on what's needed
        const role = this.chooseColonyRole(empire);
        this.economySystem.colonizePlanet(empire.id, planet.id, role, ship.id);
      }
    }
  }

  private chooseColonyRole(empire: Empire): "mining" | "generator" | "science" | "forge" {
    if (empire.resources.energy < 30) return "generator";
    if (empire.resources.minerals < 50) return "mining";
    if (empire.resources.alloys < 20) return "forge";
    return "science";
  }

  private findUnexploredNeighbor(
    fromSystem: SystemId,
    explored: Set<SystemId>
  ): SystemId | null {
    const neighbors = this.getNeighbors(fromSystem);
    for (const n of neighbors) {
      if (!explored.has(n)) return n;
    }
    // If all neighbors explored, find an unexplored system reachable via explored path
    for (const n of neighbors) {
      const secondNeighbors = this.getNeighbors(n);
      for (const sn of secondNeighbors) {
        if (!explored.has(sn)) return n; // Move toward it
      }
    }
    return null;
  }

  private findSystemWithoutStarbase(
    fromSystem: SystemId,
    explored: Set<SystemId>
  ): SystemId | null {
    const neighbors = this.getNeighbors(fromSystem);
    for (const n of neighbors) {
      if (!explored.has(n)) continue;
      const hasStarbase = this.db
        .prepare("SELECT 1 FROM starbases WHERE system_id = ?")
        .get(n);
      if (!hasStarbase) return n;
    }
    return null;
  }

  private findNextHop(from: SystemId, to: SystemId): SystemId | null {
    // Simple BFS for shortest path
    const visited = new Set<string>();
    const parent = new Map<string, string>();
    const queue: string[] = [from];
    visited.add(from);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === to) {
        // Trace back to find first hop
        let node = to;
        while (parent.get(node) !== from) {
          const p = parent.get(node);
          if (!p) return null;
          node = p;
        }
        return node;
      }

      for (const neighbor of this.getNeighbors(current)) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          parent.set(neighbor, current);
          queue.push(neighbor);
        }
      }
    }
    return null;
  }

  private getNeighbors(systemId: SystemId): SystemId[] {
    const rows = this.db
      .prepare(
        "SELECT system_a, system_b FROM hyperlanes WHERE system_a = ? OR system_b = ?"
      )
      .all(systemId, systemId) as HyperlaneRow[];

    return rows.map((r) => (r.system_a === systemId ? r.system_b : r.system_a));
  }
}
