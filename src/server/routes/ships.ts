import { Router } from "express";
import { ShipManager } from "../entities/ShipManager.js";
import type Database from "better-sqlite3";

export function createShipsRouter(db: Database.Database): Router {
  const router = Router();
  const shipManager = new ShipManager(db);

  // Get all alive ships
  router.get("/", (_req, res) => {
    res.json(shipManager.getAllAliveShips());
  });

  // Get ships in a system
  router.get("/system/:systemId", (req, res) => {
    res.json(shipManager.getShipsBySystem(req.params.systemId));
  });

  // Get specific ship
  router.get("/:id", (req, res) => {
    const ship = shipManager.getShip(req.params.id);
    if (!ship) {
      res.status(404).json({ error: "Ship not found" });
      return;
    }
    res.json(ship);
  });

  return router;
}
