import { NextResponse } from "next/server";
import { getRun } from "@/lib/db";
import { getScenario } from "@/lib/eval/scenarios";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const run = getRun(id);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  const enriched = {
    ...run,
    results: run.results.map((r) => ({
      ...r,
      scenario: getScenario(r.scenarioId) ?? null,
    })),
  };
  return NextResponse.json({ run: enriched });
}
