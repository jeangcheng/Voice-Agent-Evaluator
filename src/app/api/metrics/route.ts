import { NextResponse } from "next/server";
import { METRIC_DOCS } from "@/lib/eval/evaluators";
import { AGENT_META } from "@/lib/eval/agents";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ metrics: METRIC_DOCS, agents: AGENT_META });
}
