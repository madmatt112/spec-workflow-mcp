# Adversarial Review Memory — design

Last updated: 2026-10-20 (Round 1)

## Cumulative Findings Summary

### Accepted
- (none yet — awaiting reviser disposition)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R1-1 (SHOULD_FIX)** — C4 token check: error classification unspecified. Reason strings
  (`gh exited <code>` / `gh timed out` / `unreadable gh output` / ENOENT) never name the
  `child_process` fields that distinguish them. The in-tree `runCommand`
  (`src/controller/merge.ts:150-172`) filters `typeof e.code === 'number'`, which discards the
  string `'ENOENT'` → contradicts Error Handling §4's "gh exited ENOENT". agent-rules.md
  requires node-20 field claims to be stated. Fix: cite/reuse `runCommand`; pin `error.killed`,
  direct `error.code`, numeric exit.
- **R1-2 (SHOULD_FIX)** — Data Models for `POST /api/projects/add` pins 200/400 only; C7/D3
  newly route a failed `rememberProject` write to 500, which is unpinned in Data Models.
  Fix: add `500: { error: string }` (failed durable write).
- **R1-3 (MINOR)** — `runDoctor`/`runChecks` default `timeoutMs` unstated vs the 10 s/30 s
  Performance NFR. Fix: state default = 10000.
- **R1-4 (MINOR)** — C3/C4 use "store root" and "storeDir" interchangeably for the
  `readAgentRules` argument, which must be `<storeRoot>/.spec-workflow` not `<storeRoot>`.
  Fix: name the `.spec-workflow` directory explicitly.
- (noted, uncounted) `(was: undefined undefined)` possible when a prior spec-workflow entry is
  an object lacking command/args, or a non-object; cosmetic.

## Patterns & Themes
- Citations are uniformly accurate (all ~40 ranges verified both ends). The weakness is not
  false claims about existing code but under-specified *new* behaviour: `child_process` error
  classification and the 500 response shape.
- The document leans on "code samples illustrative, post-conditions binding." That is fine
  until a binding post-condition (the token reasons) depends on an unstated field read.
- Store-root / realpath / id coherence (D2+C7+D9+generateProjectId) is sound and well
  reasoned; D12 migration and C9 peek are correctly motivated. Do not re-litigate these.

## Guidance for Next Review
- Verify the reviser pinned the token-check fields and did not merely reword §4.
- Confirm the 500 row landed in Data Models and that the init exit-2 mapping references it.
- Fresh lens not yet used: a concurrency/ordering lens on the init→controller round trip
  (secret race, concurrent re-run) — low value for one operator but unused.
- Do not re-open: citation accuracy, scope, D2/C7/D9 coherence, D12 remove-and-re-add safety,
  C9 peek motivation, D1 partial-mock rationale, `showHelp` toContain invariant.
