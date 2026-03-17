// Procedural star system name generator

const PREFIXES = [
  "Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta",
  "Iota", "Kappa", "Lambda", "Mu", "Nu", "Xi", "Omicron", "Pi",
  "Rho", "Sigma", "Tau", "Upsilon", "Phi", "Chi", "Psi", "Omega",
];

const ROOTS = [
  "Centauri", "Draconis", "Cygni", "Lyrae", "Aquilae", "Tauri",
  "Orionis", "Virginis", "Leonis", "Scorpii", "Pegasi", "Andromedae",
  "Cassiopeiae", "Ursae", "Carinae", "Velorum", "Puppis", "Hydrae",
  "Coronae", "Serpentis", "Ophiuchi", "Sagittarii", "Capricorni",
  "Aquarii", "Piscium", "Arietis", "Geminorum", "Cancri", "Librae",
  "Eridani", "Cephei", "Persei", "Aurigae", "Bootis", "Herculis",
];

const SUFFIXES = [
  "Prime", "Major", "Minor", "Nexus", "Gate", "Haven",
  "Reach", "Deep", "Core", "Edge", "Void", "Beacon",
];

const STANDALONE = [
  "Sol", "Sirius", "Vega", "Polaris", "Rigel", "Betelgeuse",
  "Aldebaran", "Antares", "Spica", "Procyon", "Achernar", "Canopus",
  "Altair", "Deneb", "Fomalhaut", "Regulus", "Castor", "Pollux",
  "Arcturus", "Capella", "Mira", "Algol", "Bellatrix", "Mintaka",
];

export function generateSystemName(index: number, rng: () => number): string {
  // Use standalone names first for notable systems
  if (index < STANDALONE.length && rng() < 0.4) {
    return STANDALONE[index];
  }

  const style = rng();

  if (style < 0.4) {
    // "Alpha Centauri" style
    const prefix = PREFIXES[Math.floor(rng() * PREFIXES.length)];
    const root = ROOTS[Math.floor(rng() * ROOTS.length)];
    return `${prefix} ${root}`;
  } else if (style < 0.7) {
    // "Centauri Prime" style
    const root = ROOTS[Math.floor(rng() * ROOTS.length)];
    const suffix = SUFFIXES[Math.floor(rng() * SUFFIXES.length)];
    return `${root} ${suffix}`;
  } else {
    // Standalone with number
    const name = STANDALONE[Math.floor(rng() * STANDALONE.length)];
    const num = Math.floor(rng() * 900) + 100;
    return `${name}-${num}`;
  }
}

export function generatePlanetName(systemName: string, planetIndex: number): string {
  const romanNumerals = ["I", "II", "III", "IV", "V"];
  return `${systemName} ${romanNumerals[planetIndex] ?? (planetIndex + 1).toString()}`;
}
