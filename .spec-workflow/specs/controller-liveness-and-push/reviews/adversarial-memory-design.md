# Adversarial Review Memory — design

Last updated: 2026-11-03 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet — round 1 just filed)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R1-1 (SHOULD_FIX).** C9/D12 message redaction redacts only absolute and `~/` paths; C9 states
  relative paths and `https://` URLs are not redacted. This contradicts Requirement 4 AC 3 /
  NFR Security "no path" and D12's own rationale ("the requirement bans paths"). A question's first
  line (any wait kind) can carry a relative path like `src/controller/step.ts` to the phone.
  Fix: widen redaction to path-shaped tokens, or narrow D12's "no path" scope with explicit AC-3
  sign-off. Severity SHOULD_FIX not MUST_FIX because topic/token (the real secrets) are never in
  the body and never logged.
- **R1-2 (MINOR).** Config-read TOCTOU in C9: recording reads `notify.json` to arm
  firstPush/reminded, `attemptPush` reads it again; a file flip between the awaits desyncs
  arm-vs-send. Rare; one-sentence note.
- **R1-3 (MINOR).** The ntfy confirmation gate (C9 UNCONFIRMED / Scope Open item) assumes the push
  task can reach `docs.ntfy.sh`. WebFetch of that page is denied in both the drafting and the review
  session; if also denied for the task, the confirm-or-escalate gate cannot fire. Name the doc-access
  path for the task.
- **R1-4 (MINOR).** `RunRecord` cited at state.ts:70-109 vs 69-109 in requirements/context. Interface
  body is 70-109; resolves; cosmetic.

## Patterns & Themes
- The document is exceptionally citation-accurate: ~40 cited artifacts (state/step/controller/runs/
  waits/push/home/summary/multi-server/run-setup/spec-routing-deriver/shell-feed/hub/types/RunsPage/
  phase wiring) all verified at both ends. No misstated artifact. Do not spend round 2 re-checking
  citations already confirmed here — attack logic and requirement-compliance instead.
- The only live weakness class is the ntfy/message boundary (what leaves the machine, what ntfy
  accepts). Both open items cluster there.
- Confirmed sound and not worth re-opening: the write-chain ordering + terminal guard (C1), the
  10 s throttle + step-end clear (C3), the crash-wait transient `driven:true` corrected by the live
  `drivenRuns()` read at flush (C4/D6), the double-drive guard in `startDrive`, the `!== 'active'`
  routing broadening (C10), the driven-set wiring completeness (grep-proved two callers + one
  ShellFeed), and `pushState` switching to `readNotifyConfig` (C8, a real fix).

## Guidance for Next Review
- Check whether R1-1 was fixed by widening redaction (look at C9 "Redaction" and D12) or accepted
  with an AC-3 scope note; scope the re-check to that clause's diff, not a full re-review.
- If R1-3 is addressed, confirm the task-phase doc-access path is concrete (not "the task reads the
  page" with no environment).
- Environment note: WebFetch to external docs (docs.ntfy.sh) is DENIED in the review session. Do not
  plan to verify the ntfy contract live; judge the deferral on its mitigation.
- Data Models completeness and error-branch-shape lenses passed in round 1; only re-run them against
  new objects/branches a revision introduces.
