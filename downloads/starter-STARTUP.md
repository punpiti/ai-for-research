# Fast Startup Contract

This workspace includes only the token-saving Markdown subset of Agent Project
Kit. It does not include APK scripts, routing registries, machine discovery,
environment manifests, prompts, benchmarks, or update machinery.

## Read Every Session

1. Project `AGENTS.md`
2. `.ai/PROJECT_STATE.md`
3. This file

Stop there unless the current task triggers another file. Do not scan the
workspace merely because files exist.

## Read Only When Triggered

| Trigger | Read next |
|---|---|
| The learner asks about cost/token use, or work may be expensive | `.ai/TOKEN_BUDGET.md` |
| A broad scan, large corpus, wide rewrite, or long agent loop is proposed | `TOKEN_DISCIPLINE.md` in this folder |
| A command, dependency, or build fails | only the relevant part of `AGENTS.md`, the failing file, and the last useful error lines |
| The last state summary is insufficient | ask for the one missing outcome or source; do not load unrelated folders |

## Check Cadence

- Per session: read the three startup files and task-relevant sources.
- Per task: run focused checks required by the task.
- After a meaningful task: compact `.ai/PROJECT_STATE.md` to 10–30 lines.
- Repeat document extraction only when the original changed or the cached
  Markdown is missing or inadequate for the question.

## Hard Rule

Save tokens by reducing irrelevant context, repeated extraction, duplicated
explanations, and unguided loops. Never save tokens by removing evidence checks,
tests, validation, or a necessary human review gate.
