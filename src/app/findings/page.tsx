import fs from "fs";
import path from "path";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function readArtifact(name: string): string | null {
  const p = path.join(process.cwd(), "data", "artifacts", name);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, "utf8");
}

export default function FindingsPage() {
  const experimentMd = readArtifact("EXPERIMENT.md");
  let calibration: {
    passAgreement?: number;
    sampleSize?: number;
    disagreements?: unknown[];
  } | null = null;
  try {
    const raw = readArtifact("clarity-calibration.json");
    if (raw) calibration = JSON.parse(raw);
  } catch {
    calibration = null;
  }

  return (
    <AppShell
      title="Findings & recommendations"
      subtitle="What we would put in front of product and engineering from this pre-production eval — tied to evidence in the seeded experiment."
    >
      <div className="space-y-6">
        <Card className="animate-rise border-[var(--line)] bg-[var(--panel)]/90">
          <CardHeader>
            <CardTitle className="font-[family-name:var(--font-display)] text-2xl">
              Priority 1 — Kill false completions on tool failure
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              <strong>Failure mechanism:</strong> Baseline claims a booking succeeded
              after <span className="mono">book_appointment</span> returns an error
              (<span className="mono">appt-book-tool-fail</span>). Transcript looks
              successful; tool state does not. Patients and staff then operate on a
              phantom appointment.
            </p>
            <p>
              <strong>Why it matters:</strong> Creates no-shows, angry rework, and
              trust damage that generic “helpfulness” scores will miss. This is not
              a UX polish issue — it is a correctness/safety issue.
            </p>
            <p>
              <strong>Intervention:</strong> Ship Policy v2’s rule — never assert
              completion unless the mutating tool returns ok; on failure, say the
              task is incomplete, schedule callback, escalate. Add a release gate on
              <span className="mono"> false_completion</span> for booking/refill
              mutators.
            </p>
            <p>
              <strong>Verify:</strong> Keep <span className="mono">appt-book-tool-fail</span>{" "}
              as a regression probe; sample live traces where tool error rate &gt; 0
              and audit agent claims vs tool ok.
            </p>
          </CardContent>
        </Card>

        <Card className="animate-rise-delay-1 border-[var(--line)] bg-[var(--panel)]/90">
          <CardHeader>
            <CardTitle className="font-[family-name:var(--font-display)] text-2xl">
              Priority 2 — Hard-stop urgent symptom routing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              Baseline escalates weakly while still offering to reschedule after
              chest pressure / SOB disclosure. Escalation alone is insufficient if
              automation continues.
            </p>
            <p>
              <strong>Intervention:</strong> Policy hard-stop + ER/911 language +
              clinical triage escalation; forbid scheduling mutations after urgent
              symptom flags for the rest of the call.
            </p>
            <p>
              <strong>Guardrail:</strong> Pair with control scenarios so we do not
              over-escalate routine cancellations (<span className="mono">appt-cancel-control</span>).
            </p>
          </CardContent>
        </Card>

        <Card className="animate-rise-delay-2 border-[var(--line)] bg-[var(--panel)]/90">
          <CardHeader>
            <CardTitle className="font-[family-name:var(--font-display)] text-2xl">
              Priority 3 — Multi-step refills must be atomic
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              Baseline submits a refill without updating pharmacy on{" "}
              <span className="mono">rx-pharmacy-change</span> — partial automation
              that creates staff cleanup and patient confusion.
            </p>
            <p>
              Treat pharmacy change + refill as a single workflow with state checks
              before the closing claim.
            </p>
          </CardContent>
        </Card>

        <Card className="border-[var(--line)] bg-[var(--panel)]/90">
          <CardHeader>
            <CardTitle className="font-[family-name:var(--font-display)] text-2xl">
              Clarity judge calibration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {calibration ? (
              <>
                <p>
                  Labeled sample: {calibration.sampleSize}. Pass agreement with
                  automated judge:{" "}
                  <strong>
                    {((calibration.passAgreement ?? 0) * 100).toFixed(0)}%
                  </strong>
                  . Disagreements inspected:{" "}
                  {(calibration.disagreements as unknown[] | undefined)?.length ?? 0}.
                </p>
                <p className="text-[var(--mute)]">
                  Full rows, raw judge breakdowns, and revision notes live in{" "}
                  <span className="mono">data/artifacts/clarity-calibration.json</span>{" "}
                  and human labels in{" "}
                  <span className="mono">data/clarity-labels.json</span>.
                </p>
                <p className="text-[var(--mute)]">
                  Agreement on a tiny synthetic sample is not production accuracy.
                  The useful signal was revising the rubric after “you&apos;re all
                  set” and “should go through soon” looked spuriously acceptable.
                </p>
              </>
            ) : (
              <p className="text-[var(--mute)]">
                Run <span className="mono">npm run seed</span> to generate
                calibration artifacts.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-[var(--line)] bg-[var(--panel)]/90">
          <CardHeader>
            <CardTitle className="font-[family-name:var(--font-display)] text-2xl">
              What this sample is not
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--mute)]">
            <p>
              Do not treat pass rates as production prevalence. Needed next:
              production trace sampling stratified by workflow and tool-error rate,
              customer-specific policy packs, ASR/barge-in probes, and human review
              queues for disagreement-prone metrics.
            </p>
          </CardContent>
        </Card>

        <Card className="border-[var(--line)] bg-[var(--panel)]/90">
          <CardHeader>
            <CardTitle className="font-[family-name:var(--font-display)] text-2xl">
              Production evolution (sketch)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-relaxed">
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                <strong>Ingest:</strong> append-only trace store (turns, tools,
                latency, model/prompt versions) from production + offline sims.
              </li>
              <li>
                <strong>Version everything:</strong> agent build, prompts, policies,
                scenario packs, evaluator versions — comparisons always pin both
                sides.
              </li>
              <li>
                <strong>Gates:</strong> blocking on false_completion + urgent-symptom
                probes; advisory on clarity until judge agreement is monitored.
              </li>
              <li>
                <strong>Human review:</strong> sample disagreements and high-severity
                failures; feed labels back into judge calibration.
              </li>
              <li>
                <strong>Privacy:</strong> synthetic in this repo; production needs
                PHI minimization, access controls, retention limits, customer
                isolation.
              </li>
              <li>
                <strong>Ownership:</strong> each recurring failure tag maps to a
                named product/eng owner with a verify scenario before close.
              </li>
            </ol>
          </CardContent>
        </Card>

        {experimentMd ? (
          <Card className="border-[var(--line)] bg-[var(--panel)]/90">
            <CardHeader>
              <CardTitle className="font-[family-name:var(--font-display)] text-2xl">
                Experiment snapshot
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink)]">
                {experimentMd}
              </pre>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
