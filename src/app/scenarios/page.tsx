import { AppShell } from "@/components/app-shell";
import { DifficultyBadge } from "@/components/eval/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { listScenarios } from "@/lib/eval/scenarios";

export default function ScenariosPage() {
  const scenarios = listScenarios();

  return (
    <AppShell
      title="Scenario dataset"
      subtitle="Two workflows — appointment scheduling and prescription refill — mixing ordinary, difficult, safety, and control cases. Synthetic only; not a prevalence sample."
    >
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        {(["ordinary", "difficult", "safety", "control"] as const).map((d) => (
          <div
            key={d}
            className="animate-rise rounded-lg border border-[var(--line)] bg-[var(--panel)]/90 px-3 py-3"
          >
            <div className="text-xs uppercase tracking-wide text-[var(--mute)]">
              {d}
            </div>
            <div className="font-[family-name:var(--font-display)] text-2xl">
              {scenarios.filter((s) => s.difficulty === d).length}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {scenarios.map((s, i) => (
          <Card
            key={s.id}
            className={`animate-rise${i % 3 === 1 ? "-delay-1" : i % 3 === 2 ? "-delay-2" : ""} border-[var(--line)] bg-[var(--panel)]/90`}
          >
            <CardContent className="space-y-3 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <DifficultyBadge difficulty={s.difficulty} />
                <span className="rounded bg-[var(--wash)] px-2 py-0.5 text-[11px] capitalize text-[var(--mute)]">
                  {s.workflow.replace(/_/g, " ")}
                </span>
                <span className="mono text-[11px] text-[var(--mute)]">{s.id}</span>
              </div>
              <h2 className="font-[family-name:var(--font-display)] text-xl">
                {s.title}
              </h2>
              <p className="text-sm text-[var(--mute)]">{s.rationale}</p>
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-[var(--mute)]">
                    Caller goal
                  </div>
                  <p>{s.callerGoal}</p>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-[var(--mute)]">
                    Success definition
                  </div>
                  <p>{s.expected.successDefinition}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {s.expected.criticalEntities.map((e) => (
                  <span key={e} className="rounded-full bg-[var(--wash)] px-2 py-1 mono">
                    entity:{e}
                  </span>
                ))}
                {s.expected.requiresEscalation ? (
                  <span className="rounded-full bg-[color:rgba(196,92,58,0.12)] px-2 py-1 text-[var(--coral)]">
                    requires escalation
                    {s.expected.escalationReason
                      ? `: ${s.expected.escalationReason}`
                      : ""}
                  </span>
                ) : (
                  <span className="rounded-full bg-[color:rgba(31,122,108,0.12)] px-2 py-1 text-[var(--sea-deep)]">
                    automation OK
                  </span>
                )}
                {s.toolFault ? (
                  <span className="rounded-full bg-[color:rgba(184,135,44,0.16)] px-2 py-1 text-[var(--amber)]">
                    tool fault: {s.toolFault.tool}/{s.toolFault.mode}
                  </span>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
