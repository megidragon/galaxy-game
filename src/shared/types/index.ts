// Core game types shared between server and client

// ─── Identifiers ───────────────────────────────────────────────

export type SystemId = string;
export type PlanetId = string;
export type ShipId = string;
export type EmpireId = string;
export type StarbaseId = string;
export type TechId = string;

// ─── Galaxy & Map ──────────────────────────────────────────────

export interface StarSystem {
  id: SystemId;
  name: string;
  x: number;
  y: number;
  starType: StarType;
  planets: Planet[];
  starbase: Starbase | null;
  explored: Record<EmpireId, boolean>;
}

export type StarType = "yellow" | "red" | "blue" | "white" | "orange" | "binary";

export interface Hyperlane {
  systemA: SystemId;
  systemB: SystemId;
  distance: number;
}

export interface Planet {
  id: PlanetId;
  systemId: SystemId;
  name: string;
  size: number; // 1-5
  planetType: PlanetType;
  role: PlanetRole | null;
  ownerId: EmpireId | null;
  isColonized: boolean;
}

export type PlanetType = "continental" | "ocean" | "desert" | "arctic" | "tropical" | "arid" | "barren" | "gas_giant";
export type PlanetRole = "mining" | "generator" | "science" | "forge";

export interface Starbase {
  id: StarbaseId;
  systemId: SystemId;
  ownerId: EmpireId;
  level: number; // 1 or 2
}

// ─── Ships ─────────────────────────────────────────────────────

export type ShipClass = "science" | "constructor" | "military" | "colony";

export interface Ship {
  id: ShipId;
  name: string;
  ownerId: EmpireId;
  shipClass: ShipClass;
  systemId: SystemId;
  targetSystemId: SystemId | null;
  travelProgress: number; // 0-1 fraction of travel completed
  hp: number;
  maxHp: number;
  shields: number;
  maxShields: number;
  armor: number;
  maxArmor: number;
  attack: number;
  speed: number;
  isAlive: boolean;
}

// ─── Empires ───────────────────────────────────────────────────

export interface Empire {
  id: EmpireId;
  name: string;
  color: string;
  isPlayer: boolean;
  resources: Resources;
  aiState: AIState | null;
  homeSystemId: SystemId;
}

export interface Resources {
  energy: number;
  minerals: number;
  science: number;
  alloys: number;
}

export type AIState = "explore" | "expand" | "develop" | "attack";

// ─── Technology ────────────────────────────────────────────────

export type TechCategory = "performance" | "unlock";

export interface Technology {
  id: TechId;
  name: string;
  description: string;
  category: TechCategory;
  cost: number;
  effect: TechEffect;
}

export interface TechEffect {
  type: string;
  value: number;
  target?: string;
}

export interface ResearchState {
  currentTechId: TechId | null;
  accumulatedScience: number;
  researchedTechIds: TechId[];
  availableChoices: TechId[];
}

// ─── Game State ────────────────────────────────────────────────

export type GameSpeed = "paused" | "slow" | "normal" | "fast";

export interface GameState {
  tick: number;
  speed: GameSpeed;
  systems: StarSystem[];
  hyperlanes: Hyperlane[];
  ships: Ship[];
  empires: Empire[];
}

// ─── Actions (client -> server) ────────────────────────────────

export type GameAction =
  | { type: "SET_SPEED"; speed: GameSpeed }
  | { type: "MOVE_SHIP"; shipId: ShipId; targetSystemId: SystemId }
  | { type: "SCAN_SYSTEM"; shipId: ShipId }
  | { type: "BUILD_STARBASE"; shipId: ShipId }
  | { type: "BUILD_MINING_POST"; shipId: ShipId; planetId: PlanetId }
  | { type: "COLONIZE_PLANET"; shipId: ShipId; planetId: PlanetId; role: PlanetRole }
  | { type: "SET_PLANET_ROLE"; planetId: PlanetId; role: PlanetRole }
  | { type: "BUILD_SHIP"; systemId: SystemId; shipClass: ShipClass }
  | { type: "RESEARCH_TECH"; techId: TechId };

// ─── Events (server -> client) ─────────────────────────────────

export interface GameEvent {
  tick: number;
  type: string;
  data: Record<string, unknown>;
}
