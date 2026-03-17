import { getDatabase, closeDatabase } from "./connection.js";
import { createSchema } from "./schema.js";

function init(): void {
  const db = getDatabase();
  createSchema(db);

  // Insert default game state if not exists
  const existing = db.prepare("SELECT id FROM game_state WHERE id = 1").get();
  if (!existing) {
    db.prepare("INSERT INTO game_state (id, tick, speed) VALUES (1, 0, 'paused')").run();
  }

  console.log("Database initialized successfully.");
  closeDatabase();
}

init();
