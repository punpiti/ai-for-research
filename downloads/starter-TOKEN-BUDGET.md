# TOKEN BUDGET

## Default

- Token mode: `T1 Standard`
- Cost profile: `C0 Economy`
- Use `T0` for a small wording, command, or one-file check.
- Use `T2` for evidence synthesis, reviewer work, difficult diagnosis, or a
  high-risk decision after defining scope.
- Use `T3` only when the learner intentionally requests a multi-round run.

## High-Cost Consent Rule

If estimated cost is `High`, pause and offer:

1. Economy: core files and a plan.
2. Standard: focused implementation and smoke checks.
3. Deep: broader necessary reading and validation.

An explicit request to finish or run the work authorizes the narrowest safe
path to completion; it does not authorize unrelated scans.

## High-Value Context

Read in this order and stop when enough:

1. `AGENTS.md`
2. `.ai/PROJECT_STATE.md`
3. `.ai/agent-project-kit/STARTUP.md`
4. Files named by the learner or directly required by the task

## Compression Summary

Keep `.ai/PROJECT_STATE.md` at roughly 10–30 lines. Never store credentials,
full chat transcripts, full logs, or copied source documents there.
