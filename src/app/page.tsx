import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { RunsActions } from "@/components/eval/runs-actions";
import { PassFailBadge, VersionBadge } from "@/components/eval/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listRuns } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const runs = listRuns().map((r) => ({
    id: r.id,
    name: r.name,
    agentVersion: r.agentVersion,
    createdAt: r.createdAt,
    notes: r.notes,
    summary: r.summary,
  }));

  return (
    <AppShell
      title="Evaluation runs"
      subtitle="Scenario → simulation → trace → scored result. Seed the Baseline vs Policy v2 experiment, or run a fresh eval."
      actions={<RunsActions />}
    >
      <div className="accent-line mb-6" />

      {runs.length === 0 ? (
        <Card className="animate-rise border-[var(--line)] bg-[var(--panel)]/90">
          <CardHeader>
            <CardTitle className="font-[family-name:var(--font-display)] text-2xl">
              No runs yet
            </CardTitle>
            <CardDescription>
              Seed the prepared Baseline vs Policy v2 experiment to populate traces,
              scores, and comparison artifacts — or run a single agent eval.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--mute)]">
              Use <strong>Seed experiment</strong> above, or run{" "}
              <span className="mono">npm run seed</span> in the terminal.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {runs.map((run, i) => (
            <Link
              key={run.id}
              href={`/runs/${run.id}`}
              className={`animate-rise${i === 1 ? "-delay-1" : i >= 2 ? "-delay-2" : ""} block`}
            >
              <Card className="border-[var(--line)] bg-[var(--panel)]/90 transition hover:border-[var(--sea)]/40 hover:shadow-sm">
                <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <VersionBadge version={run.agentVersion} />
                      <PassFailBadge
                        pass={run.summary.failed === 0}
                        label={`${run.summary.passed}/${run.summary.total} passed`}
                      />
                    </div>
                    <div className="truncate font-medium text-[var(--ink)]">
                      {run.name}
                    </div>
                    <div className="mono mt-1 text-xs text-[var(--mute)]">
                      {new Date(run.createdAt).toLocaleString()} · {run.id.slice(0, 8)}
                    </div>
                    {run.notes ? (
                      <p className="mt-2 line-clamp-2 text-sm text-[var(--mute)]">
                        {run.notes}
                      </p>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-5">
                    {Object.entries(run.summary.byMetric).map(([k, v]) => (
                      <div
                        key={k}
                        className="rounded-md bg-[var(--wash)] px-2 py-2 text-center"
                      >
                        <div className="mono text-[10px] uppercase tracking-wide text-[var(--mute)]">
                          {k.replace(/_/g, " ")}
                        </div>
                        <div className="mt-1 font-semibold text-[var(--ink)]">
                          {(v.avg * 100).toFixed(0)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
