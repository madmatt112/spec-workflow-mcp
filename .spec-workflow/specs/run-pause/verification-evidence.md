# Verification evidence — run-pause

The automated cases for the operator pause live in the controller, route and
e2e suites (`npm test` proves them on every run). The deploy scenario below
cannot run inside that loop and stays `pending` until the operator runs it
on the live controller service, in a rebuilt, restarted session; the
retrospective phase requires this line to read `passed` before it opens.
The orchestrator relocates this file to the main spec store at the merge
gate.

- (deploy) pending — Requirement 7 AC 1 to AC 5: the operator pauses a run
  with a step in flight, the pause route answers at once, the step finishes
  and commits as normal, no next step starts, and the row reads
  `paused by you`; `scripts/sdd-self-update.sh` passes its in-flight check,
  deploys and restarts the controller; once restarted, the run is still
  paused with reason `operator`; the operator presses Resume and the run
  starts its next step; the operator pauses a run with no step in flight
  and the pause takes effect at once.
