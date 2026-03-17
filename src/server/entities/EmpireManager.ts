import type Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import type { Empire, EmpireId, Resources, AIState, SystemId } from "../../shared/types/index.js";
import { CONFIG } from "../../shared/config.js";

export class EmpireManager {
  constructor(private db: Database.Database) {}

  createEmpire(params: {
    name: string;
    color: string;
    isPlayer: boolean;
    homeSystemId: SystemId;
    resources?: Partial<Resources>;
  }): Empire {
    const id = uuidv4();
    const resources = {
      ...CONFIG.startingResources,
      ...params.resources,
    };

    this.db
      .prepare(
        `INSERT INTO empires (id, name, color, is_player, energy, minerals, science, alloys, ai_state, home_system_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        params.name,
        params.color,
        params.isPlayer ? 1 : 0,
        resources.energy,
        resources.minerals,
        resources.science,
        resources.alloys,
        params.isPlayer ? null : "explore",
        params.homeSystemId
      );

    // Mark home system as explored
    this.db
      .prepare("INSERT OR IGNORE INTO explored_systems (empire_id, system_id) VALUES (?, ?)")
      .run(id, params.homeSystemId);

    // Initialize research state
    this.db
      .prepare("INSERT INTO empire_research (empire_id, accumulated_science) VALUES (?, 0)")
      .run(id);

    return {
      id,
      name: params.name,
      color: params.color,
      isPlayer: params.isPlayer,
      resources,
      aiState: params.isPlayer ? null : "explore",
      homeSystemId: params.homeSystemId,
    };
  }

  getEmpire(id: EmpireId): Empire | null {
    const row = this.db
      .prepare("SELECT * FROM empires WHERE id = ?")
      .get(id) as EmpireRow | undefined;
    return row ? this.rowToEmpire(row) : null;
  }

  getAllEmpires(): Empire[] {
    const rows = this.db
      .prepare("SELECT * FROM empires")
      .all() as EmpireRow[];
    return rows.map((r) => this.rowToEmpire(r));
  }

  getPlayerEmpire(): Empire | null {
    const row = this.db
      .prepare("SELECT * FROM empires WHERE is_player = 1")
      .get() as EmpireRow | undefined;
    return row ? this.rowToEmpire(row) : null;
  }

  updateResources(id: EmpireId, delta: Partial<Resources>): void {
    const sets: string[] = [];
    const values: number[] = [];

    if (delta.energy !== undefined) {
      sets.push("energy = energy + ?");
      values.push(delta.energy);
    }
    if (delta.minerals !== undefined) {
      sets.push("minerals = minerals + ?");
      values.push(delta.minerals);
    }
    if (delta.science !== undefined) {
      sets.push("science = science + ?");
      values.push(delta.science);
    }
    if (delta.alloys !== undefined) {
      sets.push("alloys = alloys + ?");
      values.push(delta.alloys);
    }

    if (sets.length > 0) {
      this.db
        .prepare(`UPDATE empires SET ${sets.join(", ")} WHERE id = ?`)
        .run(...values, id);
    }
  }

  setResources(id: EmpireId, resources: Resources): void {
    this.db
      .prepare("UPDATE empires SET energy = ?, minerals = ?, science = ?, alloys = ? WHERE id = ?")
      .run(resources.energy, resources.minerals, resources.science, resources.alloys, id);
  }

  setAIState(id: EmpireId, state: AIState): void {
    this.db.prepare("UPDATE empires SET ai_state = ? WHERE id = ?").run(state, id);
  }

  markSystemExplored(empireId: EmpireId, systemId: SystemId): void {
    this.db
      .prepare("INSERT OR IGNORE INTO explored_systems (empire_id, system_id) VALUES (?, ?)")
      .run(empireId, systemId);
  }

  isSystemExplored(empireId: EmpireId, systemId: SystemId): boolean {
    const row = this.db
      .prepare("SELECT 1 FROM explored_systems WHERE empire_id = ? AND system_id = ?")
      .get(empireId, systemId);
    return !!row;
  }

  getExploredSystems(empireId: EmpireId): SystemId[] {
    const rows = this.db
      .prepare("SELECT system_id FROM explored_systems WHERE empire_id = ?")
      .all(empireId) as Array<{ system_id: string }>;
    return rows.map((r) => r.system_id);
  }

  private rowToEmpire(row: EmpireRow): Empire {
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      isPlayer: row.is_player === 1,
      resources: {
        energy: row.energy,
        minerals: row.minerals,
        science: row.science,
        alloys: row.alloys,
      },
      aiState: row.ai_state as AIState | null,
      homeSystemId: row.home_system_id,
    };
  }
}

interface EmpireRow {
  id: string;
  name: string;
  color: string;
  is_player: number;
  energy: number;
  minerals: number;
  science: number;
  alloys: number;
  ai_state: string | null;
  home_system_id: string;
}
