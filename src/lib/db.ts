import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import type { EvalRun, ScenarioResult } from "./eval/types";
import { summarize } from "./eval/runner";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "eval.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.exec(`
    CREATE TABLE IF NOT EXISTS eval_runs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      agent_version TEXT NOT NULL,
      created_at TEXT NOT NULL,
      notes TEXT,
      summary_json TEXT NOT NULL,
      results_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS annotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      scenario_id TEXT NOT NULL,
      metric_id TEXT NOT NULL,
      score REAL NOT NULL,
      pass INTEGER NOT NULL,
      note TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  return _db;
}

export function saveRun(run: EvalRun): void {
  const db = getDb();
  db.prepare(
    `INSERT OR REPLACE INTO eval_runs (id, name, agent_version, created_at, notes, summary_json, results_json)
     VALUES (@id, @name, @agent_version, @created_at, @notes, @summary_json, @results_json)`
  ).run({
    id: run.id,
    name: run.name,
    agent_version: run.agentVersion,
    created_at: run.createdAt,
    notes: run.notes ?? null,
    summary_json: JSON.stringify(run.summary),
    results_json: JSON.stringify(run.results),
  });
}

function rowToRun(row: {
  id: string;
  name: string;
  agent_version: string;
  created_at: string;
  notes: string | null;
  summary_json: string;
  results_json: string;
}): EvalRun {
  const results = JSON.parse(row.results_json) as ScenarioResult[];
  // Apply latest annotations
  const anns = getDb()
    .prepare(
      `SELECT scenario_id, metric_id, score, pass, note, created_at FROM annotations
       WHERE run_id = ? ORDER BY id ASC`
    )
    .all(row.id) as {
    scenario_id: string;
    metric_id: string;
    score: number;
    pass: number;
    note: string;
    created_at: string;
  }[];

  for (const a of anns) {
    const result = results.find((r) => r.scenarioId === a.scenario_id);
    const score = result?.scores.find((s) => s.metricId === a.metric_id);
    if (score) {
      score.humanOverride = {
        score: a.score,
        pass: Boolean(a.pass),
        note: a.note,
        at: a.created_at,
      };
    }
    if (result) {
      result.overallPass = result.scores.every(
        (s) => s.humanOverride?.pass ?? s.pass
      );
    }
  }

  return {
    id: row.id,
    name: row.name,
    agentVersion: row.agent_version as EvalRun["agentVersion"],
    createdAt: row.created_at,
    notes: row.notes ?? undefined,
    results,
    summary: anns.length ? summarize(results) : JSON.parse(row.summary_json),
  };
}

export function listRuns(): EvalRun[] {
  const rows = getDb()
    .prepare(
      `SELECT id, name, agent_version, created_at, notes, summary_json, results_json
       FROM eval_runs ORDER BY created_at DESC`
    )
    .all() as Parameters<typeof rowToRun>[0][];
  return rows.map(rowToRun);
}

export function getRun(id: string): EvalRun | null {
  const row = getDb()
    .prepare(
      `SELECT id, name, agent_version, created_at, notes, summary_json, results_json
       FROM eval_runs WHERE id = ?`
    )
    .get(id) as Parameters<typeof rowToRun>[0] | undefined;
  return row ? rowToRun(row) : null;
}

export function deleteAllRuns(): void {
  const db = getDb();
  db.prepare(`DELETE FROM annotations`).run();
  db.prepare(`DELETE FROM eval_runs`).run();
}

export function addAnnotation(input: {
  runId: string;
  scenarioId: string;
  metricId: string;
  score: number;
  pass: boolean;
  note: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO annotations (run_id, scenario_id, metric_id, score, pass, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.runId,
      input.scenarioId,
      input.metricId,
      input.score,
      input.pass ? 1 : 0,
      input.note,
      new Date().toISOString()
    );
}

export function runCount(): number {
  const row = getDb().prepare(`SELECT COUNT(*) as c FROM eval_runs`).get() as {
    c: number;
  };
  return row.c;
}
