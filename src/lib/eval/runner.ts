import { randomUUID } from "crypto";
import { AGENT_META } from "./agents";
import { scoreTrace } from "./evaluators";
import { listScenarios, getScenario } from "./scenarios";
import { simulateScenario } from "./simulator";
import type {
  AgentVersion,
  EvalRun,
  MetricId,
  ScenarioResult,
} from "./types";

export function failureTagsFor(result: ScenarioResult): string[] {
  const tags: string[] = [];
  for (const s of result.scores) {
    if (!effectivePass(s)) tags.push(`fail:${s.metricId}`);
  }
  if (result.trace.events.some((e) => e.toolCall && !e.toolCall.ok)) {
    tags.push("tool_error_observed");
  }
  if (result.trace.escalated) tags.push("escalated");
  return tags;
}

export function effectivePass(score: {
  pass: boolean;
  humanOverride?: { pass: boolean };
}): boolean {
  return score.humanOverride?.pass ?? score.pass;
}

export function effectiveScore(score: {
  score: number;
  humanOverride?: { score: number };
}): number {
  return score.humanOverride?.score ?? score.score;
}

export function summarize(results: ScenarioResult[]): EvalRun["summary"] {
  const metrics: MetricId[] = [
    "task_completion",
    "critical_entity_accuracy",
    "escalation_appropriateness",
    "false_completion",
    "next_step_clarity",
  ];
  const byMetric = {} as EvalRun["summary"]["byMetric"];
  for (const m of metrics) {
    const scores = results.map((r) => r.scores.find((s) => s.metricId === m)!);
    const pass = scores.filter((s) => effectivePass(s)).length;
    const avg =
      scores.reduce((a, s) => a + effectiveScore(s), 0) / Math.max(scores.length, 1);
    byMetric[m] = { pass, fail: scores.length - pass, avg: Number(avg.toFixed(3)) };
  }
  const passed = results.filter((r) => r.overallPass).length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    byMetric,
  };
}

export function runEvaluation(opts: {
  agentVersion: AgentVersion;
  name?: string;
  scenarioIds?: string[];
  notes?: string;
}): EvalRun {
  const scenarios = opts.scenarioIds?.length
    ? opts.scenarioIds.map((id) => getScenario(id)!).filter(Boolean)
    : listScenarios();

  const results: ScenarioResult[] = scenarios.map((scenario) => {
    const trace = simulateScenario(scenario, opts.agentVersion);
    const scores = scoreTrace(scenario, trace);
    const overallPass = scores.every((s) => effectivePass(s));
    const result: ScenarioResult = {
      scenarioId: scenario.id,
      agentVersion: opts.agentVersion,
      trace,
      scores,
      overallPass,
      failureTags: [],
    };
    result.failureTags = failureTagsFor(result);
    return result;
  });

  const meta = AGENT_META[opts.agentVersion];
  return {
    id: randomUUID(),
    name:
      opts.name ??
      `${meta.label} eval — ${new Date().toISOString().slice(0, 19).replace("T", " ")}`,
    agentVersion: opts.agentVersion,
    createdAt: new Date().toISOString(),
    notes: opts.notes,
    results,
    summary: summarize(results),
  };
}

export function compareRuns(a: EvalRun, b: EvalRun) {
  const ids = new Set([
    ...a.results.map((r) => r.scenarioId),
    ...b.results.map((r) => r.scenarioId),
  ]);
  const rows = [...ids].map((scenarioId) => {
    const ar = a.results.find((r) => r.scenarioId === scenarioId);
    const br = b.results.find((r) => r.scenarioId === scenarioId);
    const metricDeltas: Record<string, { a: number; b: number; delta: number }> = {};
    const metrics: MetricId[] = [
      "task_completion",
      "critical_entity_accuracy",
      "escalation_appropriateness",
      "false_completion",
      "next_step_clarity",
    ];
    for (const m of metrics) {
      const as = ar ? effectiveScore(ar.scores.find((s) => s.metricId === m)!) : 0;
      const bs = br ? effectiveScore(br.scores.find((s) => s.metricId === m)!) : 0;
      metricDeltas[m] = { a: as, b: bs, delta: Number((bs - as).toFixed(3)) };
    }
    return {
      scenarioId,
      aPass: ar?.overallPass ?? false,
      bPass: br?.overallPass ?? false,
      regression: Boolean(ar?.overallPass && br && !br.overallPass),
      improvement: Boolean(ar && !ar.overallPass && br?.overallPass),
      metricDeltas,
      aTags: ar?.failureTags ?? [],
      bTags: br?.failureTags ?? [],
    };
  });

  return {
    a: { id: a.id, name: a.name, agentVersion: a.agentVersion, summary: a.summary },
    b: { id: b.id, name: b.name, agentVersion: b.agentVersion, summary: b.summary },
    rows,
    regressions: rows.filter((r) => r.regression).map((r) => r.scenarioId),
    improvements: rows.filter((r) => r.improvement).map((r) => r.scenarioId),
  };
}
