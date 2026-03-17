// Game configuration constants

export const CONFIG = {
  // Galaxy generation
  galaxy: {
    systemCount: 60,
    minHyperlanesPerSystem: 1,
    maxHyperlanesPerSystem: 4,
    galaxyRadius: 500,
    minPlanetsPerSystem: 0,
    maxPlanetsPerSystem: 5,
  },

  // Game tick
  tick: {
    slowMs: 2000,
    normalMs: 1000,
    fastMs: 500,
  },

  // Starting resources
  startingResources: {
    energy: 100,
    minerals: 100,
    science: 0,
    alloys: 50,
  },

  // Ship stats by class
  ships: {
    science: {
      hp: 50,
      shields: 10,
      armor: 5,
      attack: 0,
      speed: 3,
      cost: { energy: 50, minerals: 30, science: 0, alloys: 0 },
    },
    constructor: {
      hp: 50,
      shields: 5,
      armor: 10,
      attack: 0,
      speed: 2,
      cost: { energy: 30, minerals: 50, science: 0, alloys: 0 },
    },
    military: {
      hp: 100,
      shields: 30,
      armor: 20,
      attack: 25,
      speed: 2,
      cost: { energy: 20, minerals: 20, science: 0, alloys: 50 },
    },
    colony: {
      hp: 80,
      shields: 10,
      armor: 10,
      attack: 0,
      speed: 1,
      cost: { energy: 50, minerals: 50, science: 0, alloys: 0 },
    },
  },

  // Planet production per role
  planetProduction: {
    mining: { energy: -5, minerals: 15, science: 0, alloys: 0 },
    generator: { energy: 15, minerals: 0, science: 0, alloys: 0 },
    science: { energy: -3, minerals: 0, science: 10, alloys: 0 },
    forge: { energy: -5, minerals: -10, science: 0, alloys: 10 },
  },

  // Starbase costs
  starbase: {
    buildCost: { energy: 50, minerals: 100, science: 0, alloys: 0 },
    upgradeCost: { energy: 100, minerals: 200, science: 0, alloys: 50 },
  },

  // Research
  research: {
    choiceCount: 3,
    baseCost: 100,
    costScaling: 1.5,
  },

  // AI thresholds
  ai: {
    attackMilitaryAdvantage: 1.5, // AI attacks when military power is 150% of player's
    expandMinEnergy: 50,
    developMinMinerals: 30,
  },

  // Server
  server: {
    port: 3000,
    host: "localhost",
  },
} as const;
