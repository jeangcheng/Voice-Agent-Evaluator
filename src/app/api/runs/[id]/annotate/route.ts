import { NextResponse } from "next/server";
import { addAnnotation, getRun } from "@/lib/db";
import type { MetricId } from "@/lib/eval/types";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const run = getRun(id);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  const body = (await req.json()) as {
    scenarioId: string;
    metricId: MetricId;
    score: number;
    pass: boolean;
    note: string;
  };
  if (!body.scenarioId || !body.metricId || !body.note) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  addAnnotation({
    runId: id,
    scenarioId: body.scenarioId,
    metricId: body.metricId,
    score: body.score,
    pass: body.pass,
    note: body.note,
  });
  const updated = getRun(id);
  return NextResponse.json({ run: updated });
}
