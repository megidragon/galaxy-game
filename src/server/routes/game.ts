import { Router } from "express";
import type { GameEngine } from "../engine/GameEngine.js";
import type { GameAction } from "../../shared/types/index.js";

export function createGameRouter(engine: GameEngine): Router {
  const router = Router();

  // Get current game state summary
  router.get("/state", (_req, res) => {
    res.json({
      tick: engine.getTick(),
      speed: engine.getSpeed(),
    });
  });

  // Perform a game action
  router.post("/action", (req, res) => {
    const action = req.body as GameAction;
    if (!action || !action.type) {
      res.status(400).json({ error: "Invalid action" });
      return;
    }
    const result = engine.handleAction(action);
    if (!result.ok) {
      res.status(400).json(result);
      return;
    }
    res.json({ ...result, tick: engine.getTick() });
  });

  // Set game speed
  router.post("/speed", (req, res) => {
    const { speed } = req.body;
    if (!["paused", "slow", "normal", "fast"].includes(speed)) {
      res.status(400).json({ error: "Invalid speed value" });
      return;
    }
    engine.setSpeed(speed);
    res.json({ ok: true, speed: engine.getSpeed() });
  });

  return router;
}
