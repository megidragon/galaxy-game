import { Router } from "express";
import type Database from "better-sqlite3";
import { generateGalaxy, saveGalaxy, loadGalaxy, isGalaxyGenerated } from "../galaxy/index.js";

export function createGalaxyRouter(db: Database.Database): Router {
  const router = Router();

  // Get the full galaxy map (systems + hyperlanes)
  router.get("/map", (_req, res) => {
    const data = loadGalaxy(db);
    if (!data) {
      res.status(404).json({ error: "Galaxy not yet generated" });
      return;
    }
    res.json(data);
  });

  // Get a specific star system by ID
  router.get("/systems/:id", (req, res) => {
    const { id } = req.params;
    const system = db
      .prepare("SELECT * FROM star_systems WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    if (!system) {
      res.status(404).json({ error: "System not found" });
      return;
    }

    const planets = db
      .prepare("SELECT * FROM planets WHERE system_id = ?")
      .all(id);
    const hyperlanes = db
      .prepare("SELECT * FROM hyperlanes WHERE system_a = ? OR system_b = ?")
      .all(id, id);

    res.json({ system, planets, hyperlanes });
  });

  // Generate a new galaxy (resets existing)
  router.post("/generate", (req, res) => {
    const seed = req.body?.seed as number | undefined;

    // Clear existing galaxy data
    db.exec("DELETE FROM explored_systems");
    db.exec("DELETE FROM starbases");
    db.exec("DELETE FROM ships");
    db.exec("DELETE FROM planets");
    db.exec("DELETE FROM hyperlanes");
    db.exec("DELETE FROM star_systems");

    const data = generateGalaxy(seed);
    saveGalaxy(db, data);

    res.json({
      ok: true,
      systemCount: data.systems.length,
      hyperlaneCount: data.hyperlanes.length,
      totalPlanets: data.systems.reduce((sum, s) => sum + s.planets.length, 0),
    });
  });

  // Check if galaxy exists
  router.get("/status", (_req, res) => {
    const exists = isGalaxyGenerated(db);
    const count = exists
      ? (db.prepare("SELECT COUNT(*) as c FROM star_systems").get() as { c: number }).c
      : 0;
    res.json({ generated: exists, systemCount: count });
  });

  return router;
}
