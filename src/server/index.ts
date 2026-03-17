import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { getDatabase } from "./database/connection.js";
import { createSchema } from "./database/schema.js";
import { GameEngine } from "./engine/GameEngine.js";
import { createGameRouter } from "./routes/game.js";
import { createGalaxyRouter } from "./routes/galaxy.js";
import { isGalaxyGenerated, generateGalaxy, saveGalaxy, loadGalaxy } from "./galaxy/index.js";
import { createEmpiresRouter } from "./routes/empires.js";
import { createShipsRouter } from "./routes/ships.js";
import { setupNewGame } from "./entities/GameSetup.js";
import { EmpireManager } from "./entities/EmpireManager.js";
import { createResearchRouter } from "./routes/research.js";
import { CONFIG } from "../shared/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function main(): void {
  // Initialize database
  const db = getDatabase();
  createSchema(db);

  // Ensure game_state row exists
  const existing = db.prepare("SELECT id FROM game_state WHERE id = 1").get();
  if (!existing) {
    db.prepare("INSERT INTO game_state (id, tick, speed) VALUES (1, 0, 'paused')").run();
  }

  // Generate galaxy on first run
  if (!isGalaxyGenerated(db)) {
    console.log("No galaxy found. Generating new galaxy...");
    const galaxyData = generateGalaxy();
    saveGalaxy(db, galaxyData);
    console.log(
      `Galaxy generated: ${galaxyData.systems.length} systems, ` +
      `${galaxyData.hyperlanes.length} hyperlanes, ` +
      `${galaxyData.systems.reduce((s, sys) => s + sys.planets.length, 0)} planets`
    );

    // Set up empires and starting ships
    setupNewGame(db, galaxyData.systems);
    const empireManager = new EmpireManager(db);
    const empires = empireManager.getAllEmpires();
    console.log(`Created ${empires.length} empires (1 player + ${empires.length - 1} AI)`);
  }

  // Create game engine
  const engine = new GameEngine(db);

  // Set up Express
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Serve static client files
  const publicDir = path.resolve(__dirname, "../../public");
  app.use(express.static(publicDir));

  // API routes
  app.use("/api/game", createGameRouter(engine));
  app.use("/api/galaxy", createGalaxyRouter(db));
  app.use("/api/empires", createEmpiresRouter(db));
  app.use("/api/ships", createShipsRouter(db));
  app.use("/api/research", createResearchRouter(db));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", tick: engine.getTick() });
  });

  // Start server
  const { port, host } = CONFIG.server;
  app.listen(port, () => {
    console.log(`Galaxy Game server running at http://${host}:${port}`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log("Shutting down...");
    engine.destroy();
    db.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
