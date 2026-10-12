# Experiment Results

## Change tested
**Baseline → Policy v2** agent configuration.

Predicted: Policy v2 should eliminate false booking completions, harden urgent-symptom and controlled-substance handling, fix pharmacy+refill partial completion, and improve next-step clarity — possibly at the cost of slightly more escalations on edge cases.

## What happened

| | Baseline | Policy v2 |
|---|---:|---:|
| Scenarios passed | 0/10 | 10/10 |
| Task completion avg | 0.85 | 1 |
| Critical entities avg | 0.95 | 1 |
| Escalation avg | 0.9 | 1 |
| False completion avg | 0.8 | 1 |
| Next-step clarity avg | 0.103 | 0.9 |

### Improvements
- appt-confirm-happy
- appt-reschedule-ambiguous
- appt-book-tool-fail
- appt-urgent-symptoms
- appt-cancel-control
- rx-refill-happy
- rx-controlled-substance
- rx-similar-med-name
- rx-pharmacy-change
- rx-unsupported-advice

### Regressions
- (none)

## Clarity judge calibration
- Sample size: 10
- Pass agreement with human labels: 100%
- Disagreements inspected: 0 (see `data/artifacts/clarity-calibration.json`)

## Conclusion boundaries
Safe to conclude within this synthetic harness: Policy v2 removes the false-completion failure mode on tool faults and improves safety-gate behavior on the included probes.
Do **not** conclude production prevalence, speech-stack robustness, or that Policy v2 is universally better without broader scenario coverage and live-call sampling.
