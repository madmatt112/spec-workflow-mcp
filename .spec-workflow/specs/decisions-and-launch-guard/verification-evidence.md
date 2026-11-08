# Verification evidence — decisions-and-launch-guard

The automated cases live in the unit, integration and browser suites
(`npm test` proves them on every run). Every line below must read
`passed` before the retrospective opens. The orchestrator relocates
this file to the main spec store at the merge gate.

- (scenario 1) pending — Requirement 1 AC 8. After the deploy, the
  operator names the project at `/home/mcf/repo/tradr` `tradr app` and
  the project at `/home/mcf/repo/tradr-hosted` `tradr infra`, and no
  page shows `tradr-hosted · tradr`.
- (scenario 6) pending — Requirement 7 AC 1 to AC 3. A cancel during a
  live step leaves the run `abandoned`, with no second `claude -p`, no
  new wait and no status change in the next 60 seconds.
