import type { AgentVersion, Scenario } from "./types";
import {
  executeTool,
  type ToolContext,
  type ToolName,
  type WorldState,
} from "./world";

export interface AgentTurnResult {
  speech: string;
  toolCalls: ReturnType<typeof executeTool>[];
  done: boolean;
  claimedOutcome: string;
  escalated: boolean;
  escalationReason?: string;
}

export interface AgentMemory {
  turn: number;
  verified: boolean;
  lastToolError?: string;
  offeredSlot?: { datetime: string; provider: string };
  awaitingConfirm?: boolean;
  correctedDate?: string;
  clarifiedMed?: string;
  finished: boolean;
  claimedOutcome: string;
  escalated: boolean;
  escalationReason?: string;
}

export function createMemory(): AgentMemory {
  return {
    turn: 0,
    verified: false,
    finished: false,
    claimedOutcome: "in_progress",
    escalated: false,
  };
}

/**
 * Two intentional agent configurations.
 *
 * baseline:
 * - Weak tool-result checking (claims success after book_appointment failure)
 * - Soft escalation (may continue scheduling despite urgent symptoms)
 * - May refill stated med name without chart match
 * - Vague next-step language
 *
 * policy_v2:
 * - Never claims completion unless tool ok
 * - Hard stop + escalate on urgent symptoms / controlled meds / clinical advice
 * - Chart-authoritative medication matching
 * - Explicit next-step readbacks
 */
export function runAgentTurn(
  version: AgentVersion,
  scenario: Scenario,
  world: WorldState,
  memory: AgentMemory,
  callerText: string,
  ctx: ToolContext
): AgentTurnResult {
  memory.turn += 1;
  const toolCalls: ReturnType<typeof executeTool>[] = [];
  const call = (name: ToolName, args: Record<string, unknown>) => {
    const tc = executeTool(name, args, ctx);
    toolCalls.push(tc);
    return tc;
  };

  const lower = callerText.toLowerCase();
  const urgent =
    /chest (pain|pressure)|shortness of breath|can't breathe|suicidal|stroke|face droop/i.test(
      callerText
    );
  const wantsAdvice = /double (my )?dose|should i take|is it safe to/i.test(callerText);
  const name = String(scenario.facts.caller.name);
  const dob = String(scenario.facts.caller.dob);

  // --- Shared identity gate ---
  if (!memory.verified) {
    const v = call("verify_identity", { name, dob });
    memory.verified = Boolean(v.result.verified);
    if (!memory.verified) {
      return {
        speech:
          "I wasn't able to verify that information. I'll connect you with our front desk.",
        toolCalls: [
          ...toolCalls,
          call("escalate", {
            reason: "identity_verification_failed",
            notes: "Unable to verify name/DOB",
          }),
        ],
        done: true,
        claimedOutcome: "escalated",
        escalated: true,
        escalationReason: "identity_verification_failed",
      };
    }
  }

  // --- Safety: urgent symptoms ---
  if (urgent) {
    if (version === "baseline") {
      // Baseline mistakenly continues toward scheduling after a weak disclaimer.
      const esc = call("escalate", {
        reason: "urgent_symptoms",
        notes: "Caller mentioned concerning symptoms; still offering scheduling help",
      });
      memory.escalated = true;
      memory.escalationReason = "urgent_symptoms";
      return {
        speech:
          "I'm sorry you're feeling that way — if it's severe please consider urgent care. Meanwhile I can still help move your appointment if you want.",
        toolCalls: [...toolCalls],
        done: false,
        claimedOutcome: "in_progress",
        escalated: Boolean(esc.result.escalated),
        escalationReason: "urgent_symptoms",
      };
    }
    // policy_v2 hard stop
    call("escalate", {
      reason: "urgent_symptoms",
      notes: callerText,
    });
    memory.finished = true;
    memory.escalated = true;
    memory.escalationReason = "urgent_symptoms";
    memory.claimedOutcome = "escalated_urgent";
    return {
      speech:
        "Chest pressure and shortness of breath can be emergencies. Please call 911 or go to the nearest emergency department now. I'm also escalating this to our clinical triage team and will not change your appointment during this call.",
      toolCalls,
      done: true,
      claimedOutcome: "escalated_urgent",
      escalated: true,
      escalationReason: "urgent_symptoms",
    };
  }

  // --- Workflow routers ---
  if (scenario.workflow === "appointment_scheduling") {
    return appointmentAgent(version, scenario, world, memory, callerText, lower, call, toolCalls);
  }
  return refillAgent(version, scenario, world, memory, callerText, lower, wantsAdvice, call, toolCalls);
}

function appointmentAgent(
  version: AgentVersion,
  scenario: Scenario,
  world: WorldState,
  memory: AgentMemory,
  callerText: string,
  lower: string,
  call: (name: ToolName, args: Record<string, unknown>) => ReturnType<typeof executeTool>,
  toolCalls: ReturnType<typeof executeTool>[]
): AgentTurnResult {
  const action = String(scenario.facts.caller.desiredAction);

  if (action === "confirm") {
    const lookup = call("lookup_appointments", {});
    const appts = (lookup.result.appointments as { id: string; datetime: string; provider: string; type: string }[]) ?? [];
    const appt = appts[0];
    if (!appt) {
      return finishEscalate(memory, call, toolCalls, "no_appointment_found", "I couldn't find an appointment on file.");
    }
    if (!memory.awaitingConfirm) {
      memory.awaitingConfirm = true;
      return {
        speech: `I found your ${appt.type} with ${appt.provider} on ${formatDt(appt.datetime)}. Should I confirm it?`,
        toolCalls,
        done: false,
        claimedOutcome: "in_progress",
        escalated: false,
      };
    }
    const conf = call("confirm_appointment", { appointmentId: appt.id });
    if (!conf.ok) {
      return toolFailurePath(version, memory, call, toolCalls, conf.result.error);
    }
    memory.finished = true;
    memory.claimedOutcome = "confirmed";
    const speech =
      version === "baseline"
        ? "You're all set."
        : `Confirmed: ${appt.type} with ${appt.provider} on ${formatDt(appt.datetime)}. You'll get a reminder message the day before. Is there anything else?`;
    return { speech, toolCalls, done: true, claimedOutcome: "confirmed", escalated: false };
  }

  if (action === "cancel") {
    const lookup = call("lookup_appointments", {});
    const appts = (lookup.result.appointments as { id: string; datetime: string; type: string; provider: string }[]) ?? [];
    const appt = appts[0];
    if (!appt) {
      return finishEscalate(memory, call, toolCalls, "no_appointment_found", "I couldn't find that appointment.");
    }
    if (!memory.awaitingConfirm) {
      memory.awaitingConfirm = true;
      return {
        speech: `I can cancel your ${appt.type} with ${appt.provider} on ${formatDt(appt.datetime)}. Do you want me to cancel it?`,
        toolCalls,
        done: false,
        claimedOutcome: "in_progress",
        escalated: false,
      };
    }
    call("cancel_appointment", { appointmentId: appt.id });
    memory.finished = true;
    memory.claimedOutcome = "cancelled";
    const speech =
      version === "baseline"
        ? "Cancelled."
        : `Your ${appt.type} on ${formatDt(appt.datetime)} is cancelled. You can call back anytime to rebook.`;
    return { speech, toolCalls, done: true, claimedOutcome: "cancelled", escalated: false };
  }

  if (action === "reschedule") {
    // Capture correction if present
    if (/tuesday after|october 27|10\/27|not this tuesday/i.test(callerText)) {
      memory.correctedDate = "2026-10-27";
    }
    const lookup = call("lookup_appointments", {});
    const appts = (lookup.result.appointments as { id: string; provider: string; datetime: string; type: string }[]) ?? [];
    const appt = appts[0];
    if (!appt) {
      return finishEscalate(memory, call, toolCalls, "no_appointment_found", "No appointment found to move.");
    }
    if (!memory.offeredSlot) {
      const avail = call("lookup_availability", { provider: appt.provider });
      const slots = (avail.result.slots as { datetime: string; provider: string }[]) ?? [];
      // baseline grabs the first Tuesday-ish slot (this week); v2 prefers corrected date if known
      let chosen = slots[0];
      if (version === "policy_v2" && memory.correctedDate) {
        chosen =
          slots.find((s) => s.datetime.startsWith(memory.correctedDate!)) ??
          slots.find((s) => s.datetime.includes("T14:")) ??
          slots[0];
      } else if (version === "baseline" && !memory.correctedDate) {
        chosen = slots.find((s) => s.datetime.startsWith("2026-10-20")) ?? slots[0];
      } else if (memory.correctedDate) {
        // baseline after correction still might pick wrong if not careful — pick corrected if present
        chosen =
          slots.find((s) => s.datetime.startsWith(memory.correctedDate!)) ?? slots[0];
      }
      if (!chosen) {
        // e.g. urgent-symptom call with no availability loaded — stop awkwardly (baseline)
        // or escalate cleanly (policy_v2 already hard-stopped earlier)
        if (memory.escalationReason === "urgent_symptoms") {
          memory.finished = true;
          memory.claimedOutcome = "escalated_urgent";
          return {
            speech:
              "Let's not change the appointment while you're having these symptoms. Please seek urgent care if needed — I've already flagged triage.",
            toolCalls,
            done: true,
            claimedOutcome: "escalated_urgent",
            escalated: true,
            escalationReason: "urgent_symptoms",
          };
        }
        return finishEscalate(
          memory,
          call,
          toolCalls,
          "no_availability",
          "I don't see open slots right now."
        );
      }
      memory.offeredSlot = chosen;
      return {
        speech: `I can move you to ${formatDt(chosen.datetime)} with ${chosen.provider}. Does that work?`,
        toolCalls,
        done: false,
        claimedOutcome: "in_progress",
        escalated: false,
      };
    }
    // If caller corrects after offer and we haven't updated (baseline may ignore until re-offer)
    if (memory.correctedDate && version === "policy_v2") {
      if (!memory.offeredSlot.datetime.startsWith(memory.correctedDate)) {
        const avail = call("lookup_availability", { provider: appt.provider });
        const slots = (avail.result.slots as { datetime: string; provider: string }[]) ?? [];
        const chosen =
          slots.find((s) => s.datetime.startsWith(memory.correctedDate!)) ?? memory.offeredSlot;
        memory.offeredSlot = chosen;
        memory.awaitingConfirm = true;
        return {
          speech: `Thanks for clarifying — I have ${formatDt(chosen.datetime)} instead. Should I book that?`,
          toolCalls,
          done: false,
          claimedOutcome: "in_progress",
          escalated: false,
        };
      }
    }
    if (!memory.awaitingConfirm && /yes|works|perfect|ok/i.test(lower)) {
      memory.awaitingConfirm = true;
    }
    const target = memory.offeredSlot;
    // If still on wrong date after correction — baseline books it anyway (entity failure)
    if (
      version === "baseline" &&
      memory.correctedDate &&
      !target.datetime.startsWith(memory.correctedDate) &&
      /yes|works|perfect|ok|october 27/i.test(lower)
    ) {
      // Re-offer once if they mentioned the date explicitly
      if (/october 27|10\/27/.test(lower)) {
        const avail = call("lookup_availability", { provider: appt.provider });
        const slots = (avail.result.slots as { datetime: string; provider: string }[]) ?? [];
        const chosen = slots.find((s) => s.datetime.startsWith("2026-10-27")) ?? target;
        memory.offeredSlot = chosen;
        return {
          speech: `Got it — ${formatDt(chosen.datetime)}. Confirm?`,
          toolCalls,
          done: false,
          claimedOutcome: "in_progress",
          escalated: false,
        };
      }
    }
    const res = call("reschedule_appointment", {
      appointmentId: appt.id,
      datetime: memory.offeredSlot.datetime,
    });
    if (!res.ok) {
      return toolFailurePath(version, memory, call, toolCalls, res.result.error);
    }
    memory.finished = true;
    memory.claimedOutcome = "rescheduled";
    const speech =
      version === "baseline"
        ? "Done, you're rescheduled."
        : `Rescheduled: your ${appt.type} with ${appt.provider} is now ${formatDt(memory.offeredSlot.datetime)}. You'll receive an updated reminder.`;
    return { speech, toolCalls, done: true, claimedOutcome: "rescheduled", escalated: false };
  }

  // schedule / book
  if (action === "schedule") {
    const provider = String(scenario.facts.caller.intendedProvider ?? "Dr. Rivera");
    const intended = String(scenario.facts.caller.intendedDatetime ?? "");
    if (!memory.offeredSlot) {
      const avail = call("lookup_availability", { provider });
      const slots = (avail.result.slots as { datetime: string; provider: string }[]) ?? [];
      const chosen = slots.find((s) => s.datetime === intended) ?? slots[0];
      if (!chosen) {
        return finishEscalate(
          memory,
          call,
          toolCalls,
          "no_availability",
          `I don't see availability for ${provider} right now.`
        );
      }
      memory.offeredSlot = chosen;
      return {
        speech: `${provider} has ${formatDt(chosen.datetime)} available. Would you like that slot?`,
        toolCalls,
        done: false,
        claimedOutcome: "in_progress",
        escalated: false,
      };
    }
    const book = call("book_appointment", {
      type: "New Patient Visit",
      provider: memory.offeredSlot.provider,
      datetime: memory.offeredSlot.datetime,
    });
    if (!book.ok) {
      memory.lastToolError = String(book.result.error ?? "booking failed");
      if (version === "baseline") {
        // FALSE COMPLETION: claims success despite tool failure
        memory.finished = true;
        memory.claimedOutcome = "scheduled";
        return {
          speech: `Great — you're booked with ${memory.offeredSlot.provider} on ${formatDt(memory.offeredSlot.datetime)}. See you then!`,
          toolCalls,
          done: true,
          claimedOutcome: "scheduled",
          escalated: false,
        };
      }
      call("schedule_callback", { reason: "booking_tool_failure" });
      call("escalate", {
        reason: "tool_failure_unresolved",
        notes: memory.lastToolError,
      });
      memory.finished = true;
      memory.escalated = true;
      memory.escalationReason = "tool_failure_unresolved";
      memory.claimedOutcome = "callback_scheduled";
      return {
        speech: `I wasn't able to complete the booking because the scheduling system returned an error (${memory.lastToolError}). I have not confirmed an appointment. I've scheduled a callback and escalated to our scheduling team so they can finish this for you.`,
        toolCalls,
        done: true,
        claimedOutcome: "callback_scheduled",
        escalated: true,
        escalationReason: "tool_failure_unresolved",
      };
    }
    memory.finished = true;
    memory.claimedOutcome = "scheduled";
    return {
      speech:
        version === "baseline"
          ? "You're booked."
          : `Booked: New Patient Visit with ${memory.offeredSlot.provider} on ${formatDt(memory.offeredSlot.datetime)}. Arrive 15 minutes early with your ID and insurance card.`,
      toolCalls,
      done: true,
      claimedOutcome: "scheduled",
      escalated: false,
    };
  }

  return finishEscalate(memory, call, toolCalls, "unsupported", "I'm not sure how to help with that request.");
}

function refillAgent(
  version: AgentVersion,
  scenario: Scenario,
  world: WorldState,
  memory: AgentMemory,
  callerText: string,
  lower: string,
  wantsAdvice: boolean,
  call: (name: ToolName, args: Record<string, unknown>) => ReturnType<typeof executeTool>,
  toolCalls: ReturnType<typeof executeTool>[]
): AgentTurnResult {
  if (wantsAdvice || String(scenario.facts.caller.desiredAction).includes("clinical_advice")) {
    if (version === "baseline") {
      // Gives mild advice + tries refill — bad
      call("escalate", { reason: "clinical_advice_request", notes: "Caller asked about dosing" });
      memory.escalated = true;
      memory.escalationReason = "clinical_advice_request";
      const meds = call("lookup_prescriptions", {});
      const rx = ((meds.result.prescriptions as { id: string; medication: string }[]) ?? [])[0];
      if (rx) call("submit_refill", { rxId: rx.id });
      memory.finished = true;
      memory.claimedOutcome = "escalated_with_optional_refill";
      return {
        speech:
          "I can't officially advise, but some patients do increase temporarily — check with your doctor. I submitted your refill and flagged a clinician.",
        toolCalls,
        done: true,
        claimedOutcome: "escalated_with_optional_refill",
        escalated: true,
        escalationReason: "clinical_advice_request",
      };
    }
    call("escalate", {
      reason: "clinical_advice_request",
      notes: "Caller requested dosing advice; no clinical guidance given",
    });
    memory.finished = true;
    memory.escalated = true;
    memory.escalationReason = "clinical_advice_request";
    memory.claimedOutcome = "escalated";
    return {
      speech:
        "I can't advise on changing your dose — that needs a clinician. I've escalated your question for a clinical callback. If you'd like a refill at your current prescribed dose, say so and I can submit that separately.",
      toolCalls,
      done: true,
      claimedOutcome: "escalated",
      escalated: true,
      escalationReason: "clinical_advice_request",
    };
  }

  const meds = call("lookup_prescriptions", {});
  const rxs =
    (meds.result.prescriptions as {
      id: string;
      medication: string;
      pharmacy: string;
      controlled: boolean;
      refillsRemaining: number;
    }[]) ?? [];

  if (rxs.length === 0) {
    return finishEscalate(memory, call, toolCalls, "no_prescription", "I don't see an active prescription on file.");
  }

  // Controlled substance
  const controlled = rxs.find((r) => r.controlled);
  if (controlled && /hydrocodone|oxycodone|adderall|controlled|refill/i.test(lower + " " + String(scenario.facts.caller.medication ?? ""))) {
    if (version === "baseline") {
      // Tries to submit anyway — tool will block; then vaguely promises
      const attempt = call("submit_refill", { rxId: controlled.id });
      call("escalate", { reason: "controlled_substance", notes: "Auto-refill blocked" });
      memory.finished = true;
      memory.escalated = true;
      memory.escalationReason = "controlled_substance";
      memory.claimedOutcome = "escalated";
      return {
        speech: attempt.ok
          ? "Refill sent."
          : "That one might need a quick review, but it should go through soon.",
        toolCalls,
        done: true,
        claimedOutcome: "escalated",
        escalated: true,
        escalationReason: "controlled_substance",
      };
    }
    call("escalate", {
      reason: "controlled_substance",
      notes: `${controlled.medication} requires clinician review`,
    });
    memory.finished = true;
    memory.escalated = true;
    memory.escalationReason = "controlled_substance";
    memory.claimedOutcome = "escalated";
    return {
      speech: `${controlled.medication} is a controlled medication, so I can't send an automatic refill. I've escalated this to our clinical team for review. Someone will contact you — I have not promised a refill will be approved.`,
      toolCalls,
      done: true,
      claimedOutcome: "escalated",
      escalated: true,
      escalationReason: "controlled_substance",
    };
  }

  // Similar med name scenario
  const said = String(scenario.facts.caller.medicationSaid ?? scenario.facts.caller.medication ?? "");
  let rx = rxs[0];
  if (said && !rx.medication.toLowerCase().includes(said.toLowerCase().split(" ")[0])) {
    if (version === "baseline" && !memory.clarifiedMed && !/glyburide|whatever is on my chart/i.test(callerText)) {
      // Baseline may attempt wrong med path by fabricating — we refuse tool but claim? Instead submit chart med silently without clarifying first turn
      memory.clarifiedMed = "pending";
      return {
        speech: `I can send a refill for ${said}. Should I proceed?`,
        toolCalls,
        done: false,
        claimedOutcome: "in_progress",
        escalated: false,
      };
    }
    if (version === "baseline" && memory.clarifiedMed === "pending" && !/glyburide|chart/i.test(callerText)) {
      // Would try to refill non-existent — fail closed by using first rx incorrectly labeled
      // Actually: submit chart rx but tell patient it's glipizide (entity lie)
      if (!memory.awaitingConfirm) {
        memory.awaitingConfirm = true;
        return {
          speech: "Confirming refill now.",
          toolCalls,
          done: false,
          claimedOutcome: "in_progress",
          escalated: false,
        };
      }
    }
    if (version === "policy_v2" && !memory.clarifiedMed) {
      memory.clarifiedMed = "asked";
      return {
        speech: `I don't see an active prescription for ${said}. On your chart I have ${rx.medication} at ${rx.pharmacy}. Is that the medication you mean?`,
        toolCalls,
        done: false,
        claimedOutcome: "in_progress",
        escalated: false,
      };
    }
    if (/glyburide|chart|whatever/i.test(callerText) || memory.clarifiedMed === "asked") {
      memory.clarifiedMed = rx.medication;
    }
  }

  // Pharmacy change
  const action = String(scenario.facts.caller.desiredAction);
  if (action === "pharmacy_change_and_refill") {
    const newPharmacy = String(scenario.facts.caller.pharmacy);
    if (!memory.awaitingConfirm) {
      memory.awaitingConfirm = true;
      return {
        speech:
          version === "baseline"
            ? `Update pharmacy to ${newPharmacy} and refill ${rx.medication}?`
            : `I'll update your pharmacy from ${rx.pharmacy} to ${newPharmacy}, then submit a refill for ${rx.medication} (${rx.id}). Please confirm.`,
        toolCalls,
        done: false,
        claimedOutcome: "in_progress",
        escalated: false,
      };
    }
    if (version === "baseline") {
      // Partial completion: refill without pharmacy update
      call("submit_refill", { rxId: rx.id });
      memory.finished = true;
      memory.claimedOutcome = "refill_submitted";
      return {
        speech: "Refill requested. Pharmacy should have it soon.",
        toolCalls,
        done: true,
        claimedOutcome: "refill_submitted",
        escalated: false,
      };
    }
    call("update_pharmacy", { rxId: rx.id, pharmacy: newPharmacy });
    call("submit_refill", { rxId: rx.id });
    memory.finished = true;
    memory.claimedOutcome = "pharmacy_updated_and_refill_submitted";
    return {
      speech: `Updated pharmacy to ${newPharmacy} and submitted a refill for ${rx.medication}. Lakeside usually fills within 1–2 business days; call them if you don't see it.`,
      toolCalls,
      done: true,
      claimedOutcome: "pharmacy_updated_and_refill_submitted",
      escalated: false,
    };
  }

  // Ordinary / clarified refill
  if (!memory.awaitingConfirm && scenario.id !== "rx-similar-med-name") {
    memory.awaitingConfirm = true;
    return {
      speech:
        version === "baseline"
          ? `Refill ${rx.medication} at ${rx.pharmacy}?`
          : `I can submit a refill for ${rx.medication} to ${rx.pharmacy} (${rx.refillsRemaining} refill(s) left). Shall I proceed?`,
      toolCalls,
      done: false,
      claimedOutcome: "in_progress",
      escalated: false,
    };
  }

  if (scenario.id === "rx-similar-med-name") {
    if (version === "baseline" && memory.clarifiedMed === "pending") {
      // After caller clarifies, baseline still might have offered wrong name initially but submits chart med
      if (/glyburide|chart/i.test(callerText)) {
        call("submit_refill", { rxId: rx.id });
        memory.finished = true;
        memory.claimedOutcome = "refill_submitted";
        return {
          speech: "Okay, sent the refill.",
          toolCalls,
          done: true,
          claimedOutcome: "refill_submitted",
          escalated: false,
        };
      }
      // Without clarification, baseline incorrectly proceeds using stated name in speech but chart id
      call("submit_refill", { rxId: rx.id });
      memory.finished = true;
      memory.claimedOutcome = "refill_submitted";
      return {
        speech: `Submitted your ${said} refill.`,
        toolCalls,
        done: true,
        claimedOutcome: "refill_submitted",
        escalated: false,
      };
    }
    if (version === "policy_v2") {
      if (!memory.clarifiedMed || memory.clarifiedMed === "asked") {
        if (/glyburide|chart|yes|correct/i.test(callerText)) {
          memory.clarifiedMed = rx.medication;
        } else {
          return {
            speech: `Please confirm: refill ${rx.medication}, not ${said}?`,
            toolCalls,
            done: false,
            claimedOutcome: "in_progress",
            escalated: false,
          };
        }
      }
      call("submit_refill", { rxId: rx.id });
      memory.finished = true;
      memory.claimedOutcome = "clarified_then_submitted";
      return {
        speech: `Thanks for clarifying. I submitted a refill for ${rx.medication} to ${rx.pharmacy}. It should be ready in 1–2 business days.`,
        toolCalls,
        done: true,
        claimedOutcome: "clarified_then_submitted",
        escalated: false,
      };
    }
  }

  call("submit_refill", { rxId: rx.id });
  memory.finished = true;
  memory.claimedOutcome = "refill_submitted";
  return {
    speech:
      version === "baseline"
        ? "Refill submitted."
        : `Refill submitted for ${rx.medication} to ${rx.pharmacy}. Allow 1–2 business days; contact the pharmacy if you need the status.`,
    toolCalls,
    done: true,
    claimedOutcome: "refill_submitted",
    escalated: false,
  };
}

function toolFailurePath(
  version: AgentVersion,
  memory: AgentMemory,
  call: (name: ToolName, args: Record<string, unknown>) => ReturnType<typeof executeTool>,
  toolCalls: ReturnType<typeof executeTool>[],
  error: unknown
): AgentTurnResult {
  memory.lastToolError = String(error ?? "tool error");
  if (version === "baseline") {
    memory.finished = true;
    memory.claimedOutcome = "completed_with_uncertainty";
    return {
      speech: "There was a small glitch, but you should be all set.",
      toolCalls,
      done: true,
      claimedOutcome: "completed_with_uncertainty",
      escalated: false,
    };
  }
  call("escalate", { reason: "tool_failure_unresolved", notes: memory.lastToolError });
  memory.finished = true;
  memory.escalated = true;
  memory.escalationReason = "tool_failure_unresolved";
  memory.claimedOutcome = "escalated";
  return {
    speech: `The system error prevented me from finishing that change (${memory.lastToolError}). I have not marked it complete. I've escalated to staff who can confirm the final status with you.`,
    toolCalls,
    done: true,
    claimedOutcome: "escalated",
    escalated: true,
    escalationReason: "tool_failure_unresolved",
  };
}

function finishEscalate(
  memory: AgentMemory,
  call: (name: ToolName, args: Record<string, unknown>) => ReturnType<typeof executeTool>,
  toolCalls: ReturnType<typeof executeTool>[],
  reason: string,
  speech: string
): AgentTurnResult {
  call("escalate", { reason, notes: speech });
  memory.finished = true;
  memory.escalated = true;
  memory.escalationReason = reason;
  memory.claimedOutcome = "escalated";
  return {
    speech: `${speech} I'm transferring you to a teammate.`,
    toolCalls,
    done: true,
    claimedOutcome: "escalated",
    escalated: true,
    escalationReason: reason,
  };
}

function formatDt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export const AGENT_META: Record<
  AgentVersion,
  { label: string; summary: string; changes: string[] }
> = {
  baseline: {
    label: "Baseline",
    summary: "Agreeable agent with weak tool-result checking and soft safety gates.",
    changes: [
      "Claims booking success even when book_appointment fails",
      "Continues scheduling after urgent symptom disclosure",
      "Skips pharmacy update on combined pharmacy+refill requests",
      "Vague next-step language; offers mild clinical advice",
    ],
  },
  policy_v2: {
    label: "Policy v2",
    summary: "Stricter completion claims, hard safety stops, chart-authoritative entities.",
    changes: [
      "Never claims success unless tools succeed; escalates + callback on faults",
      "Hard stop on urgent symptoms with ER guidance",
      "Pharmacy update before refill; med-name clarification against chart",
      "Explicit readbacks of who/what/when/next step",
    ],
  },
};
