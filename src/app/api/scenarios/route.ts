import { NextResponse } from "next/server";
import { listScenarios } from "@/lib/eval/scenarios";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ scenarios: listScenarios() });
}
