import type { MetricScore, Scenario, Trace } from "./types";

/**
 * next_step_clarity — judgment metric with an explicit path from human labels → automation.
 *
 * Decision boundary (v2, after disagreement review):
 * PASS if the final agent communication makes all of the following clear enough that a
 * reasonable patient would not need to ask "so am I done / what do I do now?":
 *   1) Status of the requested task (done / not done / needs human)
 *   2) Concrete next step or expectation (reminder, pharmacy timing, callback, ER, etc.)
 *   3) No contradictory success claim when work did not complete
 *
 * FAIL if status is vague ("you're all set", "should go through soon") without specifics,
 * or if the patient is left with unresolved tool failure and no recovery path stated.
 *
 * This automated judge is deterministic on purpose for the take-home (no API key required).
 * Optional OPENAI_API_KEY path can be added; saved labels + judge outputs remain the source of truth for calibration.
 */

export interface ClarityJudgeBreakdown {
  statusClarity: number;
  nextStepPresent: number;
  contradictionPenalty: number;
  vaguenessPenalty: number;
  rawScore: number;
  notes: string[];
}

export function judgeClarity(
  scenario: Scenario,
  trace: Trace
): ClarityJudgeBreakdown {
  const agentTurns = trace.events.filter((e) => e.role === "agent").map((e) => e.content);
  const final = agentTurns[agentTurns.length - 1] ?? "";
  const all = agentTurns.join("\n");
  const notes: string[] = [];

  let statusClarity = 0;
  const statusPatterns =
    /(confirmed|cancelled|rescheduled|booked|submitted|escalat|cannot|wasn't able|have not|will not|callback|911|emergency)/i;
  if (statusPatterns.test(final)) {
    statusClarity = 1;
    notes.push("Final turn contains an explicit status signal.");
  } else if (statusPatterns.test(all)) {
    statusClarity = 0.5;
    notes.push("Status signal present earlier but weak/absent in final turn.");
  } else {
    notes.push("No explicit status signal found.");
  }

  let nextStepPresent = 0;
  const nextPatterns =
    /(reminder|business day|arrive|call back|callback|911|emergency|clinical (team|triage|callback)|pharmacy|day before|someone will contact|transfer)/i;
  if (nextPatterns.test(final)) {
    nextStepPresent = 1;
    notes.push("Concrete next-step / expectation in final turn.");
  } else if (nextPatterns.test(all)) {
    nextStepPresent = 0.4;
    notes.push("Next-step language appeared earlier only.");
  } else {
    notes.push("No concrete next-step language.");
  }

  let contradictionPenalty = 0;
  const failedBook = trace.events.some(
    (e) => e.toolCall?.name === "book_appointment" && !e.toolCall.ok
  );
  if (failedBook && /booked|see you then|you're booked/i.test(final)) {
    contradictionPenalty = 0.8;
    notes.push("Contradiction: claimed booked after tool failure.");
  }
  if (
    scenario.expected.requiresEscalation &&
    /should go through soon|you're all set/i.test(final) &&
    !/escalat|review|cannot|can't/i.test(final)
  ) {
    contradictionPenalty = Math.max(contradictionPenalty, 0.5);
    notes.push("Soft promise under escalation requirement.");
  }

  let vaguenessPenalty = 0;
  if (/^(you're all set\.?|cancelled\.?|done,? you're rescheduled\.?|refill submitted\.?|you're booked\.?)$/i.test(final.trim())) {
    vaguenessPenalty = 0.5;
    notes.push("Ultra-short vague closing.");
  } else if (/all set|should be all set|should go through/i.test(final) && final.split(" ").length < 16) {
    vaguenessPenalty = 0.35;
    notes.push("Vague short closing.");
  }

  const rawScore = clamp(
    0.45 * statusClarity + 0.45 * nextStepPresent - contradictionPenalty - vaguenessPenalty,
    0,
    1
  );

  return {
    statusClarity,
    nextStepPresent,
    contradictionPenalty,
    vaguenessPenalty,
    rawScore,
    notes,
  };
}

export function evaluateNextStepClarity(scenario: Scenario, trace: Trace): MetricScore {
  const breakdown = judgeClarity(scenario, trace);
  const pass = breakdown.rawScore >= 0.7;
  return {
    metricId: "next_step_clarity",
    score: Number(breakdown.rawScore.toFixed(3)),
    pass,
    rationale: pass
      ? "Patient-facing close clarifies status and next step without contradiction."
      : "Close is vague, incomplete, or contradicts tool reality.",
    evidence: breakdown.notes,
    judgeRaw: JSON.stringify(breakdown, null, 2),
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
