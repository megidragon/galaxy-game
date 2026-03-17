import type Database from "better-sqlite3";
import type { StarSystem, Hyperlane, Planet, StarType, PlanetType } from "../../shared/types/index.js";
import type { GalaxyData } from "./generator.js";

export function saveGalaxy(db: Database.Database, data: GalaxyData): void {
  const insertSystem = db.prepare(
    "INSERT INTO star_systems (id, name, x, y, star_type) VALUES (?, ?, ?, ?, ?)"
  );
  const insertPlanet = db.prepare(
    "INSERT INTO planets (id, system_id, name, size, planet_type, role, owner_id, is_colonized) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const insertHyperlane = db.prepare(
    "INSERT INTO hyperlanes (system_a, system_b, distance) VALUES (?, ?, ?)"
  );

  const transaction = db.transaction(() => {
    for (const system of data.systems) {
      insertSystem.run(system.id, system.name, system.x, system.y, system.starType);
      for (const planet of system.planets) {
        insertPlanet.run(
          planet.id,
          planet.systemId,
          planet.name,
          planet.size,
          planet.planetType,
          planet.role,
          planet.ownerId,
          planet.isColonized ? 1 : 0
        );
      }
    }
    for (const lane of data.hyperlanes) {
      insertHyperlane.run(lane.systemA, lane.systemB, lane.distance);
    }
  });

  transaction();
}

export function loadGalaxy(db: Database.Database): GalaxyData | null {
  const systemRows = db.prepare("SELECT * FROM star_systems").all() as Array<{
    id: string;
    name: string;
    x: number;
    y: number;
    star_type: string;
  }>;

  if (systemRows.length === 0) return null;

  const planetRows = db.prepare("SELECT * FROM planets").all() as Array<{
    id: string;
    system_id: string;
    name: string;
    size: number;
    planet_type: string;
    role: string | null;
    owner_id: string | null;
    is_colonized: number;
  }>;

  const hyperlaneRows = db.prepare("SELECT * FROM hyperlanes").all() as Array<{
    system_a: string;
    system_b: string;
    distance: number;
  }>;

  const exploredRows = db.prepare("SELECT * FROM explored_systems").all() as Array<{
    empire_id: string;
    system_id: string;
  }>;

  // Group planets by system
  const planetsBySystem = new Map<string, Planet[]>();
  for (const row of planetRows) {
    const planet: Planet = {
      id: row.id,
      systemId: row.system_id,
      name: row.name,
      size: row.size,
      planetType: row.planet_type as PlanetType,
      role: row.role as Planet["role"],
      ownerId: row.owner_id,
      isColonized: row.is_colonized === 1,
    };
    const list = planetsBySystem.get(row.system_id) ?? [];
    list.push(planet);
    planetsBySystem.set(row.system_id, list);
  }

  // Group explored status by system
  const exploredBySystem = new Map<string, Record<string, boolean>>();
  for (const row of exploredRows) {
    const map = exploredBySystem.get(row.system_id) ?? {};
    map[row.empire_id] = true;
    exploredBySystem.set(row.system_id, map);
  }

  const systems: StarSystem[] = systemRows.map((row) => ({
    id: row.id,
    name: row.name,
    x: row.x,
    y: row.y,
    starType: row.star_type as StarType,
    planets: planetsBySystem.get(row.id) ?? [],
    starbase: null, // Loaded separately when needed
    explored: exploredBySystem.get(row.id) ?? {},
  }));

  const hyperlanes: Hyperlane[] = hyperlaneRows.map((row) => ({
    systemA: row.system_a,
    systemB: row.system_b,
    distance: row.distance,
  }));

  return { systems, hyperlanes };
}

export function isGalaxyGenerated(db: Database.Database): boolean {
  const row = db.prepare("SELECT COUNT(*) as count FROM star_systems").get() as { count: number };
  return row.count > 0;
}
