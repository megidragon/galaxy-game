import type Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import type {
  Ship,
  ShipId,
  ShipClass,
  EmpireId,
  SystemId,
} from "../../shared/types/index.js";
import { CONFIG } from "../../shared/config.js";

export class ShipManager {
  constructor(private db: Database.Database) {}

  createShip(params: {
    name: string;
    ownerId: EmpireId;
    shipClass: ShipClass;
    systemId: SystemId;
  }): Ship {
    const id = uuidv4();
    const stats = CONFIG.ships[params.shipClass];

    const ship: Ship = {
      id,
      name: params.name,
      ownerId: params.ownerId,
      shipClass: params.shipClass,
      systemId: params.systemId,
      targetSystemId: null,
      travelProgress: 0,
      hp: stats.hp,
      maxHp: stats.hp,
      shields: stats.shields,
      maxShields: stats.shields,
      armor: stats.armor,
      maxArmor: stats.armor,
      attack: stats.attack,
      speed: stats.speed,
      isAlive: true,
    };

    this.db
      .prepare(
        `INSERT INTO ships (id, name, owner_id, ship_class, system_id, target_system_id,
         travel_progress, hp, max_hp, shields, max_shields, armor, max_armor, attack, speed, is_alive)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        ship.id, ship.name, ship.ownerId, ship.shipClass, ship.systemId,
        ship.targetSystemId, ship.travelProgress, ship.hp, ship.maxHp,
        ship.shields, ship.maxShields, ship.armor, ship.maxArmor,
        ship.attack, ship.speed, 1
      );

    return ship;
  }

  getShip(id: ShipId): Ship | null {
    const row = this.db
      .prepare("SELECT * FROM ships WHERE id = ?")
      .get(id) as ShipRow | undefined;
    return row ? this.rowToShip(row) : null;
  }

  getShipsByOwner(ownerId: EmpireId): Ship[] {
    const rows = this.db
      .prepare("SELECT * FROM ships WHERE owner_id = ? AND is_alive = 1")
      .all(ownerId) as ShipRow[];
    return rows.map((r) => this.rowToShip(r));
  }

  getShipsBySystem(systemId: SystemId): Ship[] {
    const rows = this.db
      .prepare("SELECT * FROM ships WHERE system_id = ? AND is_alive = 1")
      .all(systemId) as ShipRow[];
    return rows.map((r) => this.rowToShip(r));
  }

  getShipsByOwnerAndClass(ownerId: EmpireId, shipClass: ShipClass): Ship[] {
    const rows = this.db
      .prepare("SELECT * FROM ships WHERE owner_id = ? AND ship_class = ? AND is_alive = 1")
      .all(ownerId, shipClass) as ShipRow[];
    return rows.map((r) => this.rowToShip(r));
  }

  getAllAliveShips(): Ship[] {
    const rows = this.db
      .prepare("SELECT * FROM ships WHERE is_alive = 1")
      .all() as ShipRow[];
    return rows.map((r) => this.rowToShip(r));
  }

  moveShip(id: ShipId, targetSystemId: SystemId): void {
    this.db
      .prepare("UPDATE ships SET target_system_id = ?, travel_progress = 0 WHERE id = ?")
      .run(targetSystemId, id);
  }

  updateTravelProgress(id: ShipId, progress: number, arrived: boolean): void {
    if (arrived) {
      const ship = this.getShip(id);
      if (ship?.targetSystemId) {
        this.db
          .prepare(
            "UPDATE ships SET system_id = ?, target_system_id = NULL, travel_progress = 0 WHERE id = ?"
          )
          .run(ship.targetSystemId, id);
      }
    } else {
      this.db
        .prepare("UPDATE ships SET travel_progress = ? WHERE id = ?")
        .run(progress, id);
    }
  }

  applyDamage(id: ShipId, damage: number): { destroyed: boolean } {
    const ship = this.getShip(id);
    if (!ship || !ship.isAlive) return { destroyed: true };

    let remaining = damage;

    // Damage shields first
    let newShields = ship.shields;
    if (newShields > 0) {
      const absorbed = Math.min(newShields, remaining);
      newShields -= absorbed;
      remaining -= absorbed;
    }

    // Then armor
    let newArmor = ship.armor;
    if (remaining > 0 && newArmor > 0) {
      const absorbed = Math.min(newArmor, remaining);
      newArmor -= absorbed;
      remaining -= absorbed;
    }

    // Then hull
    let newHp = ship.hp;
    if (remaining > 0) {
      newHp -= remaining;
    }

    const destroyed = newHp <= 0;

    this.db
      .prepare(
        "UPDATE ships SET shields = ?, armor = ?, hp = ?, is_alive = ? WHERE id = ?"
      )
      .run(
        Math.max(0, newShields),
        Math.max(0, newArmor),
        Math.max(0, newHp),
        destroyed ? 0 : 1,
        id
      );

    return { destroyed };
  }

  destroyShip(id: ShipId): void {
    this.db.prepare("UPDATE ships SET is_alive = 0, hp = 0 WHERE id = ?").run(id);
  }

  getShipCost(shipClass: ShipClass) {
    return CONFIG.ships[shipClass].cost;
  }

  private rowToShip(row: ShipRow): Ship {
    return {
      id: row.id,
      name: row.name,
      ownerId: row.owner_id,
      shipClass: row.ship_class as ShipClass,
      systemId: row.system_id,
      targetSystemId: row.target_system_id,
      travelProgress: row.travel_progress,
      hp: row.hp,
      maxHp: row.max_hp,
      shields: row.shields,
      maxShields: row.max_shields,
      armor: row.armor,
      maxArmor: row.max_armor,
      attack: row.attack,
      speed: row.speed,
      isAlive: row.is_alive === 1,
    };
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
