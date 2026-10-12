"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  DifficultyBadge,
  PassFailBadge,
  VersionBadge,
} from "@/components/eval/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

type MetricScore = {
  metricId: string;
  score: number;
  pass: boolean;
  rationale: string;
  evidence: string[];
  judgeRaw?: string;
  humanOverride?: {
    score: number;
    pass: boolean;
    note: string;
    at: string;
  };
};

export type EnrichedResult = {
  scenarioId: string;
  overallPass: boolean;
  failureTags: string[];
  scores: MetricScore[];
  scenario: {
    title: string;
    workflow: string;
    difficulty: string;
    callerGoal: string;
    expected: { successDefinition: string; requiresEscalation: boolean };
  } | null;
  trace: {
    claimedOutcome: string;
    escalated: boolean;
    escalationReason?: string;
    endedBy: string;
    finalState: Record<string, unknown>;
    events: {
      id: string;
      role: string;
      content: string;
      toolCall?: {
        name: string;
        args: Record<string, unknown>;
        result: Record<string, unknown>;
        ok: boolean;
        latencyMs: number;
      };
    }[];
  };
};

export type RunDetailData = {
  id: string;
  name: string;
  agentVersion: string;
  createdAt: string;
  notes?: string;
  summary: { total: number; passed: number; failed: number };
  results: EnrichedResult[];
};

function effectivePass(s: MetricScore) {
  return s.humanOverride?.pass ?? s.pass;
}

export function RunDetailView({ run }: { run: RunDetailData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected =
    searchParams.get("scenario") ?? run.results[0]?.scenarioId ?? "";
  const [metricForOverride, setMetricForOverride] = useState("next_step_clarity");
  const [note, setNote] = useState("");
  const [overridePass, setOverridePass] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(
    () => run.results.find((r) => r.scenarioId === selected) ?? run.results[0] ?? null,
    [run, selected]
  );

  const submitOverride = () => {
    if (!selected || !note.trim()) return;
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/runs/${run.id}/annotate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId: selected,
          metricId: metricForOverride,
          score: overridePass ? 1 : 0,
          pass: overridePass,
          note,
        }),
      });
      if (!res.ok) {
        setError("Annotation failed");
        return;
      }
      setNote("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <VersionBadge version={run.agentVersion} />
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            All runs
          </Link>
        </Button>
      </div>
      {error ? <p className="text-sm text-[var(--coral)]">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit border-[var(--line)] bg-[var(--panel)]/90">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Scenarios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-2 pt-0">
            {run.results.map((r) => (
              <Link
                key={r.scenarioId}
                href={`/runs/${run.id}?scenario=${encodeURIComponent(r.scenarioId)}`}
                className={cn(
                  "block w-full rounded-md px-3 py-2 text-left text-sm transition",
                  selected === r.scenarioId
                    ? "bg-[var(--sea)] text-[var(--foam)]"
                    : "hover:bg-[var(--wash)]"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">
                    {r.scenario?.title ?? r.scenarioId}
                  </span>
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      r.overallPass ? "bg-emerald-300" : "bg-orange-300",
                      selected === r.scenarioId
                        ? r.overallPass
                          ? "bg-[var(--foam)]"
                          : "bg-[#ffd0c4]"
                        : ""
                    )}
                  />
                </div>
                <div
                  className={cn(
                    "mono mt-0.5 truncate text-[10px]",
                    selected === r.scenarioId
                      ? "text-[color:rgba(232,244,241,0.75)]"
                      : "text-[var(--mute)]"
                  )}
                >
                  {r.scenarioId}
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {result ? (
          <div className="space-y-4 animate-rise">
            <Card className="border-[var(--line)] bg-[var(--panel)]/90">
              <CardContent className="space-y-3 py-5">
                <div className="flex flex-wrap items-center gap-2">
                  <PassFailBadge pass={result.overallPass} />
                  {result.scenario ? (
                    <DifficultyBadge difficulty={result.scenario.difficulty} />
                  ) : null}
                  <span className="mono text-xs text-[var(--mute)]">
                    {result.scenarioId}
                  </span>
                </div>
                <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
                  {result.scenario?.title ?? result.scenarioId}
                </h2>
                <p className="text-sm text-[var(--mute)]">
                  {result.scenario?.callerGoal}
                </p>
                <p className="text-sm">
                  <span className="text-[var(--mute)]">Success means: </span>
                  {result.scenario?.expected.successDefinition}
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded bg-[var(--wash)] px-2 py-1 mono">
                    claimed={result.trace.claimedOutcome}
                  </span>
                  <span className="rounded bg-[var(--wash)] px-2 py-1 mono">
                    endedBy={result.trace.endedBy}
                  </span>
                  {result.trace.escalated ? (
                    <span className="rounded bg-[color:rgba(196,92,58,0.12)] px-2 py-1 mono text-[var(--coral)]">
                      escalated:{result.trace.escalationReason}
                    </span>
                  ) : null}
                </div>
                {result.failureTags.length ? (
                  <div className="flex flex-wrap gap-1">
                    {result.failureTags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-[var(--wash)] px-2 py-0.5 text-[11px] text-[var(--mute)]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Tabs
              value={searchParams.get("tab") ?? "trace"}
              onValueChange={(tab) => {
                router.push(
                  `/runs/${run.id}?scenario=${encodeURIComponent(selected)}&tab=${tab}`
                );
              }}
            >
              <TabsList className="bg-[var(--panel)]">
                <TabsTrigger value="trace">Trace</TabsTrigger>
                <TabsTrigger value="metrics">Metrics</TabsTrigger>
                <TabsTrigger value="state">Tool state</TabsTrigger>
                <TabsTrigger value="review">Human review</TabsTrigger>
              </TabsList>

              <TabsContent value="trace" className="mt-3">
                <Card className="border-[var(--line)] bg-[var(--panel)]/90">
                  <CardContent className="space-y-3 py-5">
                    {result.trace.events.map((e) => (
                      <div
                        key={e.id}
                        className={cn(
                          "rounded-lg border px-3 py-2",
                          e.role === "caller" &&
                            "border-[var(--line)] bg-white/70",
                          e.role === "agent" &&
                            "border-[color:rgba(31,122,108,0.25)] bg-[color:rgba(31,122,108,0.06)]",
                          e.role === "tool" &&
                            "border-dashed border-[var(--line)] bg-[var(--wash)]"
                        )}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span className="mono text-[10px] uppercase tracking-wider text-[var(--mute)]">
                            {e.role}
                          </span>
                          {e.toolCall ? (
                            <span
                              className={cn(
                                "mono text-[10px]",
                                e.toolCall.ok
                                  ? "text-[var(--sea-deep)]"
                                  : "text-[var(--coral)]"
                              )}
                            >
                              {e.toolCall.name} · {e.toolCall.ok ? "ok" : "error"} ·{" "}
                              {e.toolCall.latencyMs}ms
                            </span>
                          ) : null}
                        </div>
                        <div className="text-sm leading-relaxed">{e.content}</div>
                        {e.toolCall ? (
                          <pre className="mono mt-2 overflow-x-auto rounded bg-[var(--ink)]/95 p-2 text-[11px] text-[var(--foam)]">
                            {JSON.stringify(
                              { args: e.toolCall.args, result: e.toolCall.result },
                              null,
                              2
                            )}
                          </pre>
                        ) : null}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="metrics" className="mt-3 space-y-3">
                {result.scores.map((s) => (
                  <Card
                    key={s.metricId}
                    className="border-[var(--line)] bg-[var(--panel)]/90"
                  >
                    <CardContent className="space-y-2 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{s.metricId}</span>
                        <PassFailBadge pass={effectivePass(s)} />
                        <span className="mono text-xs text-[var(--mute)]">
                          score={(s.humanOverride?.score ?? s.score).toFixed(2)}
                          {s.humanOverride ? " (override)" : ""}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--mute)]">{s.rationale}</p>
                      <ul className="space-y-1 text-xs text-[var(--ink)]">
                        {s.evidence.map((ev, i) => (
                          <li key={i} className="mono">
                            · {ev}
                          </li>
                        ))}
                      </ul>
                      {s.judgeRaw ? (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-[var(--mute)]">
                            Judge raw output
                          </summary>
                          <pre className="mono mt-2 overflow-x-auto rounded bg-[var(--wash)] p-2">
                            {s.judgeRaw}
                          </pre>
                        </details>
                      ) : null}
                      {s.humanOverride ? (
                        <p className="text-xs text-[var(--sea-deep)]">
                          Human override: {s.humanOverride.note} (
                          {new Date(s.humanOverride.at).toLocaleString()})
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="state" className="mt-3">
                <Card className="border-[var(--line)] bg-[var(--panel)]/90">
                  <CardContent className="py-4">
                    <pre className="mono overflow-x-auto text-xs">
                      {JSON.stringify(result.trace.finalState, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="review" className="mt-3">
                <Card className="border-[var(--line)] bg-[var(--panel)]/90">
                  <CardHeader>
                    <CardTitle className="text-base">
                      Override a metric score
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <Label>Metric</Label>
                      <select
                        className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
                        value={metricForOverride}
                        onChange={(e) => setMetricForOverride(e.target.value)}
                      >
                        {result.scores.map((s) => (
                          <option key={s.metricId} value={s.metricId}>
                            {s.metricId}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={overridePass ? "default" : "outline"}
                        onClick={() => setOverridePass(true)}
                      >
                        Mark pass
                      </Button>
                      <Button
                        type="button"
                        variant={!overridePass ? "default" : "outline"}
                        onClick={() => setOverridePass(false)}
                      >
                        Mark fail
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <Label>Note (required)</Label>
                      <Textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Why are you overriding the automated score?"
                      />
                    </div>
                    <Button
                      onClick={submitOverride}
                      disabled={pending || !note.trim()}
                    >
                      Save override
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </div>
    </div>
  );
}
