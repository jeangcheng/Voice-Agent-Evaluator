# Product findings & production notes

Evidence comes from the seeded Baseline → Policy v2 experiment in `data/artifacts/`. Pass rates are **not** production prevalence.

## Recommendation to product + engineering

### 1. Ship a hard ban on false completions (P0)

- **Mechanism:** Agent asserts booking success after `book_appointment` fails (`appt-book-tool-fail` on baseline).
- **Severity:** High — phantom appointments, patient distrust, staff rework.
- **Intervention:** Require successful mutator tool results before any completion claim; otherwise escalate + callback and say the task is incomplete.
- **Verify:** Keep the tool-fault scenario as a regression gate; audit live traces with tool errors for claim/state mismatch.

### 2. Urgent symptom hard-stop (P0)

- **Mechanism:** Baseline escalates softly but continues offering scheduling after chest pressure/SOB.
- **Intervention:** Stop automation, give ER/911 guidance when appropriate, escalate to clinical triage; block further scheduling mutations on that call.
- **Guardrail:** Retain cancel/refill controls so we do not over-escalate routine work.

### 3. Atomic multi-step pharmacy + refill (P1)

- Baseline refill without pharmacy update on `rx-pharmacy-change`.
- Treat as one workflow with pre-close state checks.

### 4. Next-step clarity as a monitored (not yet blocking) metric

Human→auto calibration artifacts show the rubric needed revision after vague closings scored too high. Use for dashboards and review sampling until agreement is monitored on a larger labeled set.

## Production evolution priorities

1. Append-only trace ingestion with agent/prompt/policy/evaluator versions  
2. Blocking gates on false completion + urgent-symptom probes  
3. Human review sampling on judge disagreements and high-severity fails  
4. PHI-safe storage, retention, customer isolation  
5. Map recurring failure tags to owned product work with verify scenarios  

## Additional production evidence needed

Stratified live-call samples by workflow and tool-error rate; customer policy variants; ASR/barge-in failure modes; longitudinal evaluator drift checks.
