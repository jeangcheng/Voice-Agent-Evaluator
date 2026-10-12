import { randomUUID } from "crypto";
import { createMemory, runAgentTurn, type AgentMemory } from "./agents";
import type { AgentVersion, Scenario, Trace, TraceEvent } from "./types";
import { createWorld, flattenState, type WorldState } from "./world";

const MAX_TURNS = 8;

/**
 * Text replay harness.
 *
 * Real: deterministic agent policies, tool world state, injected faults, scripted caller.
 * Mocked/omitted: ASR/TTS, barge-in audio timing, telephony, LLM patient variability (optional later).
 *
 * Non-determinism: tool latency jitter only; outcomes are deterministic for a given agent version + scenario.
 */
export function simulateScenario(
  scenario: Scenario,
  agentVersion: AgentVersion
): Trace {
  const world: WorldState = createWorld(scenario);
  const memory: AgentMemory = createMemory();
  const events: TraceEvent[] = [];
  const fault = scenario.toolFault;
  const ctx = { world, fault };

  const push = (partial: Omit<TraceEvent, "id" | "ts">) => {
    events.push({
      id: randomUUID(),
      ts: Date.now(),
      ...partial,
    });
  };

  let scriptIndex = 0;
  const nextCaller = (when: string): string | null => {
    // Prefer matching `when`, else fall through to next after_agent line
    const exact = scenario.callerScript.find(
      (t, i) => i >= scriptIndex && t.when === when
    );
    if (exact) {
      scriptIndex = scenario.callerScript.indexOf(exact) + 1;
      return exact.say;
    }
    const next = scenario.callerScript[scriptIndex];
    if (next && (next.when === "after_agent" || next.when === when)) {
      scriptIndex += 1;
      return next.say;
    }
    // For open already consumed, allow remaining lines in order
    if (next) {
      scriptIndex += 1;
      return next.say;
    }
    return null;
  };

  // Opening caller turn
  let callerText =
    nextCaller("open") ??
    `Hi, I'm ${scenario.facts.caller.name}, DOB ${scenario.facts.caller.dob}. ${scenario.callerGoal}`;
  push({ role: "caller", content: callerText });

  let endedBy: Trace["endedBy"] = "max_turns";
  let claimedOutcome = "in_progress";
  let escalated = false;
  let escalationReason: string | undefined;

  for (let i = 0; i < MAX_TURNS; i++) {
    const whenHint = memory.lastToolError
      ? "on_tool_error"
      : memory.offeredSlot && !memory.awaitingConfirm
        ? "on_slot_offer"
        : memory.awaitingConfirm
          ? "on_confirm_ask"
          : memory.escalated
            ? "on_escalation"
            : "after_agent";

    // After first turn, pull next caller line before agent if we need more caller input
    // Actually flow: caller -> agent -> caller -> agent...
    // First iteration already has caller. Subsequent: get caller response to previous agent.
    if (i > 0) {
      const nxt = nextCaller(whenHint) ?? nextCaller("after_agent");
      if (!nxt) {
        // If agent not done but no more script, send a generic confirm/ack
        if (!memory.finished) {
          callerText = "Yes, please go ahead.";
          push({ role: "caller", content: callerText });
        } else {
          endedBy = "agent";
          break;
        }
      } else {
        callerText = nxt;
        push({ role: "caller", content: callerText });
      }
    }

    const result = runAgentTurn(
      agentVersion,
      scenario,
      world,
      memory,
      callerText,
      ctx
    );

    for (const tc of result.toolCalls) {
      push({
        role: "tool",
        content: `${tc.name} → ${tc.ok ? "ok" : "error"}`,
        toolCall: tc,
      });
    }
    push({
      role: "agent",
      content: result.speech,
      meta: { claimedOutcome: result.claimedOutcome },
    });

    claimedOutcome = result.claimedOutcome;
    escalated = result.escalated || escalated;
    escalationReason = result.escalationReason ?? escalationReason;

    if (result.done) {
      endedBy = result.escalated ? "escalation" : "agent";
      break;
    }
  }

  return {
    scenarioId: scenario.id,
    agentVersion,
    events,
    finalState: flattenState(world),
    claimedOutcome,
    escalated,
    escalationReason,
    endedBy,
  };
}
