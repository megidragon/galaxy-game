import type Database from "better-sqlite3";
import { EmpireManager } from "./EmpireManager.js";
import { ShipManager } from "./ShipManager.js";
import type { StarSystem } from "../../shared/types/index.js";

const EMPIRE_COLORS = [
  "#4488ff", // Player: Blue
  "#ff4444", // AI 1: Red
  "#44ff44", // AI 2: Green
  "#ffaa00", // AI 3: Orange
];

const EMPIRE_NAMES = [
  "United Terran Federation",
  "Xalith Dominion",
  "Venorian Collective",
  "Keth'ari Empire",
];

export function setupNewGame(
  db: Database.Database,
  systems: StarSystem[],
  aiCount: number = 3
): void {
  const empireManager = new EmpireManager(db);
  const shipManager = new ShipManager(db);

  // Pick home systems spread across the galaxy
  const homeSystems = pickSpreadSystems(systems, 1 + aiCount);

  // Create player empire
  const playerHome = homeSystems[0];
  const playerEmpire = empireManager.createEmpire({
    name: EMPIRE_NAMES[0],
    color: EMPIRE_COLORS[0],
    isPlayer: true,
    homeSystemId: playerHome.id,
  });

  // Give player starting ships
  shipManager.createShip({
    name: "UTS Discovery",
    ownerId: playerEmpire.id,
    shipClass: "science",
    systemId: playerHome.id,
  });
  shipManager.createShip({
    name: "UTS Pioneer",
    ownerId: playerEmpire.id,
    shipClass: "constructor",
    systemId: playerHome.id,
  });
  shipManager.createShip({
    name: "UTS Sentinel",
    ownerId: playerEmpire.id,
    shipClass: "military",
    systemId: playerHome.id,
  });

  // Create AI empires
  for (let i = 0; i < aiCount; i++) {
    const aiHome = homeSystems[i + 1];
    const aiEmpire = empireManager.createEmpire({
      name: EMPIRE_NAMES[i + 1] ?? `AI Empire ${i + 1}`,
      color: EMPIRE_COLORS[i + 1] ?? "#888888",
      isPlayer: false,
      homeSystemId: aiHome.id,
    });

    // Give AI starting ships
    shipManager.createShip({
      name: `${aiEmpire.name} Scout`,
      ownerId: aiEmpire.id,
      shipClass: "science",
      systemId: aiHome.id,
    });
    shipManager.createShip({
      name: `${aiEmpire.name} Builder`,
      ownerId: aiEmpire.id,
      shipClass: "constructor",
      systemId: aiHome.id,
    });
    shipManager.createShip({
      name: `${aiEmpire.name} Warship`,
      ownerId: aiEmpire.id,
      shipClass: "military",
      systemId: aiHome.id,
    });
  }

  // Build starbases at home systems for all empires
  const allEmpires = empireManager.getAllEmpires();
  for (let i = 0; i < allEmpires.length; i++) {
    const empire = allEmpires[i];
    const homeSystem = homeSystems[i];
    db.prepare(
      "INSERT INTO starbases (id, system_id, owner_id, level) VALUES (?, ?, ?, 1)"
    ).run(`starbase-${homeSystem.id}`, homeSystem.id, empire.id);
  }
}

function pickSpreadSystems(
  systems: StarSystem[],
  count: number
): StarSystem[] {
  if (systems.length <= count) return systems.slice(0, count);

  const picked: StarSystem[] = [];

  // Start with system closest to a specific quadrant edge for each pick
  // This spreads empires across the galaxy
  const sorted = [...systems].sort(
    (a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y)
  );

  // Pick first from center-ish area
  const midIndex = Math.floor(sorted.length * 0.3);
  picked.push(sorted[midIndex]);

  // Pick remaining maximizing minimum distance from already picked
  while (picked.length < count) {
    let bestSystem: StarSystem | null = null;
    let bestMinDist = -1;

    for (const sys of systems) {
      if (picked.some((p) => p.id === sys.id)) continue;

      const minDist = Math.min(
        ...picked.map((p) => Math.hypot(p.x - sys.x, p.y - sys.y))
      );

      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        bestSystem = sys;
      }
    }

    if (bestSystem) {
      picked.push(bestSystem);
    } else {
      break;
    }
  }

  return picked;
}
