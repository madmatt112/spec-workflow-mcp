# Adversarial Review Memory — tasks

Last updated: 2026-11-03 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- none

### Partially Accepted
- none

### Rejected
- none

### Unresolved
- M1 (MINOR) — Tasks 2-4 implement NFR Performance/Reliability but omit `NFR` from
  `_Requirements:` (only task 12 tags it); NFRs referenced inline in Restrictions, lint coverage
  passed. Tagging only.
- M2 (MINOR) — Task 7 Restriction says call `openCrashWait` "inside the `try`"; it belongs in the
  `catch` (task body says so), `active` cleared only in `finally`, so substance correct. Mirrors
  design C5 wording. No impl risk.
- M3 (MINOR) — Task 15 docs tags only 3.1/4.2 though Success asserts the reminder (Req 5) and the
  four message fields (Req 4.3); cites C11 in `_Prompt`. Cosmetic.

## Patterns & Themes
- Citations are uniformly accurate: every delta (lint path-prefix) and every load-bearing
  design/code anchor re-read at both ends and verified (controller.ts, runs.ts, multi-server.ts,
  state.ts, step.ts, waits.ts, shell-feed.ts, push.ts).
- Green-tree bridges are the document's backbone (empty driven-set default → task 9; exported-but-
  uncalled pushConfigPath/buildMessage → task 12). Each keeps tsc + suites green at its own task.
- The 4-arg `new ShellFeed(projects, launcher, send, opts)` line in shell-feed.test.ts's header is a
  STALE comment from an earlier spec; the real constructor is 3-arg `(projects, send, opts)`. Do not
  mistake it for a task defect — task 6 and design C4 match the real signature.
- All 43 ACs covered; retro P7 success-clause coverage holds; no prose `File:` entries.

## Guidance for Next Review
- Round 1 was clean (0/0/3). If a round 2 is forced, attack a fresh lens not used here: e.g. the
  stub `eventDelayMs` real-time path in scenario 1 vs the fake-timer bar (D5), or whether task 12's
  advisor-e2e capture-server rewrite (JSON body → plain text) fully covers every `dashboardUrl`/
  `push.json` hit the grep returns.
- Do not re-raise M1/M2/M3 as loop-keeping; they are MINOR by the severity rubric.
- now-model.ts:131-132 idle-row gap is explicitly out of scope (Req 6 names buildSetupView only);
  do not raise it as a coverage miss.
