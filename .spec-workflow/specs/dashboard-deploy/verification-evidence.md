# Verification evidence — dashboard-deploy

The automated cases for the deploy control live in the controller, script,
route and e2e suites (`npm test` proves them on every run). The running
service has no Deploy route until this build is deployed by hand, so the
six scenarios below cannot run inside that loop and stay `pending` until
the operator runs each one on the live service, in a rebuilt, restarted
session; the retrospective phase requires every line to read `passed`
before it opens. The orchestrator relocates this file to the main spec
store at the merge gate.

- (scenario 1) pending — Requirement 3 AC 7, Requirement 6 AC 8. A running
  and a waiting run both carry the hold; the record reaches `done` with
  `commit`; the running run runs again from its cursor; the waiting run
  stays `waiting`; no deploy hold remains; and the page's WebSocket
  reconnects within 10 seconds of the restarted service accepting
  connections.
- (scenario 2) pending — a wait answered during `build` starts no step
  until the record reaches `done`.
- (scenario 3) pending — a failing eval leaves the record `failed` with
  `error` starting `gate:`, an error wait on the page, the old `dist/`
  still live, and both runs released.
- (scenario 4) pending — Requirement 5 AC 4. Cancel pressed at `build`
  stops the child, releases both runs, removes the record, and leaves
  HEAD and `dist/` unchanged.
- (scenario 5) pending — Requirement 3 AC 4, Requirement 3 AC 5. Live
  unit case: a controller stopped at `wait` with the child alive leaves
  the child running, and a new controller finishes the record. No-unit
  case, `unitStarted` unset: the new controller starts the unit itself
  and finishes the record.
- (scenario 6) pending — with the child killed by hand at `build`, the
  next controller start writes `failed` and releases the holds.
