import { NextResponse } from "next/server";
import { listRuns, saveRun } from "@/lib/db";
import { runEvaluation } from "@/lib/eval/runner";
import type { AgentVersion } from "@/lib/eval/types";

export const runtime = "nodejs";

export async function GET() {
  const runs = listRuns().map((r) => ({
    id: r.id,
    name: r.name,
    agentVersion: r.agentVersion,
    createdAt: r.createdAt,
    notes: r.notes,
    summary: r.summary,
  }));
  return NextResponse.json({ runs });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    agentVersion?: AgentVersion;
    name?: string;
    scenarioIds?: string[];
    notes?: string;
  };
  const agentVersion = body.agentVersion ?? "baseline";
  const run = runEvaluation({
    agentVersion,
    name: body.name,
    scenarioIds: body.scenarioIds,
    notes: body.notes,
  });
  saveRun(run);
  return NextResponse.json({ run });
}
