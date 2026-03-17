import type Database from "better-sqlite3";
import { EmpireManager } from "../entities/EmpireManager.js";
import { ShipManager } from "../entities/ShipManager.js";
import type {
  EmpireId,
  PlanetRole,
  PlanetId,
  ShipClass,
  SystemId,
  Resources,
} from "../../shared/types/index.js";
import { CONFIG } from "../../shared/config.js";

interface PlanetRow {
  id: string;
  system_id: string;
  role: string | null;
  owner_id: string | null;
  is_colonized: number;
}

export class EconomySystem {
  private empireManager: EmpireManager;
  private shipManager: ShipManager;

  constructor(private db: Database.Database) {
    this.empireManager = new EmpireManager(db);
    this.shipManager = new ShipManager(db);
  }

  processTick(): void {
    const empires = this.empireManager.getAllEmpires();

    for (const empire of empires) {
      // Calculate total production from colonized planets
      const planets = this.db
        .prepare("SELECT * FROM planets WHERE owner_id = ? AND is_colonized = 1")
        .all(empire.id) as PlanetRow[];

      const production: Resources = { energy: 0, minerals: 0, science: 0, alloys: 0 };

      for (const planet of planets) {
        if (planet.role && planet.role in CONFIG.planetProduction) {
          const p = CONFIG.planetProduction[planet.role as PlanetRole];
          production.energy += p.energy;
          production.minerals += p.minerals;
          production.science += p.science;
          production.alloys += p.alloys;
        }
      }

      // Deduct ship maintenance (1 energy per ship)
      const ships = this.shipManager.getShipsByOwner(empire.id);
      production.energy -= ships.length;

      // Apply production delta
      this.empireManager.updateResources(empire.id, production);

      // Clamp resources to minimum 0
      const updated = this.empireManager.getEmpire(empire.id);
      if (updated) {
        const clamped: Resources = {
          energy: Math.max(0, updated.resources.energy),
          minerals: Math.max(0, updated.resources.minerals),
          science: Math.max(0, updated.resources.science),
          alloys: Math.max(0, updated.resources.alloys),
        };
        if (
          clamped.energy !== updated.resources.energy ||
          clamped.minerals !== updated.resources.minerals ||
          clamped.science !== updated.resources.science ||
          clamped.alloys !== updated.resources.alloys
        ) {
          this.empireManager.setResources(empire.id, clamped);
        }
      }
    }
  }

  colonizePlanet(
    empireId: EmpireId,
    planetId: PlanetId,
    role: PlanetRole,
    shipId: string
  ): { ok: boolean; error?: string } {
    // Verify the ship is a colony ship owned by this empire
    const ship = this.shipManager.getShip(shipId);
    if (!ship || ship.shipClass !== "colony" || ship.ownerId !== empireId) {
      return { ok: false, error: "Invalid colony ship" };
    }

    // Check planet is uncolonized
    const planet = this.db
      .prepare("SELECT * FROM planets WHERE id = ?")
      .get(planetId) as PlanetRow | undefined;
    if (!planet) return { ok: false, error: "Planet not found" };
    if (planet.is_colonized) return { ok: false, error: "Planet already colonized" };

    // Check ship is in the same system
    if (ship.systemId !== planet.system_id) {
      return { ok: false, error: "Colony ship not in planet's system" };
    }

    // Check planet type is colonizable (not gas_giant or barren)
    const planetData = this.db
      .prepare("SELECT planet_type FROM planets WHERE id = ?")
      .get(planetId) as { planet_type: string } | undefined;
    if (planetData?.planet_type === "gas_giant" || planetData?.planet_type === "barren") {
      return { ok: false, error: "Cannot colonize this planet type" };
    }

    // Colonize the planet
    this.db
      .prepare("UPDATE planets SET owner_id = ?, is_colonized = 1, role = ? WHERE id = ?")
      .run(empireId, role, planetId);

    // Colony ship is consumed
    this.shipManager.destroyShip(shipId);

    return { ok: true };
  }

  setPlanetRole(
    empireId: EmpireId,
    planetId: PlanetId,
    role: PlanetRole
  ): { ok: boolean; error?: string } {
    const planet = this.db
      .prepare("SELECT * FROM planets WHERE id = ?")
      .get(planetId) as PlanetRow | undefined;

    if (!planet) return { ok: false, error: "Planet not found" };
    if (planet.owner_id !== empireId) return { ok: false, error: "Not your planet" };
    if (!planet.is_colonized) return { ok: false, error: "Planet not colonized" };

    this.db.prepare("UPDATE planets SET role = ? WHERE id = ?").run(role, planetId);
    return { ok: true };
  }

  buildShip(
    empireId: EmpireId,
    systemId: SystemId,
    shipClass: ShipClass
  ): { ok: boolean; error?: string; shipId?: string } {
    // Check empire has a starbase in this system
    const starbase = this.db
      .prepare("SELECT * FROM starbases WHERE system_id = ? AND owner_id = ?")
      .get(systemId, empireId);
    if (!starbase) {
      return { ok: false, error: "No starbase in this system" };
    }

    // Check resources
    const empire = this.empireManager.getEmpire(empireId);
    if (!empire) return { ok: false, error: "Empire not found" };

    const cost = this.shipManager.getShipCost(shipClass);
    if (
      empire.resources.energy < cost.energy ||
      empire.resources.minerals < cost.minerals ||
      empire.resources.alloys < cost.alloys
    ) {
      return { ok: false, error: "Insufficient resources" };
    }

    // Deduct resources
    this.empireManager.updateResources(empireId, {
      energy: -cost.energy,
      minerals: -cost.minerals,
      science: -cost.science,
      alloys: -cost.alloys,
    });

    // Create ship
    const shipCount = this.shipManager.getShipsByOwner(empireId).length;
    const ship = this.shipManager.createShip({
      name: `${empire.name} ${shipClass} ${shipCount + 1}`,
      ownerId: empireId,
      shipClass,
      systemId,
    });

    return { ok: true, shipId: ship.id };
  }

  getEmpireProduction(empireId: EmpireId): Resources {
    const planets = this.db
      .prepare("SELECT * FROM planets WHERE owner_id = ? AND is_colonized = 1")
      .all(empireId) as PlanetRow[];

    const production: Resources = { energy: 0, minerals: 0, science: 0, alloys: 0 };

    for (const planet of planets) {
      if (planet.role && planet.role in CONFIG.planetProduction) {
        const p = CONFIG.planetProduction[planet.role as PlanetRole];
        production.energy += p.energy;
        production.minerals += p.minerals;
        production.science += p.science;
        production.alloys += p.alloys;
      }
    }

    const ships = this.shipManager.getShipsByOwner(empireId);
    production.energy -= ships.length;

    return production;
  }
}
