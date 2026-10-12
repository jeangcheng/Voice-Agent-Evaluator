import Link from "next/link";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { RunDetailView } from "@/components/eval/run-detail";
import { Button } from "@/components/ui/button";
import { getRun } from "@/lib/db";
import { getScenario } from "@/lib/eval/scenarios";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const run = getRun(id);
  if (!run) {
    return (
      <AppShell title="Run not found">
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </AppShell>
    );
  }

  const enriched = {
    id: run.id,
    name: run.name,
    agentVersion: run.agentVersion,
    createdAt: run.createdAt,
    notes: run.notes,
    summary: {
      total: run.summary.total,
      passed: run.summary.passed,
      failed: run.summary.failed,
    },
    results: run.results.map((r) => {
      const scenario = getScenario(r.scenarioId);
      return {
        ...r,
        scenario: scenario
          ? {
              title: scenario.title,
              workflow: scenario.workflow,
              difficulty: scenario.difficulty,
              callerGoal: scenario.callerGoal,
              expected: {
                successDefinition: scenario.expected.successDefinition,
                requiresEscalation: scenario.expected.requiresEscalation,
              },
            }
          : null,
      };
    }),
  };

  return (
    <AppShell
      title={run.name}
      subtitle={`${run.summary.passed}/${run.summary.total} scenarios passed · ${new Date(run.createdAt).toLocaleString()}`}
    >
      <Suspense fallback={<p className="text-sm text-[var(--mute)]">Loading detail…</p>}>
        <RunDetailView run={enriched} />
      </Suspense>
    </AppShell>
  );
}
