import type Database from "better-sqlite3";
import type { EmpireId, TechId, Technology } from "../../shared/types/index.js";
import { TECH_TREE } from "./TechTree.js";
import { CONFIG } from "../../shared/config.js";

interface ResearchRow {
  empire_id: string;
  current_tech_id: string | null;
  accumulated_science: number;
}

export class ResearchSystem {
  constructor(private db: Database.Database) {
    // Seed tech definitions if not present
    this.seedTechnologies();
  }

  private seedTechnologies(): void {
    const count = this.db
      .prepare("SELECT COUNT(*) as c FROM technologies")
      .get() as { c: number };

    if (count.c === 0) {
      const insert = this.db.prepare(
        `INSERT INTO technologies (id, name, description, category, cost, effect_type, effect_value, effect_target)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const tx = this.db.transaction(() => {
        for (const tech of TECH_TREE) {
          insert.run(
            tech.id, tech.name, tech.description, tech.category,
            tech.cost, tech.effect.type, tech.effect.value, tech.effect.target ?? null
          );
        }
      });
      tx();
    }
  }

  processTick(): void {
    // For each empire with an active research, accumulate science
    const empires = this.db
      .prepare("SELECT * FROM empire_research WHERE current_tech_id IS NOT NULL")
      .all() as ResearchRow[];

    for (const row of empires) {
      // Get empire's science income
      const empire = this.db
        .prepare("SELECT science FROM empires WHERE id = ?")
        .get(row.empire_id) as { science: number } | undefined;

      if (!empire) continue;

      // Accumulate: science resource is the rate
      const scienceIncome = this.getEmpireScienceIncome(row.empire_id);
      const newAccumulated = row.accumulated_science + scienceIncome;

      // Check if research is complete
      const tech = this.getTechnology(row.current_tech_id!);
      if (tech && newAccumulated >= tech.cost) {
        // Research complete!
        this.db
          .prepare("INSERT OR IGNORE INTO empire_technologies (empire_id, tech_id) VALUES (?, ?)")
          .run(row.empire_id, row.current_tech_id);

        // Reset research state
        this.db
          .prepare("UPDATE empire_research SET current_tech_id = NULL, accumulated_science = 0 WHERE empire_id = ?")
          .run(row.empire_id);
      } else {
        // Update accumulated science
        this.db
          .prepare("UPDATE empire_research SET accumulated_science = ? WHERE empire_id = ?")
          .run(newAccumulated, row.empire_id);
      }
    }
  }

  startResearch(
    empireId: EmpireId,
    techId: TechId
  ): { ok: boolean; error?: string } {
    // Verify tech exists
    const tech = this.getTechnology(techId);
    if (!tech) return { ok: false, error: "Technology not found" };

    // Check not already researched
    const alreadyResearched = this.db
      .prepare("SELECT 1 FROM empire_technologies WHERE empire_id = ? AND tech_id = ?")
      .get(empireId, techId);
    if (alreadyResearched) return { ok: false, error: "Already researched" };

    // Set as current research
    this.db
      .prepare("UPDATE empire_research SET current_tech_id = ?, accumulated_science = 0 WHERE empire_id = ?")
      .run(techId, empireId);

    return { ok: true };
  }

  getAvailableChoices(empireId: EmpireId): Technology[] {
    // Get already researched tech IDs
    const researched = this.db
      .prepare("SELECT tech_id FROM empire_technologies WHERE empire_id = ?")
      .all(empireId) as Array<{ tech_id: string }>;
    const researchedSet = new Set(researched.map((r) => r.tech_id));

    // Get current research
    const current = this.db
      .prepare("SELECT current_tech_id FROM empire_research WHERE empire_id = ?")
      .get(empireId) as { current_tech_id: string | null } | undefined;

    // Filter available techs
    const available = TECH_TREE.filter(
      (t) => !researchedSet.has(t.id) && t.id !== current?.current_tech_id
    );

    // Return random selection of CONFIG.research.choiceCount techs
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, CONFIG.research.choiceCount);
  }

  getResearchState(empireId: EmpireId): {
    currentTech: Technology | null;
    accumulated: number;
    researchedTechs: Technology[];
  } {
    const row = this.db
      .prepare("SELECT * FROM empire_research WHERE empire_id = ?")
      .get(empireId) as ResearchRow | undefined;

    const researchedRows = this.db
      .prepare("SELECT tech_id FROM empire_technologies WHERE empire_id = ?")
      .all(empireId) as Array<{ tech_id: string }>;

    const researchedTechs = researchedRows
      .map((r) => this.getTechnology(r.tech_id))
      .filter((t): t is Technology => t !== null);

    return {
      currentTech: row?.current_tech_id ? this.getTechnology(row.current_tech_id) : null,
      accumulated: row?.accumulated_science ?? 0,
      researchedTechs,
    };
  }

  getResearchedTechIds(empireId: EmpireId): Set<string> {
    const rows = this.db
      .prepare("SELECT tech_id FROM empire_technologies WHERE empire_id = ?")
      .all(empireId) as Array<{ tech_id: string }>;
    return new Set(rows.map((r) => r.tech_id));
  }

  private getTechnology(techId: TechId): Technology | null {
    return TECH_TREE.find((t) => t.id === techId) ?? null;
  }

  private getEmpireScienceIncome(empireId: EmpireId): number {
    // Count science planets
    const planets = this.db
      .prepare("SELECT COUNT(*) as c FROM planets WHERE owner_id = ? AND is_colonized = 1 AND role = 'science'")
      .get(empireId) as { c: number };

    return planets.c * CONFIG.planetProduction.science.science;
  }
}
