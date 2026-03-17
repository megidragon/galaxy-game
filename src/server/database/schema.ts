import type Database from "better-sqlite3";

export function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      tick INTEGER NOT NULL DEFAULT 0,
      speed TEXT NOT NULL DEFAULT 'paused'
    );

    CREATE TABLE IF NOT EXISTS empires (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      is_player INTEGER NOT NULL DEFAULT 0,
      energy REAL NOT NULL DEFAULT 0,
      minerals REAL NOT NULL DEFAULT 0,
      science REAL NOT NULL DEFAULT 0,
      alloys REAL NOT NULL DEFAULT 0,
      ai_state TEXT,
      home_system_id TEXT
    );

    CREATE TABLE IF NOT EXISTS star_systems (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      star_type TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hyperlanes (
      system_a TEXT NOT NULL,
      system_b TEXT NOT NULL,
      distance REAL NOT NULL,
      PRIMARY KEY (system_a, system_b),
      FOREIGN KEY (system_a) REFERENCES star_systems(id),
      FOREIGN KEY (system_b) REFERENCES star_systems(id)
    );

    CREATE TABLE IF NOT EXISTS planets (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL,
      name TEXT NOT NULL,
      size INTEGER NOT NULL,
      planet_type TEXT NOT NULL,
      role TEXT,
      owner_id TEXT,
      is_colonized INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (system_id) REFERENCES star_systems(id),
      FOREIGN KEY (owner_id) REFERENCES empires(id)
    );

    CREATE TABLE IF NOT EXISTS starbases (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL UNIQUE,
      owner_id TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (system_id) REFERENCES star_systems(id),
      FOREIGN KEY (owner_id) REFERENCES empires(id)
    );

    CREATE TABLE IF NOT EXISTS ships (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      ship_class TEXT NOT NULL,
      system_id TEXT NOT NULL,
      target_system_id TEXT,
      travel_progress REAL NOT NULL DEFAULT 0,
      hp REAL NOT NULL,
      max_hp REAL NOT NULL,
      shields REAL NOT NULL,
      max_shields REAL NOT NULL,
      armor REAL NOT NULL,
      max_armor REAL NOT NULL,
      attack REAL NOT NULL,
      speed REAL NOT NULL,
      is_alive INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (owner_id) REFERENCES empires(id),
      FOREIGN KEY (system_id) REFERENCES star_systems(id)
    );

    CREATE TABLE IF NOT EXISTS explored_systems (
      empire_id TEXT NOT NULL,
      system_id TEXT NOT NULL,
      PRIMARY KEY (empire_id, system_id),
      FOREIGN KEY (empire_id) REFERENCES empires(id),
      FOREIGN KEY (system_id) REFERENCES star_systems(id)
    );

    CREATE TABLE IF NOT EXISTS technologies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      cost REAL NOT NULL,
      effect_type TEXT NOT NULL,
      effect_value REAL NOT NULL,
      effect_target TEXT
    );

    CREATE TABLE IF NOT EXISTS empire_research (
      empire_id TEXT PRIMARY KEY,
      current_tech_id TEXT,
      accumulated_science REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (empire_id) REFERENCES empires(id),
      FOREIGN KEY (current_tech_id) REFERENCES technologies(id)
    );

    CREATE TABLE IF NOT EXISTS empire_technologies (
      empire_id TEXT NOT NULL,
      tech_id TEXT NOT NULL,
      PRIMARY KEY (empire_id, tech_id),
      FOREIGN KEY (empire_id) REFERENCES empires(id),
      FOREIGN KEY (tech_id) REFERENCES technologies(id)
    );

    CREATE TABLE IF NOT EXISTS game_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tick INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}'
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_ships_owner ON ships(owner_id);
    CREATE INDEX IF NOT EXISTS idx_ships_system ON ships(system_id);
    CREATE INDEX IF NOT EXISTS idx_planets_system ON planets(system_id);
    CREATE INDEX IF NOT EXISTS idx_explored_empire ON explored_systems(empire_id);
    CREATE INDEX IF NOT EXISTS idx_events_tick ON game_events(tick);
  `);
}
