"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { PassFailBadge, VersionBadge } from "@/components/eval/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type RunSummary = {
  id: string;
  name: string;
  agentVersion: string;
  summary: { passed: number; total: number };
};

type Comparison = {
  a: {
    id: string;
    name: string;
    agentVersion: string;
    summary: {
      passed: number;
      total: number;
      byMetric: Record<string, { avg: number }>;
    };
  };
  b: {
    id: string;
    name: string;
    agentVersion: string;
    summary: {
      passed: number;
      total: number;
      byMetric: Record<string, { avg: number }>;
    };
  };
  rows: {
    scenarioId: string;
    aPass: boolean;
    bPass: boolean;
    regression: boolean;
    improvement: boolean;
    metricDeltas: Record<string, { a: number; b: number; delta: number }>;
  }[];
  regressions: string[];
  improvements: string[];
};

export function CompareClient({
  runs,
  initialA,
  initialB,
  initialComparison,
}: {
  runs: RunSummary[];
  initialA: string;
  initialB: string;
  initialComparison: Comparison | null;
}) {
  const [a, setA] = useState(initialA);
  const [b, setB] = useState(initialB);
  const [comparison, setComparison] = useState<Comparison | null>(initialComparison);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const compare = (runA: string, runB: string) => {
    if (!runA || !runB) return;
    startTransition(() => {
      void (async () => {
        setError(null);
        const res = await fetch(`/api/compare?a=${runA}&b=${runB}`);
        if (!res.ok) {
          setError("Compare failed");
          return;
        }
        const data = await res.json();
        setComparison(data.comparison);
      })();
    });
  };

  useEffect(() => {
    // Re-fetch only when selection diverges from the server-rendered pair
    if (!a || !b) return;
    if (
      initialComparison &&
      a === initialA &&
      b === initialB &&
      comparison === initialComparison
    ) {
      return;
    }
    compare(a, b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, b]);

  return (
    <>
      <Card className="mb-6 border-[var(--line)] bg-[var(--panel)]/90">
        <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <div className="text-xs uppercase tracking-wide text-[var(--mute)]">
              Run A (before)
            </div>
            <select
              className="h-9 w-full rounded-md border border-[var(--line)] bg-white px-2 text-sm"
              value={a}
              onChange={(e) => setA(e.target.value)}
            >
              <option value="" disabled>
                Select run
              </option>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 space-y-1">
            <div className="text-xs uppercase tracking-wide text-[var(--mute)]">
              Run B (after)
            </div>
            <select
              className="h-9 w-full rounded-md border border-[var(--line)] bg-white px-2 text-sm"
              value={b}
              onChange={(e) => setB(e.target.value)}
            >
              <option value="" disabled>
                Select run
              </option>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={() => compare(a, b)} disabled={pending || !a || !b}>
            Refresh diff
          </Button>
        </CardContent>
      </Card>

      {error ? <p className="mb-4 text-sm text-[var(--coral)]">{error}</p> : null}

      {!comparison && runs.length < 2 ? (
        <Card className="border-[var(--line)] bg-[var(--panel)]/90">
          <CardContent className="py-8 text-sm text-[var(--mute)]">
            Need at least two runs.{" "}
            <Link href="/" className="text-[var(--sea-deep)] underline">
              Seed the experiment
            </Link>{" "}
            from the home page.
          </CardContent>
        </Card>
      ) : null}

      {comparison ? (
        <div className="space-y-4 animate-rise">
          <div className="grid gap-3 sm:grid-cols-2">
            {[comparison.a, comparison.b].map((side, i) => (
              <Card key={side.id} className="border-[var(--line)] bg-[var(--panel)]/90">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <VersionBadge version={side.agentVersion} />
                    <span className="text-xs text-[var(--mute)]">
                      {i === 0 ? "A" : "B"}
                    </span>
                  </div>
                  <CardTitle className="text-base">{side.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="font-[family-name:var(--font-display)] text-3xl">
                    {side.summary.passed}/{side.summary.total}
                  </div>
                  <div className="text-xs text-[var(--mute)]">scenarios passed</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-md bg-[color:rgba(31,122,108,0.12)] px-3 py-1 text-[var(--sea-deep)]">
              Improvements: {comparison.improvements.length}
            </span>
            <span className="rounded-md bg-[color:rgba(196,92,58,0.12)] px-3 py-1 text-[var(--coral)]">
              Regressions: {comparison.regressions.length}
            </span>
          </div>

          <Card className="overflow-hidden border-[var(--line)] bg-[var(--panel)]/90">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--wash)] text-xs uppercase tracking-wide text-[var(--mute)]">
                    <tr>
                      <th className="px-4 py-3">Scenario</th>
                      <th className="px-4 py-3">A</th>
                      <th className="px-4 py-3">B</th>
                      <th className="px-4 py-3">Δ clarity</th>
                      <th className="px-4 py-3">Δ false_completion</th>
                      <th className="px-4 py-3">Δ task</th>
                      <th className="px-4 py-3">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.rows.map((row) => (
                      <tr key={row.scenarioId} className="border-t border-[var(--line)]">
                        <td className="px-4 py-3">
                          <Link
                            href={`/runs/${comparison.b.id}`}
                            className="mono text-xs text-[var(--sea-deep)] underline"
                          >
                            {row.scenarioId}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <PassFailBadge pass={row.aPass} />
                        </td>
                        <td className="px-4 py-3">
                          <PassFailBadge pass={row.bPass} />
                        </td>
                        <td className="px-4 py-3 mono text-xs">
                          {fmtDelta(row.metricDeltas.next_step_clarity?.delta)}
                        </td>
                        <td className="px-4 py-3 mono text-xs">
                          {fmtDelta(row.metricDeltas.false_completion?.delta)}
                        </td>
                        <td className="px-4 py-3 mono text-xs">
                          {fmtDelta(row.metricDeltas.task_completion?.delta)}
                        </td>
                        <td className="px-4 py-3">
                          {row.improvement ? (
                            <span className="text-[var(--sea-deep)]">improved</span>
                          ) : row.regression ? (
                            <span className="text-[var(--coral)]">regressed</span>
                          ) : (
                            <span className="text-[var(--mute)]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}

function fmtDelta(d?: number) {
  if (d === undefined) return "—";
  const cls =
    d > 0
      ? "text-[var(--sea-deep)]"
      : d < 0
        ? "text-[var(--coral)]"
        : "text-[var(--mute)]";
  const sign = d > 0 ? "+" : "";
  return (
    <span className={cn(cls)}>
      {sign}
      {d.toFixed(2)}
    </span>
  );
}
