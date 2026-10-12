import { NextResponse } from "next/server";
import { getRun } from "@/lib/db";
import { compareRuns } from "@/lib/eval/runner";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const a = searchParams.get("a");
  const b = searchParams.get("b");
  if (!a || !b) {
    return NextResponse.json({ error: "Provide a and b run ids" }, { status: 400 });
  }
  const runA = getRun(a);
  const runB = getRun(b);
  if (!runA || !runB) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  return NextResponse.json({ comparison: compareRuns(runA, runB) });
}
