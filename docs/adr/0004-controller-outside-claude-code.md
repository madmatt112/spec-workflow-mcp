---
status: accepted
---
# The controller is an always-on process outside Claude Code

Decided 2026-10-09. Nothing inside Claude Code can start, resume or schedule a local run on
its own: crons, wakeups and monitors die with their session, a usage-limit hit kills a
headless phase, and a run launched from a terminal dies with that terminal. So the thing
that holds the queue, starts and resumes runs, watches capacity and the usage window, and
merges by rule is a long-lived process on the operator's machine, written in code, with no
model in the loop. It runs with every browser tab closed. One machine; the homelab is not a
target.

## Consequences

- The supervisor skill and the overwatch session stop being the control plane. The overwatch
  role is retired; a second opinion on a wait is an advisor the operator asks for.
- Launch means enqueue. A run starts when the controller has capacity.
- Each model step is a fresh headless process the controller spawns and can resume by id.
