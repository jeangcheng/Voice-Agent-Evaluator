/** Core types for the Kyron evaluation platform. */

export type Workflow =
  | "appointment_scheduling"
  | "prescription_refill";

export type Difficulty = "ordinary" | "difficult" | "control" | "safety";

export type AgentVersion = "baseline" | "policy_v2";

export type Role = "caller" | "agent" | "system" | "tool";

export interface ScenarioFact {
  /** What the caller knows and will volunteer or confirm. */
  caller: Record<string, string | number | boolean | null>;
  /** What the agent/tools can see in the simulated EHR. */
  system: Record<string, unknown>;
  /** Facts intentionally unavailable to someone in the call. */
  unavailable?: string[];
}

export interface ExpectedOutcome {
  /** High-level success definition for this scenario. */
  successDefinition: string;
  /** Critical entities that must be correct if automation proceeds. */
  criticalEntities: string[];
  /** Whether escalation/transfer/callback is required. */
  requiresEscalation: boolean;
  escalationReason?: string;
  /** Expected final tool-side state keys (compared by evaluators). */
  expectedToolState?: Record<string, unknown>;
  /** Acceptable terminal outcomes (any one is OK). */
  acceptableOutcomes: string[];
}

export interface Scenario {
  id: string;
  title: string;
  workflow: Workflow;
  difficulty: Difficulty;
  /** Why this scenario is in the eval set. */
  rationale: string;
  callerGoal: string;
  /** Scripted caller turns / behavior hints for the simulator. */
  callerScript: CallerTurn[];
  facts: ScenarioFact;
  policy: string[];
  expected: ExpectedOutcome;
  /** Injected tool failure for this scenario (if any). */
  toolFault?: ToolFault;
}

export interface CallerTurn {
  when: "open" | "after_agent" | "on_slot_offer" | "on_confirm_ask" | "on_escalation" | "on_tool_error";
  say: string;
  /** Optional structured correction the caller will insist on. */
  assert?: Record<string, string>;
}

export interface ToolFault {
  tool: string;
  mode: "fail" | "delay" | "wrong_result";
  message?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
  ok: boolean;
  latencyMs: number;
}

export interface TraceEvent {
  id: string;
  ts: number;
  role: Role;
  content: string;
  toolCall?: ToolCall;
  meta?: Record<string, unknown>;
}

export interface Trace {
  scenarioId: string;
  agentVersion: AgentVersion;
  events: TraceEvent[];
  finalState: Record<string, unknown>;
  claimedOutcome: string;
  escalated: boolean;
  escalationReason?: string;
  endedBy: "agent" | "caller" | "max_turns" | "escalation";
}

export type MetricId =
  | "task_completion"
  | "critical_entity_accuracy"
  | "escalation_appropriateness"
  | "false_completion"
  | "next_step_clarity";

export interface MetricScore {
  metricId: MetricId;
  score: number; // 0..1
  pass: boolean;
  rationale: string;
  evidence: string[];
  /** Raw judge output when applicable. */
  judgeRaw?: string;
  /** Whether a human later overrode this score. */
  humanOverride?: {
    score: number;
    pass: boolean;
    note: string;
    at: string;
  };
}

export interface ScenarioResult {
  scenarioId: string;
  agentVersion: AgentVersion;
  trace: Trace;
  scores: MetricScore[];
  overallPass: boolean;
  failureTags: string[];
}

export interface EvalRun {
  id: string;
  name: string;
  agentVersion: AgentVersion;
  createdAt: string;
  notes?: string;
  results: ScenarioResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    byMetric: Record<MetricId, { pass: number; fail: number; avg: number }>;
  };
}

export interface ClarityLabel {
  traceKey: string; // `${runId}:${scenarioId}` or synthetic id
  scenarioId: string;
  agentVersion: AgentVersion;
  humanScore: number;
  humanPass: boolean;
  humanRationale: string;
  decisionBoundary: string;
}
