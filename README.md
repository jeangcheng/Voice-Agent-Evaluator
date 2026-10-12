# Kyron Eval — Healthcare Voice Agent Evaluation Platform

Minimal full-stack evaluation platform for a **synthetic** healthcare voice agent.

**End-to-end path:** scenario → text simulation → captured trace → automated metrics → inspectable UI (with human override).

## Quick start

```bash
npm install
npm run seed    # Baseline vs Policy v2 experiment + calibration artifacts
npm run dev     # http://127.0.0.1:4310
```

No API keys required. Agents and the clarity judge are deterministic (no paid LLM calls).

## What is real vs mocked

| Piece | Status |
|---|---|
| Scenario dataset (appt + Rx refill) | Real (synthetic) |
| Tool world (EHR-ish appointments/Rx) | Simulated in-process |
| Agent policies (`baseline`, `policy_v2`) | Deterministic rule agents (stand-ins for prompt/policy variants) |
| Caller | Scripted replay harness |
| Audio / telephony / ASR | Omitted |
| Evaluators | Real code + calibrated clarity rubric |
| Persistence | SQLite (`data/eval.db`) |
| LLM-as-judge API | Not required; optional future hook |

## Workflows covered

1. **Appointment scheduling** — confirm, reschedule (ambiguous date), book with tool failure, urgent symptoms, cancel control
2. **Prescription refill** — routine refill, controlled substance, similar med names, pharmacy change + refill, clinical advice request

See **Scenarios** in the app and `src/lib/eval/scenarios.ts`.

## Metrics

- `task_completion` — tool state vs expected ground truth
- `critical_entity_accuracy` — date / med / pharmacy / ids
- `escalation_appropriateness` — escalate iff policy requires
- `false_completion` — claimed success vs tool/state reality
- `next_step_clarity` — judgment metric with human labels → automated rubric (`data/clarity-labels.json`, `data/artifacts/clarity-calibration.json`)

Ground truth is primarily **simulated tool state** and **explicit scenario policy**, not transcript text alone.

## Experiment

`npm run seed` runs Baseline vs Policy v2 across all scenarios and writes:

- `data/artifacts/run-baseline.json`
- `data/artifacts/run-policy-v2.json`
- `data/artifacts/experiment-comparison.json`
- `data/artifacts/clarity-calibration.json`
- `data/artifacts/EXPERIMENT.md`

In the UI: **Runs** → open a run → inspect trace/metrics; **Compare** for diffs; **Findings** for product recommendations.

## Docs in this repo

- `SUBMISSION.md` — time allocation, AI use, intentional omissions, next steps
- `FINDINGS.md` — product recommendation + production notes (also rendered in-app)
- `data/artifacts/*` — saved evaluation outputs

## Security

Synthetic data only. Do not commit credentials. No external services required for the core path.
