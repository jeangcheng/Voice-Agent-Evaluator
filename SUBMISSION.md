# Submission summary

## Where time went

1. **Modeling the eval problem** — two workflows, mixed ordinary/difficult/safety/control scenarios, explicit ground truth in tool state and policy.
2. **Harness + two agent configs** — deterministic baseline vs policy_v2 designed to diverge on false completion, safety stops, and multi-step refill atomicity.
3. **Metrics + clarity calibration** — four deterministic metrics; one judgment metric with human labels, automated rubric, disagreement artifacts, and a rubric revision.
4. **Full-stack product** — runs list, run detail (trace/metrics/state/human override), scenarios, compare, metrics docs, findings.
5. **Experiment + writeup** — seeded Baseline→v2 comparison with inspectable artifacts.

## Intentionally not completed

- Live LLM agent / LLM patient simulator (would add non-determinism and API-key friction; deterministic agents give clearer causal evidence for the experiment)
- Speech/ASR/barge-in loop
- Multi-customer policy packs and auth
- Large scenario corpus / statistical prevalence claims
- Walkthrough video (record locally from the running app; this environment may not capture a single-take candidate video)

## How AI was used

AI assisted scaffolding, boilerplate UI, and first-draft evaluators. **Unreliable / generic outputs** included overly broad “helpfulness” metrics and scenarios that were only obvious one-turn failures. Those were replaced with entity traps, tool-fault false completion, and paired safety/control cases.

**Consequential decision not delegated:** treat **tool state** (not transcript) as primary ground truth for completion, and keep agents deterministic so Baseline vs Policy v2 differences are attributable to policy choices rather than model sampling.

## What I would do next

- Replace rule agents with pinned prompt variants behind the same tool interface
- Expand clarity labels; track judge drift
- Add production trace import adapter
- Wire `false_completion` + urgent-symptom probes as CI release gates
