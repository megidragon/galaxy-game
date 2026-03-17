import { v4 as uuidv4 } from "uuid";
import { CONFIG } from "../../shared/config.js";
import type {
  StarSystem,
  Hyperlane,
  Planet,
  StarType,
  PlanetType,
} from "../../shared/types/index.js";
import { generateSystemName, generatePlanetName } from "./names.js";

// Seeded pseudo-random number generator (mulberry32)
function createRng(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STAR_TYPES: StarType[] = ["yellow", "red", "blue", "white", "orange", "binary"];
const STAR_TYPE_WEIGHTS = [0.25, 0.30, 0.10, 0.15, 0.15, 0.05];

const PLANET_TYPES: PlanetType[] = [
  "continental", "ocean", "desert", "arctic", "tropical", "arid", "barren", "gas_giant",
];

function pickWeighted<T>(items: T[], weights: number[], rng: () => number): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function generateSystemPositions(
  count: number,
  radius: number,
  rng: () => number
): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  const minDistance = radius * 0.12; // Minimum distance between systems

  let attempts = 0;
  while (positions.length < count && attempts < count * 100) {
    // Spiral arm distribution for a more galaxy-like shape
    const angle = rng() * Math.PI * 2;
    const dist = Math.sqrt(rng()) * radius; // sqrt for uniform area distribution
    const armOffset = Math.sin(angle * 2) * 0.3; // Slight spiral perturbation
    const x = Math.cos(angle + armOffset) * dist;
    const y = Math.sin(angle + armOffset) * dist;

    // Check minimum distance from existing systems
    const tooClose = positions.some(
      (p) => Math.hypot(p.x - x, p.y - y) < minDistance
    );

    if (!tooClose) {
      positions.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
    }
    attempts++;
  }

  return positions;
}

function generateHyperlanes(
  systems: StarSystem[],
  rng: () => number
): Hyperlane[] {
  const { minHyperlanesPerSystem, maxHyperlanesPerSystem } = CONFIG.galaxy;
  const hyperlanes: Hyperlane[] = [];
  const connections = new Map<string, Set<string>>();

  // Initialize connection sets
  for (const sys of systems) {
    connections.set(sys.id, new Set());
  }

  // Sort all possible edges by distance
  const edges: Array<{ a: StarSystem; b: StarSystem; dist: number }> = [];
  for (let i = 0; i < systems.length; i++) {
    for (let j = i + 1; j < systems.length; j++) {
      const dist = Math.hypot(
        systems[i].x - systems[j].x,
        systems[i].y - systems[j].y
      );
      edges.push({ a: systems[i], b: systems[j], dist });
    }
  }
  edges.sort((a, b) => a.dist - b.dist);

  // Phase 1: Minimum spanning tree (ensures connectivity)
  const visited = new Set<string>();
  visited.add(systems[0].id);

  while (visited.size < systems.length) {
    // Find shortest edge connecting visited to unvisited
    for (const edge of edges) {
      const aVisited = visited.has(edge.a.id);
      const bVisited = visited.has(edge.b.id);
      if (aVisited !== bVisited) {
        visited.add(edge.a.id);
        visited.add(edge.b.id);
        hyperlanes.push({
          systemA: edge.a.id,
          systemB: edge.b.id,
          distance: Math.round(edge.dist * 100) / 100,
        });
        connections.get(edge.a.id)!.add(edge.b.id);
        connections.get(edge.b.id)!.add(edge.a.id);
        break;
      }
    }
  }

  // Phase 2: Add extra lanes for variety (short edges preferred)
  for (const edge of edges) {
    const aConns = connections.get(edge.a.id)!;
    const bConns = connections.get(edge.b.id)!;

    if (aConns.has(edge.b.id)) continue; // Already connected

    const aNeeds = aConns.size < minHyperlanesPerSystem;
    const bNeeds = bConns.size < minHyperlanesPerSystem;
    const aCanTake = aConns.size < maxHyperlanesPerSystem;
    const bCanTake = bConns.size < maxHyperlanesPerSystem;

    if ((aNeeds || bNeeds) && aCanTake && bCanTake) {
      hyperlanes.push({
        systemA: edge.a.id,
        systemB: edge.b.id,
        distance: Math.round(edge.dist * 100) / 100,
      });
      aConns.add(edge.b.id);
      bConns.add(edge.a.id);
    } else if (aCanTake && bCanTake && rng() < 0.15) {
      // Random extra connections for map variety
      hyperlanes.push({
        systemA: edge.a.id,
        systemB: edge.b.id,
        distance: Math.round(edge.dist * 100) / 100,
      });
      aConns.add(edge.b.id);
      bConns.add(edge.a.id);
    }
  }

  return hyperlanes;
}

function generatePlanets(
  systemId: string,
  systemName: string,
  rng: () => number
): Planet[] {
  const { minPlanetsPerSystem, maxPlanetsPerSystem } = CONFIG.galaxy;
  const count =
    minPlanetsPerSystem +
    Math.floor(rng() * (maxPlanetsPerSystem - minPlanetsPerSystem + 1));

  const planets: Planet[] = [];
  for (let i = 0; i < count; i++) {
    planets.push({
      id: uuidv4(),
      systemId,
      name: generatePlanetName(systemName, i),
      size: Math.floor(rng() * 5) + 1,
      planetType: PLANET_TYPES[Math.floor(rng() * PLANET_TYPES.length)],
      role: null,
      ownerId: null,
      isColonized: false,
    });
  }

  return planets;
}

export interface GalaxyData {
  systems: StarSystem[];
  hyperlanes: Hyperlane[];
}

export function generateGalaxy(seed?: number): GalaxyData {
  const actualSeed = seed ?? Math.floor(Math.random() * 2147483647);
  const rng = createRng(actualSeed);
  const { systemCount, galaxyRadius } = CONFIG.galaxy;

  // Generate system positions
  const positions = generateSystemPositions(systemCount, galaxyRadius, rng);
  const usedNames = new Set<string>();

  // Create star systems with planets
  const systems: StarSystem[] = positions.map((pos, index) => {
    let name: string;
    do {
      name = generateSystemName(index, rng);
    } while (usedNames.has(name));
    usedNames.add(name);

    const id = uuidv4();
    const starType = pickWeighted(STAR_TYPES, STAR_TYPE_WEIGHTS, rng);
    const planets = generatePlanets(id, name, rng);

    return {
      id,
      name,
      x: pos.x,
      y: pos.y,
      starType,
      planets,
      starbase: null,
      explored: {},
    };
  });

  // Generate hyperlane network
  const hyperlanes = generateHyperlanes(systems, rng);

  return { systems, hyperlanes };
}
