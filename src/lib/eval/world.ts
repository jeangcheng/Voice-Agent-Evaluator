import { randomUUID } from "crypto";
import type { Scenario, ToolCall, ToolFault } from "./types";

export interface Appointment {
  id: string;
  type: string;
  provider: string;
  datetime: string;
  status: string;
}

export interface Prescription {
  id: string;
  medication: string;
  status: string;
  refillsRemaining: number;
  pharmacy: string;
  controlled: boolean;
}

export interface WorldState {
  patient: { mrn: string; name: string; dob: string } | null;
  appointments: Appointment[];
  availability: { datetime: string; provider: string }[];
  prescriptions: Prescription[];
  refillRequests: {
    rxId: string;
    medication: string;
    pharmacy: string;
    status: string;
  }[];
  escalations: {
    reason: string;
    notes: string;
    at: string;
  }[];
  callbacks: { reason: string; at: string }[];
  verifiedIdentity: boolean;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function createWorld(scenario: Scenario): WorldState {
  const sys = scenario.facts.system as {
    patient?: WorldState["patient"];
    appointments?: Appointment[];
    availability?: WorldState["availability"];
    prescriptions?: Prescription[];
  };
  return {
    patient: sys.patient ? clone(sys.patient) : null,
    appointments: clone(sys.appointments ?? []),
    availability: clone(sys.availability ?? []),
    prescriptions: clone(sys.prescriptions ?? []),
    refillRequests: [],
    escalations: [],
    callbacks: [],
    verifiedIdentity: false,
  };
}

export function flattenState(world: WorldState): Record<string, unknown> {
  const out: Record<string, unknown> = {
    verifiedIdentity: world.verifiedIdentity,
    "appointments.count": world.appointments.length,
    "refillRequests.count": world.refillRequests.length,
    "escalations.count": world.escalations.length,
    "callbacks.count": world.callbacks.length,
  };
  for (const a of world.appointments) {
    out[`appointments.${a.id}.status`] = a.status;
    out[`appointments.${a.id}.datetime`] = a.datetime;
    out[`appointments.${a.id}.provider`] = a.provider;
  }
  for (const p of world.prescriptions) {
    out[`prescriptions.${p.id}.medication`] = p.medication;
    out[`prescriptions.${p.id}.pharmacy`] = p.pharmacy;
    out[`prescriptions.${p.id}.controlled`] = p.controlled;
  }
  for (const r of world.refillRequests) {
    out[`refillRequests.${r.rxId}.status`] = r.status;
    out[`refillRequests.${r.rxId}.medication`] = r.medication;
    out[`refillRequests.${r.rxId}.pharmacy`] = r.pharmacy;
  }
  if (world.escalations[0]) {
    out["escalations.latest.reason"] = world.escalations[0].reason;
  }
  return out;
}

export type ToolName =
  | "verify_identity"
  | "lookup_appointments"
  | "lookup_availability"
  | "confirm_appointment"
  | "reschedule_appointment"
  | "cancel_appointment"
  | "book_appointment"
  | "lookup_prescriptions"
  | "update_pharmacy"
  | "submit_refill"
  | "escalate"
  | "schedule_callback";

export interface ToolContext {
  world: WorldState;
  fault?: ToolFault;
}

function maybeFault(
  name: string,
  fault: ToolFault | undefined,
  okResult: Record<string, unknown>
): { ok: boolean; result: Record<string, unknown> } {
  if (fault && fault.tool === name) {
    if (fault.mode === "fail") {
      return {
        ok: false,
        result: { error: fault.message ?? "Simulated tool failure" },
      };
    }
    if (fault.mode === "wrong_result") {
      return { ok: true, result: { ...okResult, _corrupted: true } };
    }
  }
  return { ok: true, result: okResult };
}

export function executeTool(
  name: ToolName,
  args: Record<string, unknown>,
  ctx: ToolContext
): ToolCall {
  const started = Date.now();
  const id = randomUUID();
  const world = ctx.world;
  let ok = true;
  let result: Record<string, unknown> = {};

  switch (name) {
    case "verify_identity": {
      const nameArg = String(args.name ?? "");
      const dob = String(args.dob ?? "");
      const match =
        !!world.patient &&
        world.patient.name.toLowerCase() === nameArg.toLowerCase() &&
        world.patient.dob === dob;
      world.verifiedIdentity = match;
      result = {
        verified: match,
        mrn: match ? world.patient!.mrn : null,
      };
      ok = match;
      break;
    }
    case "lookup_appointments": {
      if (!world.verifiedIdentity) {
        ok = false;
        result = { error: "Identity not verified" };
        break;
      }
      result = { appointments: clone(world.appointments) };
      break;
    }
    case "lookup_availability": {
      const provider = args.provider ? String(args.provider) : null;
      const slots = world.availability.filter(
        (s) => !provider || s.provider === provider
      );
      result = { slots };
      break;
    }
    case "confirm_appointment": {
      if (!world.verifiedIdentity) {
        ok = false;
        result = { error: "Identity not verified" };
        break;
      }
      const appt = world.appointments.find((a) => a.id === String(args.appointmentId));
      if (!appt) {
        ok = false;
        result = { error: "Appointment not found" };
        break;
      }
      const faulted = maybeFault(name, ctx.fault, {});
      if (!faulted.ok) {
        ok = false;
        result = faulted.result;
        break;
      }
      appt.status = "confirmed";
      result = { appointment: clone(appt) };
      break;
    }
    case "reschedule_appointment": {
      if (!world.verifiedIdentity) {
        ok = false;
        result = { error: "Identity not verified" };
        break;
      }
      const appt = world.appointments.find((a) => a.id === String(args.appointmentId));
      const datetime = String(args.datetime ?? "");
      if (!appt) {
        ok = false;
        result = { error: "Appointment not found" };
        break;
      }
      const faulted = maybeFault(name, ctx.fault, {});
      if (!faulted.ok) {
        ok = false;
        result = faulted.result;
        break;
      }
      appt.datetime = datetime;
      appt.status = "rescheduled";
      result = { appointment: clone(appt) };
      break;
    }
    case "cancel_appointment": {
      if (!world.verifiedIdentity) {
        ok = false;
        result = { error: "Identity not verified" };
        break;
      }
      const appt = world.appointments.find((a) => a.id === String(args.appointmentId));
      if (!appt) {
        ok = false;
        result = { error: "Appointment not found" };
        break;
      }
      appt.status = "cancelled";
      result = { appointment: clone(appt) };
      break;
    }
    case "book_appointment": {
      if (!world.verifiedIdentity) {
        ok = false;
        result = { error: "Identity not verified" };
        break;
      }
      const faulted = maybeFault(name, ctx.fault, {});
      if (!faulted.ok) {
        ok = false;
        result = faulted.result;
        break;
      }
      const appt: Appointment = {
        id: `APT-NEW-${world.appointments.length + 1}`,
        type: String(args.type ?? "Visit"),
        provider: String(args.provider ?? ""),
        datetime: String(args.datetime ?? ""),
        status: "scheduled",
      };
      world.appointments.push(appt);
      result = { appointment: clone(appt) };
      break;
    }
    case "lookup_prescriptions": {
      if (!world.verifiedIdentity) {
        ok = false;
        result = { error: "Identity not verified" };
        break;
      }
      result = { prescriptions: clone(world.prescriptions) };
      break;
    }
    case "update_pharmacy": {
      if (!world.verifiedIdentity) {
        ok = false;
        result = { error: "Identity not verified" };
        break;
      }
      const rx = world.prescriptions.find((p) => p.id === String(args.rxId));
      if (!rx) {
        ok = false;
        result = { error: "Prescription not found" };
        break;
      }
      rx.pharmacy = String(args.pharmacy ?? "");
      result = { prescription: clone(rx) };
      break;
    }
    case "submit_refill": {
      if (!world.verifiedIdentity) {
        ok = false;
        result = { error: "Identity not verified" };
        break;
      }
      const rx = world.prescriptions.find((p) => p.id === String(args.rxId));
      if (!rx) {
        ok = false;
        result = { error: "Prescription not found" };
        break;
      }
      if (rx.controlled) {
        ok = false;
        result = {
          error: "Controlled substance — cannot auto-refill",
          requiresEscalation: true,
        };
        break;
      }
      const faulted = maybeFault(name, ctx.fault, {});
      if (!faulted.ok) {
        ok = false;
        result = faulted.result;
        break;
      }
      const req = {
        rxId: rx.id,
        medication: rx.medication,
        pharmacy: rx.pharmacy,
        status: "submitted",
      };
      world.refillRequests.push(req);
      rx.refillsRemaining = Math.max(0, rx.refillsRemaining - 1);
      result = { refillRequest: clone(req) };
      break;
    }
    case "escalate": {
      const reason = String(args.reason ?? "unspecified");
      const notes = String(args.notes ?? "");
      world.escalations.push({
        reason,
        notes,
        at: new Date().toISOString(),
      });
      result = { escalated: true, reason, notes };
      break;
    }
    case "schedule_callback": {
      const reason = String(args.reason ?? "unspecified");
      world.callbacks.push({ reason, at: new Date().toISOString() });
      result = { callbackScheduled: true, reason };
      break;
    }
    default: {
      ok = false;
      result = { error: `Unknown tool: ${name}` };
    }
  }

  const latencyMs =
    ctx.fault?.tool === name && ctx.fault.mode === "delay" ? 2500 : 40 + Math.floor(Math.random() * 60);

  return {
    id,
    name,
    args,
    result,
    ok,
    latencyMs: Date.now() - started + latencyMs > 3000 ? latencyMs : Math.max(latencyMs, 1),
  };
}
