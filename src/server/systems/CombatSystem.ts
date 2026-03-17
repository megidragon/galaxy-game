import type Database from "better-sqlite3";
import { ShipManager } from "../entities/ShipManager.js";
import type { Ship, SystemId } from "../../shared/types/index.js";

interface CombatEvent {
  systemId: SystemId;
  attackerId: string;
  defenderId: string;
  attackerShipId: string;
  defenderShipId: string;
  damage: number;
  defenderDestroyed: boolean;
}

export class CombatSystem {
  private shipManager: ShipManager;

  constructor(private db: Database.Database) {
    this.shipManager = new ShipManager(db);
  }

  processTick(tick: number): CombatEvent[] {
    const events: CombatEvent[] = [];

    // Find all systems with military ships from multiple empires
    const militaryShips = this.db
      .prepare(
        `SELECT * FROM ships
         WHERE ship_class = 'military' AND is_alive = 1 AND target_system_id IS NULL`
      )
      .all() as ShipRow[];

    // Group by system
    const shipsBySystem = new Map<string, ShipRow[]>();
    for (const ship of militaryShips) {
      const list = shipsBySystem.get(ship.system_id) ?? [];
      list.push(ship);
      shipsBySystem.set(ship.system_id, list);
    }

    // Process combat in each contested system
    for (const [systemId, ships] of shipsBySystem) {
      // Group by owner
      const byOwner = new Map<string, ShipRow[]>();
      for (const ship of ships) {
        const list = byOwner.get(ship.owner_id) ?? [];
        list.push(ship);
        byOwner.set(ship.owner_id, list);
      }

      // Need at least 2 different empires for combat
      if (byOwner.size < 2) continue;

      // Each empire's ships attack ships of other empires
      const owners = Array.from(byOwner.keys());
      for (let i = 0; i < owners.length; i++) {
        for (let j = i + 1; j < owners.length; j++) {
          const attackerShips = byOwner.get(owners[i])!;
          const defenderShips = byOwner.get(owners[j])!;

          // Each attacker fires at a random defender
          for (const attacker of attackerShips) {
            const aliveDefenders = defenderShips.filter((s) => s.is_alive === 1);
            if (aliveDefenders.length === 0) break;

            const target = aliveDefenders[Math.floor(Math.random() * aliveDefenders.length)];
            const damage = attacker.attack;

            const result = this.shipManager.applyDamage(target.id, damage);

            if (result.destroyed) {
              target.is_alive = 0; // Update local state
            }

            events.push({
              systemId,
              attackerId: attacker.owner_id,
              defenderId: target.owner_id,
              attackerShipId: attacker.id,
              defenderShipId: target.id,
              damage,
              defenderDestroyed: result.destroyed,
            });
          }

          // Defenders also attack back
          for (const defender of defenderShips) {
            if (defender.is_alive === 0) continue;

            const aliveAttackers = attackerShips.filter((s) => s.is_alive === 1);
            if (aliveAttackers.length === 0) break;

            const target = aliveAttackers[Math.floor(Math.random() * aliveAttackers.length)];
            const damage = defender.attack;

            const result = this.shipManager.applyDamage(target.id, damage);

            if (result.destroyed) {
              target.is_alive = 0;
            }

            events.push({
              systemId,
              attackerId: defender.owner_id,
              defenderId: target.owner_id,
              attackerShipId: defender.id,
              defenderShipId: target.id,
              damage,
              defenderDestroyed: result.destroyed,
            });
          }
        }
      }

      // After combat, check if one empire now controls the system
      this.checkTerritorialControl(systemId);
    }

    // Log combat events
    if (events.length > 0) {
      this.logCombatEvents(tick, events);
    }

    return events;
  }

  private checkTerritorialControl(systemId: SystemId): void {
    // Check if any starbase exists in this system
    const starbase = this.db
      .prepare("SELECT * FROM starbases WHERE system_id = ?")
      .get(systemId) as { id: string; owner_id: string } | undefined;

    if (!starbase) return;

    // Get surviving military ships in the system
    const aliveShips = this.db
      .prepare(
        "SELECT DISTINCT owner_id FROM ships WHERE system_id = ? AND ship_class = 'military' AND is_alive = 1"
      )
      .all(systemId) as Array<{ owner_id: string }>;

    // If only hostile ships remain (no ships of the starbase owner), capture the starbase
    const ownerHasShips = aliveShips.some((s) => s.owner_id === starbase.owner_id);
    const hostileShips = aliveShips.filter((s) => s.owner_id !== starbase.owner_id);

    if (!ownerHasShips && hostileShips.length === 1) {
      // Transfer starbase ownership
      const newOwnerId = hostileShips[0].owner_id;
      this.db
        .prepare("UPDATE starbases SET owner_id = ? WHERE system_id = ?")
        .run(newOwnerId, systemId);

      // Transfer planets in system
      this.db
        .prepare("UPDATE planets SET owner_id = ? WHERE system_id = ? AND is_colonized = 1")
        .run(newOwnerId, systemId);
    }
  }

  private logCombatEvents(tick: number, events: CombatEvent[]): void {
    const insert = this.db.prepare(
      "INSERT INTO game_events (tick, event_type, data) VALUES (?, 'combat', ?)"
    );

    for (const event of events) {
      insert.run(tick, JSON.stringify(event));
    }
  }

  getMilitaryPower(empireId: string): number {
    const ships = this.shipManager.getShipsByOwnerAndClass(empireId, "military");
    return ships.reduce((total, ship) => {
      return total + ship.attack + ship.hp + ship.shields + ship.armor;
    }, 0);
  }
}

interface ShipRow {
  id: string;
  name: string;
  owner_id: string;
  ship_class: string;
  system_id: string;
  target_system_id: string | null;
  travel_progress: number;
  hp: number;
  max_hp: number;
  shields: number;
  max_shields: number;
  armor: number;
  max_armor: number;
  attack: number;
  speed: number;
  is_alive: number;
}
