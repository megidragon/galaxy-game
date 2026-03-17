import type Database from "better-sqlite3";
import { GameLoop } from "./GameLoop.js";
import type { GameAction, GameSpeed } from "../../shared/types/index.js";

export class GameEngine {
  private db: Database.Database;
  private loop: GameLoop;

  constructor(db: Database.Database) {
    this.db = db;

    // Load current state from DB
    const state = this.db
      .prepare("SELECT tick, speed FROM game_state WHERE id = 1")
      .get() as { tick: number; speed: GameSpeed } | undefined;

    this.loop = new GameLoop(state?.tick ?? 0, "paused");
    this.loop.onTick((tick) => this.processTick(tick));
  }

  start(speed: GameSpeed = "normal"): void {
    this.loop.setSpeed(speed);
    this.persistGameState();
  }

  pause(): void {
    this.loop.setSpeed("paused");
    this.persistGameState();
  }

  setSpeed(speed: GameSpeed): void {
    this.loop.setSpeed(speed);
    this.persistGameState();
  }

  getSpeed(): GameSpeed {
    return this.loop.getSpeed();
  }

  getTick(): number {
    return this.loop.getTick();
  }

  handleAction(action: GameAction): void {
    switch (action.type) {
      case "SET_SPEED":
        this.setSpeed(action.speed);
        break;
      // Other actions will be implemented in subsequent subtasks
      default:
        console.log(`Action not yet implemented: ${action.type}`);
    }
  }

  private processTick(tick: number): void {
    // Each subsystem will register its tick processing here
    // For now, just persist the tick counter
    this.persistTick(tick);
  }

  private persistTick(tick: number): void {
    this.db
      .prepare("UPDATE game_state SET tick = ? WHERE id = 1")
      .run(tick);
  }

  private persistGameState(): void {
    this.db
      .prepare("UPDATE game_state SET tick = ?, speed = ? WHERE id = 1")
      .run(this.loop.getTick(), this.loop.getSpeed());
  }

  destroy(): void {
    this.loop.destroy();
  }
}
