import { AppShell } from "@/components/app-shell";
import { CompareClient } from "@/components/eval/compare-client";
import { listRuns } from "@/lib/db";
import { compareRuns } from "@/lib/eval/runner";

export const dynamic = "force-dynamic";

export default function ComparePage() {
  const all = listRuns();
  const runs = all.map((r) => ({
    id: r.id,
    name: r.name,
    agentVersion: r.agentVersion,
    summary: { passed: r.summary.passed, total: r.summary.total },
  }));

  const baseline = all.find((r) => r.agentVersion === "baseline");
  const v2 = all.find((r) => r.agentVersion === "policy_v2");
  const initialA = baseline?.id ?? all[1]?.id ?? "";
  const initialB = v2?.id ?? all[0]?.id ?? "";

  const initialComparison =
    baseline && v2 ? compareRuns(baseline, v2) : null;

  return (
    <AppShell
      title="Compare runs"
      subtitle="Diff scenario pass/fail and per-metric deltas between two agent configurations."
    >
      <CompareClient
        runs={runs}
        initialA={initialA}
        initialB={initialB}
        initialComparison={initialComparison}
      />
    </AppShell>
  );
}
