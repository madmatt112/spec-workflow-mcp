# Adversarial Review Memory — design

Last updated: 2026-11-03 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-2 (MINOR).** Config-read TOCTOU in C9 (recording read vs `attemptPush` read, `push.ts:189`).
  v2 added the one-sentence note; verified accurate.
- **R1-4 (MINOR).** RunRecord cite moved to `state.ts:69-109` (doc comment `:69` + interface `70-109`);
  matches requirement/context. Fixed.

### Partially Accepted
- **R1-1 (SHOULD_FIX).** Message redaction widened in v2 to path-shaped tokens: absolute (`/`), `~/`,
  and relative-with-slash-and-extension. Residual documented. BUT the residual is understated — see
  R2-1 below (single-segment relative filenames still leak). URLs intentionally stay (AC 3 bans paths,
  not URLs — reviser's recorded scope).
- **R1-3 (MINOR).** AC-4 ntfy-doc gate: v2 names the doc-access path (implementer has `WebFetch`,
  verified) and escalates for an operator value if the fetch is denied. Resolved.

### Rejected
- (none)

### Unresolved
- **R2-1 (SHOULD_FIX, Compounding R1-1, fix-induced).** The widened redaction rule requires a relative
  token to have BOTH a `/` and a file extension. A single-segment relative filename (`step.ts`,
  `notify.json`) — common inside the crash-wait `${message}` (e.g. `ENOENT ... open 'notify.json'`) —
  is not redacted and reaches the phone, violating Requirement 4 AC 3 ("no path, no file content").
  The design claims only one residual ("a bare relative directory") and that "a question's first line
  no longer sends a repo-relative file"; both overstate coverage — there are two residual classes.
  Fix: redact any token with a file extension (drop the `/` requirement), or restate the two-class
  residual and correct the R1-1 disposition sentence. SHOULD_FIX not MUST_FIX: topic/token (the real
  secrets) never enter the body or a log; the leak is the operator's own filename to their own phone.

## Patterns & Themes
- The document stays exceptionally citation-accurate. Round 2 re-verified only the three delta
  citations (`69-109`, `push.ts:189`, the `WebFetch` capability claim); all correct. No misstated
  artifact in any round.
- Every live weakness still clusters at the ntfy/message boundary — specifically what leaves the
  machine in the question's first line. R1-1 → R2-1 is the same seam, not yet fully closed.
- The ntfy header/body contract (D11, UNCONFIRMED) is an honest, gated deferral; do not count it as a
  defect. WebFetch to docs.ntfy.sh is DENIED in the review session — judge the gate, don't verify live.

## Guidance for Next Review
- Check whether R2-1 was closed by widening the rule (redact any extension-bearing token) or by an
  accurate two-class residual statement with AC-3 sign-off. Scope the re-check to the C9 "Redaction"
  bullet and the Revision-History R2 entry — do not re-review the whole document.
- Do NOT re-check: the RunRecord cite, the config-race note, the WebFetch gate, the decision
  compression (D1–D15 meaning preserved), or the testing-strategy trim — all verified clean in round 2.
- Do NOT re-check the round-1 "confirmed sound" set (write-chain ordering + terminal guard C1,
  10s throttle + step-end clear C3, crash-wait transient driven:true corrected at flush C4/D6,
  double-drive guard, `!== 'active'` routing C10, driven-set wiring, `pushState`→`readNotifyConfig`).
- Data Models completeness and error-branch-shape lenses passed again; re-run only against new
  objects/branches a future revision introduces.
