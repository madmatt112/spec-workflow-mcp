---
status: accepted
---
# A run never talks to the operator except through a wait

Until 2026-10-09 a run could ask in its own terminal (AskUserQuestion, `block` gates mode,
the retrospective conversation) or stop and leave a record for the dashboard. Two paths
produced the headless-detection bug, stale run pointers and questions the operator never saw.
We decided there is one path: every run is launched headless by the harness, and every
human-facing message is a wait record that the dashboard shows and answers. There is no
interactive terminal run. If the operator wants to sit with a run, they watch it.

## Consequences

- No AskUserQuestion, no `block` mode, no terminal retrospective conversation in any skill.
- Skills load at launch, so a merged harness change reaches the next launch without anyone
  restarting a session.
