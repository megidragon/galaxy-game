import { CONFIG } from "../../shared/config.js";
import type { GameSpeed } from "../../shared/types/index.js";

export type TickHandler = (tick: number) => void;

export class GameLoop {
  private tick = 0;
  private speed: GameSpeed = "paused";
  private timer: ReturnType<typeof setTimeout> | null = null;
  private handlers: TickHandler[] = [];

  constructor(initialTick = 0, initialSpeed: GameSpeed = "paused") {
    this.tick = initialTick;
    this.speed = initialSpeed;
  }

  onTick(handler: TickHandler): void {
    this.handlers.push(handler);
  }

  setSpeed(speed: GameSpeed): void {
    this.speed = speed;
    this.stop();
    if (speed !== "paused") {
      this.start();
    }
  }

  getSpeed(): GameSpeed {
    return this.speed;
  }

  getTick(): number {
    return this.tick;
  }

  private getIntervalMs(): number {
    switch (this.speed) {
      case "slow":
        return CONFIG.tick.slowMs;
      case "normal":
        return CONFIG.tick.normalMs;
      case "fast":
        return CONFIG.tick.fastMs;
      default:
        return 0;
    }
  }

  private start(): void {
    if (this.speed === "paused") return;

    const interval = this.getIntervalMs();
    const loop = () => {
      this.tick++;
      for (const handler of this.handlers) {
        handler(this.tick);
      }
      if (this.speed !== "paused") {
        this.timer = setTimeout(loop, interval);
      }
    };
    this.timer = setTimeout(loop, interval);
  }

  private stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  destroy(): void {
    this.stop();
    this.handlers = [];
  }
}
