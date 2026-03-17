import { Router } from "express";
import type Database from "better-sqlite3";
import { ResearchSystem } from "../systems/ResearchSystem.js";
import { EmpireManager } from "../entities/EmpireManager.js";

export function createResearchRouter(db: Database.Database): Router {
  const router = Router();
  const researchSystem = new ResearchSystem(db);
  const empireManager = new EmpireManager(db);

  // Get available tech choices for player
  router.get("/choices", (_req, res) => {
    const player = empireManager.getPlayerEmpire();
    if (!player) {
      res.status(404).json({ error: "No player empire" });
      return;
    }
    res.json(researchSystem.getAvailableChoices(player.id));
  });

  // Get current research state for player
  router.get("/state", (_req, res) => {
    const player = empireManager.getPlayerEmpire();
    if (!player) {
      res.status(404).json({ error: "No player empire" });
      return;
    }
    res.json(researchSystem.getResearchState(player.id));
  });

  // Get research state for any empire
  router.get("/state/:empireId", (req, res) => {
    res.json(researchSystem.getResearchState(req.params.empireId));
  });

  return router;
}
