import type Database from "better-sqlite3";
import { GameLoop } from "./GameLoop.js";
import { EconomySystem } from "../systems/EconomySystem.js";
import { ResearchSystem } from "../systems/ResearchSystem.js";
import { CombatSystem } from "../systems/CombatSystem.js";
import { ShipManager } from "../entities/ShipManager.js";
import { EmpireManager } from "../entities/EmpireManager.js";
import type { GameAction, GameSpeed } from "../../shared/types/index.js";

export class GameEngine {
  private db: Database.Database;
  private loop: GameLoop;
  private economySystem: EconomySystem;
  private researchSystem: ResearchSystem;
  private combatSystem: CombatSystem;
  private shipManager: ShipManager;
  private empireManager: EmpireManager;

  constructor(db: Database.Database) {
    this.db = db;
    this.economySystem = new EconomySystem(db);
    this.researchSystem = new ResearchSystem(db);
    this.combatSystem = new CombatSystem(db);
    this.shipManager = new ShipManager(db);
    this.empireManager = new EmpireManager(db);

    // Load current state from DB
    const state = this.db
      .prepare("SELECT tick, speed FROM game_state WHERE id = 1")
      .get() as { tick: number; speed: GameSpeed } | undefined;

    this.loop = new GameLoop(state?.tick ?? 0, "paused");
    this.loop.onTick((tick) => this.processTick(tick));
  }

  start(speed: GameSpeed = "normal"): void {
    this.loop.setSpeed(speed);
    this.persistGameState();
  }

  pause(): void {
    this.loop.setSpeed("paused");
    this.persistGameState();
  }

  setSpeed(speed: GameSpeed): void {
    this.loop.setSpeed(speed);
    this.persistGameState();
  }

  getSpeed(): GameSpeed {
    return this.loop.getSpeed();
  }

  getTick(): number {
    return this.loop.getTick();
  }

  getDatabase(): Database.Database {
    return this.db;
  }

  handleAction(action: GameAction): { ok: boolean; error?: string; data?: unknown } {
    const player = this.empireManager.getPlayerEmpire();
    if (!player) return { ok: false, error: "No player empire" };

    switch (action.type) {
      case "SET_SPEED":
        this.setSpeed(action.speed);
        return { ok: true };

      case "MOVE_SHIP":
        return this.handleMoveShip(player.id, action.shipId, action.targetSystemId);

      case "SCAN_SYSTEM":
        return this.handleScanSystem(player.id, action.shipId);

      case "BUILD_STARBASE":
        return this.handleBuildStarbase(player.id, action.shipId);

      case "BUILD_MINING_POST":
        return { ok: false, error: "Not yet implemented" };

      case "COLONIZE_PLANET":
        return this.economySystem.colonizePlanet(
          player.id, action.planetId, action.role, action.shipId
        );

      case "SET_PLANET_ROLE":
        return this.economySystem.setPlanetRole(player.id, action.planetId, action.role);

      case "BUILD_SHIP":
        return this.economySystem.buildShip(player.id, action.systemId, action.shipClass);

      case "RESEARCH_TECH":
        return this.researchSystem.startResearch(player.id, action.techId);

      default:
        return { ok: false, error: `Unknown action type` };
    }
  }

  private handleMoveShip(
    empireId: string,
    shipId: string,
    targetSystemId: string
  ): { ok: boolean; error?: string } {
    const ship = this.shipManager.getShip(shipId);
    if (!ship) return { ok: false, error: "Ship not found" };
    if (ship.ownerId !== empireId) return { ok: false, error: "Not your ship" };
    if (!ship.isAlive) return { ok: false, error: "Ship is destroyed" };

    // Verify target is connected by hyperlane
    const lane = this.db
      .prepare(
        `SELECT 1 FROM hyperlanes
         WHERE (system_a = ? AND system_b = ?) OR (system_a = ? AND system_b = ?)`
      )
      .get(ship.systemId, targetSystemId, targetSystemId, ship.systemId);

    if (!lane) return { ok: false, error: "No hyperlane connection" };

    this.shipManager.moveShip(shipId, targetSystemId);
    return { ok: true };
  }

  private handleScanSystem(
    empireId: string,
    shipId: string
  ): { ok: boolean; error?: string } {
    const ship = this.shipManager.getShip(shipId);
    if (!ship) return { ok: false, error: "Ship not found" };
    if (ship.ownerId !== empireId) return { ok: false, error: "Not your ship" };
    if (ship.shipClass !== "science") return { ok: false, error: "Only science ships can scan" };

    this.empireManager.markSystemExplored(empireId, ship.systemId);

    // Also reveal connected systems on the map (just hyperlane visibility, not full explore)
    return { ok: true };
  }

  private handleBuildStarbase(
    empireId: string,
    shipId: string
  ): { ok: boolean; error?: string } {
    const ship = this.shipManager.getShip(shipId);
    if (!ship) return { ok: false, error: "Ship not found" };
    if (ship.ownerId !== empireId) return { ok: false, error: "Not your ship" };
    if (ship.shipClass !== "constructor") return { ok: false, error: "Only constructors can build starbases" };

    // Check system is explored
    if (!this.empireManager.isSystemExplored(empireId, ship.systemId)) {
      return { ok: false, error: "System not explored" };
    }

    // Check no existing starbase
    const existing = this.db
      .prepare("SELECT 1 FROM starbases WHERE system_id = ?")
      .get(ship.systemId);
    if (existing) return { ok: false, error: "Starbase already exists in this system" };

    // Check resources
    const empire = this.empireManager.getEmpire(empireId);
    if (!empire) return { ok: false, error: "Empire not found" };

    const cost = CONFIG.starbase.buildCost;
    if (
      empire.resources.energy < cost.energy ||
      empire.resources.minerals < cost.minerals
    ) {
      return { ok: false, error: "Insufficient resources" };
    }

    // Deduct resources
    this.empireManager.updateResources(empireId, {
      energy: -cost.energy,
      minerals: -cost.minerals,
    });

    // Build starbase
    this.db
      .prepare("INSERT INTO starbases (id, system_id, owner_id, level) VALUES (?, ?, ?, 1)")
      .run(`starbase-${ship.systemId}`, ship.systemId, empireId);

    // Constructor is consumed
    this.shipManager.destroyShip(shipId);

    return { ok: true };
  }

  private processTick(tick: number): void {
    // Process ship movement
    this.processShipMovement();

    // Process economy (every tick)
    this.economySystem.processTick();

    // Process research (every tick)
    this.researchSystem.processTick();

    // Process combat (every tick)
    this.combatSystem.processTick(tick);

    // Persist tick
    this.persistTick(tick);
  }

  private processShipMovement(): void {
    const ships = this.shipManager.getAllAliveShips();

    for (const ship of ships) {
      if (!ship.targetSystemId) continue;

      // Get hyperlane distance
      const lane = this.db
        .prepare(
          `SELECT distance FROM hyperlanes
           WHERE (system_a = ? AND system_b = ?) OR (system_a = ? AND system_b = ?)`
        )
        .get(
          ship.systemId, ship.targetSystemId,
          ship.targetSystemId, ship.systemId
        ) as { distance: number } | undefined;

      if (!lane) continue;

      // Calculate progress increment based on speed and distance
      const increment = ship.speed / Math.max(lane.distance, 1);
      const newProgress = ship.travelProgress + increment;
      const arrived = newProgress >= 1;

      this.shipManager.updateTravelProgress(ship.id, Math.min(newProgress, 1), arrived);

      // If arrived, auto-explore for science ships
      if (arrived && ship.shipClass === "science") {
        this.empireManager.markSystemExplored(ship.ownerId, ship.targetSystemId);
      }
    }
  }

  private persistTick(tick: number): void {
    this.db
      .prepare("UPDATE game_state SET tick = ? WHERE id = 1")
      .run(tick);
  }

  private persistGameState(): void {
    this.db
      .prepare("UPDATE game_state SET tick = ?, speed = ? WHERE id = 1")
      .run(this.loop.getTick(), this.loop.getSpeed());
  }

  destroy(): void {
    this.loop.destroy();
  }
}

// Re-export for import convenience
import { CONFIG } from "../../shared/config.js";
