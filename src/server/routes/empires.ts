import { Router } from "express";
import { EmpireManager } from "../entities/EmpireManager.js";
import { ShipManager } from "../entities/ShipManager.js";
import type Database from "better-sqlite3";

export function createEmpiresRouter(db: Database.Database): Router {
  const router = Router();
  const empireManager = new EmpireManager(db);
  const shipManager = new ShipManager(db);

  // List all empires
  router.get("/", (_req, res) => {
    res.json(empireManager.getAllEmpires());
  });

  // Get player empire
  router.get("/player", (_req, res) => {
    const empire = empireManager.getPlayerEmpire();
    if (!empire) {
      res.status(404).json({ error: "No player empire found" });
      return;
    }
    res.json(empire);
  });

  // Get specific empire
  router.get("/:id", (req, res) => {
    const empire = empireManager.getEmpire(req.params.id);
    if (!empire) {
      res.status(404).json({ error: "Empire not found" });
      return;
    }
    res.json(empire);
  });

  // Get empire's ships
  router.get("/:id/ships", (req, res) => {
    const ships = shipManager.getShipsByOwner(req.params.id);
    res.json(ships);
  });

  // Get empire's explored systems
  router.get("/:id/explored", (req, res) => {
    const systems = empireManager.getExploredSystems(req.params.id);
    res.json(systems);
  });

  return router;
}
