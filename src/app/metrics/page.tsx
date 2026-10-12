import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AGENT_META } from "@/lib/eval/agents";
import { METRIC_DOCS } from "@/lib/eval/evaluators";

export default function MetricsPage() {
  return (
    <AppShell
      title="What we measure"
      subtitle="Metrics chosen for healthcare voice risk — completion reality, entity correctness, escalation policy, false completion, and patient-facing next-step clarity. Intentionally not measuring generic conversational niceness."
    >
      <div className="mb-8 grid gap-3 md:grid-cols-2">
        {Object.entries(AGENT_META).map(([id, meta]) => (
          <Card key={id} className="border-[var(--line)] bg-[var(--panel)]/90">
            <CardHeader>
              <CardTitle className="font-[family-name:var(--font-display)] text-xl">
                {meta.label}
                <span className="mono ml-2 text-xs font-normal text-[var(--mute)]">
                  {id}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-[var(--mute)]">{meta.summary}</p>
              <ul className="space-y-1">
                {meta.changes.map((c) => (
                  <li key={c}>· {c}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        {Object.entries(METRIC_DOCS).map(([id, doc]) => (
          <Card key={id} className="border-[var(--line)] bg-[var(--panel)]/90">
            <CardContent className="space-y-3 py-5">
              <h2 className="mono text-sm font-semibold text-[var(--sea-deep)]">
                {id}
              </h2>
              <p className="font-[family-name:var(--font-display)] text-xl">
                {doc.question}
              </p>
              <dl className="grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--mute)]">
                    Evidence
                  </dt>
                  <dd>{doc.evidence}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--mute)]">
                    Computation
                  </dt>
                  <dd>{doc.computation}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--mute)]">
                    Values
                  </dt>
                  <dd>{doc.values}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--mute)]">
                    Failure modes
                  </dt>
                  <dd>{doc.failureModes}</dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-[var(--mute)]">
                    Validation
                  </dt>
                  <dd>{doc.validation}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
