# Verification evidence — run-pause

The automated cases for the operator pause live in the controller, route and
e2e suites (`npm test` proves them on every run). The deploy scenario below
cannot run inside that loop and stays `pending` until the operator runs it
on the live controller service, in a rebuilt, restarted session; the
retrospective phase requires this line to read `passed` before it opens.
The orchestrator relocates this file to the main spec store at the merge
gate.

- (deploy) passed 2026-10-30 (coordinator, live controller at 4ac3f8ab, run
  run-20261029-130353 tax-lots) — Requirement 7 AC 1 to AC 5. Observed live:
  `POST /api/controller/runs/run-20261029-130353/pause` answered `{"ok":true}`
  in 9 ms at 01:47:32Z while step `verifier-e2e-r0` was in flight; the run
  record took `pauseRequested`; the step ran to its end (`VERIFY: pass`,
  01:57:34Z) and the run parked as `status: paused`, `pauseReason: operator`;
  no next step started in the following 60 s. `scripts/sdd-self-update.sh
  --dry-run` then passed its in-flight check with no refusal, and
  `systemctl --user restart sdd-controller.service` restarted the controller;
  after the restart the run was still `paused` / `operator` with no step in
  flight. `POST .../resume` answered `{"ok":true}` and the next step
  (`security-pass-e1`) started within 15 s. Not observed live, covered by the
  route and e2e suites instead: the row text `paused by you`, a full deploy
  (build and swap) under an operator pause rather than a restart, and a pause
  on a run with no step in flight.
