# Adversarial Analysis — controller-liveness-and-push/design (v2, round 2)

Primary surface: feasibility, consistency, edge cases. Fresh lens: none (per prompt).
Attacked the v2 deltas first (Revision History v2: R1-1..R1-4 dispositions).

## Delta verification (what I checked and how)

Read both ends of every citation the v2 delta touched against the worktree code.

- **R1-4 — RunRecord cite `69-109` (C1).** `src/controller/state.ts:69` is the doc comment
  `/** runs/<id>/run.json: ... */`, `:70` is `export interface RunRecord {`, closing `}` at `:109`.
  Matches the requirement/context range. Fixed correctly. ✓
- **R1-2 — config-read race note, `attemptPush` (`:189`) (C9).** `attemptPush` is `src/advisor/push.ts:188-204`;
  its `const config = await readPushConfig()` is at `:189`. Citation accurate; the "recorded, POST skipped"
  description matches the `if (!config) return` at `:190`. ✓
- **R1-3 — AC 4 gate now names the doc-access path (C9 UNCONFIRMED).** "its implementer has `WebFetch`"
  checks out: the `sdd-implementer` tool set includes `WebFetch`. The confirm-or-escalate gate now
  resolves on a denied fetch too. ✓
- **R1-1 — widened redaction (C9 Redaction).** The remaining delta of substance; re-checked below.

No misstated artifact in the delta. MUST_FIX = 0.

## Topics attacked

### 1. The widened redaction rule vs AC 3 "no path" (C9 Redaction, Revision History R1-1) — fix-induced

- **Challenge the claim that "a question's first line no longer sends a repo-relative file."** The v2
  rule redacts a relative token only when it has **both** a `/` **and** a file extension
  (`src/controller/step.ts` → `[path]`). A **single-segment** relative filename — an extension, no
  slash — is not redacted: `step.ts`, `notify.json`, `config.yaml` all pass through unredacted. That
  is still a repo-relative file reference, so the Revision-History claim is false for the one-segment
  case.
- **Stress-test the crash-wait path specifically.** The crash wait's only question text is
  `step ${stepKind} failed inside the controller: ${message}` (C5), where `message` is an arbitrary
  error string (`err.message` or `String(err)`). Error strings routinely quote a bare basename —
  `ENOENT ... open 'notify.json'`, `Cannot find module 'foo.js'`. After the quotes are stripped the
  token has an extension and no slash, so the rule leaves it intact and it reaches the phone. AC 3
  (Requirement 4 AC 3) bans "no path, no file content"; a bare filename is a file reference.
- **Challenge the residual statement.** C9 says "a bare relative directory with no extension is the
  one residual AC 3 does not cover." There are **two** residual classes, not one: (a) extensionless
  relative directories (`src/controller`), and (b) single-segment relative filenames with an
  extension (`step.ts`). The operator's AC-3 scope sign-off was recorded against the smaller, stated
  residual, so the acceptance rests on an understated picture.
- **Bound the blast radius (why not MUST_FIX).** The real secrets — ntfy `topic` and `token` — are
  never in the body and never logged (NFR Security, honored throughout: C9 POST `detail` names only
  the url and reminder flag). The leak is the operator's own filename to the operator's own ntfy
  topic. This is a requirement-compliance / info-hygiene gap, not a credential or data hole.

### 2. The ntfy header/body contract (C9 UNCONFIRMED, D11) — resolved as far as it can be

- The AC-4 gate now fetches the ntfy page via the implementer's `WebFetch` and escalates for an
  operator-supplied value if the page disagrees or the fetch is denied — so the gate resolves either
  way. WebFetch of `docs.ntfy.sh` is denied in this review session too; the deferral is honest and
  operator-visible. Nothing is pinned here. No new defect.

### 3. Decision compression D1–D15 — no meaning change

- The v2 rewrite drops the "options were X, Y, Z; chosen because" scaffold into "not X or Y: reason".
  Spot-checked D4 (queued/running/merging), D7 (409), D11 (priority 4), D12 (marker): each decision's
  content and the RE-DECIDED markers survive intact. Cosmetic only.

### 4. "Assertions that change" dropped its explicit line list (Testing Strategy) — acceptable

- v2 replaces the pinned assertion lines with the grep `pushConfigPath\|push\.json\|dashboardUrl`.
  The rename `readPushConfig`/`PushConfig` is not in the grep, but `tsc` is the backstop for a removed
  export (as the design already relies on for `notifyConfigPath`). Not a gap worth a finding.

## Findings

### R2-1 (SHOULD_FIX, Compounding R1-1, fix-induced)

C9 redaction and Revision-History R1-1 overstate AC-3 coverage. The widened rule requires a relative
token to have **both** a `/` and a file extension, so a single-segment relative filename
(`step.ts`, `notify.json`) — common inside the crash-wait message's `${message}` — is not redacted
and leaves the machine, violating Requirement 4 AC 3 ("no path, no file content"). The design names
only one residual ("a bare relative directory"); there are two (extensionless dirs **and** single-
segment files), and the claim "a question's first line no longer sends a repo-relative file" is false.

**Failure scenario:** a drive throws `Error: ENOENT: no such file or directory, open 'notify.json'`.
openCrashWait writes question text `step implementation failed inside the controller: ENOENT ... open 'notify.json'`.
buildMessage body line 2 tokenizes the first line; `notify.json` has an extension but no `/`, so it is
not redacted and is POSTed to the phone. AC 3 is violated and the design claims it is not.

**Fix (one of):** (a) redact any token carrying a file extension (drop the `/` requirement), which
closes the single-segment-file class; or (b) restate the residual to name both classes and correct
the Revision-History sentence, so the operator's AC-3 scope sign-off reflects the true residual.

## Top risks / gaps

1. **R2-1 (SHOULD_FIX).** Single-segment relative filenames bypass the widened redaction and reach
   the phone; the design's residual statement and the R1-1 disposition claim overstate AC-3 coverage.

(No other live risk. The ntfy deferral is tracked and gated; D-compression and the testing-strategy
trim introduced no defect; the write-chain, driven-set, crash-wait and re-drive reasoning confirmed
sound in round 1 are untouched by the v2 delta.)

## Top 3 conclusions to challenge or reverse

1. **"a question's first line no longer sends a repo-relative file" (Revision History R1-1).** Reverse.
   A one-segment filename with an extension still sends. Either widen the rule or restate the claim.
2. **"a bare relative directory with no extension is the one residual" (C9).** Reverse. Two residual
   classes exist; the stated one is the smaller.
3. **Everything else in the v2 delta holds.** The RunRecord cite, the config-race note, the WebFetch
   gate, and the decision compression are all accurate and internally consistent — no reversal needed.

## What's missing before acting

- Either a redaction rule that also catches single-segment filenames, or an accurate two-class
  residual statement with AC-3 sign-off on both. Nothing else; the document is otherwise delta-clean.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 0
DESIGN_READY: no
ESCALATE: none
```
