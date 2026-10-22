# Adversarial Analysis — verification-loop/design (v1), round 1

Directive review. Primary surface: feasibility, consistency, edge cases. First
design review; the `## Changes since` section is the v1 lint commit (range and
path-prefix corrections). Fresh lens applied: **resume / idempotency** — restart
and re-entry behaviour of the ledger-note state machines.

## What I checked, and how

Every code citation in the document was read at both ends of its range against
the worktree. All are accurate, including the lint commit's corrections:

- `merge.ts` — `PR_VIEW_FIELDS` :38-39 (lacks `baseRefName` today, so C1 adds it);
  `evaluatePullRequest` :319-412; reason-pushing branches :357-405; `mergeByRule`
  :568-642; `MergeStageResult`/`MergeEvaluation`/`PullRequestEvaluation` shapes;
  `scrubbedGitEnv` git at :459-465.
- `runs.ts` — `blocked` case :669-682; loop head :746-778 (the merge resume at
  751-758 genuinely precedes the token-cap :760-771 and window :773-778 checks, so
  C3's re-check demand is warranted); `escalationRulings` :997-1008;
  `handleImplementationOutcome` :1015-1056; `toRow`/`ControllerRunRow` :1211-1235
  (already carries `prReads`); `stepLifecycle` :425-449; runImplementationPhase call
  :859-867.
- `controller.ts:353-358` — an `escalation` wait answered `abandon` cancels the run
  (C7/D11 accurate).
- `implementation.ts` — caps :48-58; `IMPLEMENTER_SCHEMA` :147-161; `stepUsage`/
  `runModelStep` :371-418 (reads `loadRole` profile today, as R2 AC 8 states);
  standing briefs :469-474; the five `runModelStep` call sites C5 names (:629-634,
  :658-661, :774-778, :994-997, :1137-1140); `completionGate` :879-956; `buildPrBody`
  :1042-1057 (Test plan at :1049-1051); log-tail :1117-1126; `gh run rerun` :1146;
  `task <id> pick head <sha>` note :534-538 (C6's fallback base exists).
- `step.ts` — `StepSpec.model/effort` :108-111; `loadRole` :229-242; `runStep`
  passes `--model`/`--effort` from override-or-role :343-358.
- `agent-profiles.json` — `sdd-test-author` is `claude-sonnet-5`/`high` at :50-55
  (R2 AC 7/D9 first values confirmed); `sdd-implementer` `claude-opus-4-8`/`xhigh`
  :20-25.
- `brief-templates.ts` — `renderCiFix` :682-705, `renderFix` :713-750, `renderVerifier`
  :833-848, `fix` required keys `['taskId','round','variant','findings','commit']`
  :1553-1557.
- `gate-rules.ts` `isSensitivePath` :158-160; `veto-rules.ts` `computeClassA` :65-101
  (null list ⇒ no path item) and saturation fallback :128-153 (destructive items are
  kind `keyword`, so C5 ignoring keywords honours R2 AC 3); `harness.ts` `gateClassA`
  :1162-1220; `gates.ts` class-a call `{action:'gate',op:'class-a',specName}` :291-294.
- `state.ts` `PrRead` :109-126; `RunPage.tsx` `CI_CHIP_STYLES` :332-337, `PrPanel`
  :345-394; `types.ts` `DeferralOwner`/`Deferral` :310-328; `deferral-storage.ts`
  `create` :229-232.

Live probes:
- `gh --version` ⇒ **2.95.0 (2026-06-17)**, matching C1's claim.
- `gh pr view --json baseRefName` ⇒ "no pull requests found" (field accepted);
  `gh pr view --json notARealField` ⇒ "Unknown JSON field". So `baseRefName` is a
  valid `gh pr view` field on the installed gh — C1's library-capability claim holds.
- `merge.test.ts:172,255` assert exactly `{ ready: true, reasons: [] }`; the stub
  `READY_VIEW` carries no `baseRefName`, so adding an optional `blocking?`/`base?`
  and a git-only dependency read leaves these and the argv counts (:471 len 3, :486
  len 3, :497 len 1) green. C1's invariant and the test claims hold.

Scope vs the decomposition entry (26): all four Delivers items map cleanly — (1)
merge fix rounds → R1/C1-C4, (2) Sonnet-by-flag → R2/C5, (3) security pass → R3/C6-C7,
(4) dependency flag → R4/C8. No scope drift; R5 (docs) is a reasonable addition. No
`## Probes` line to re-probe.

Resume/idempotency lens: the merge-fix cap (`mergeFixHistory` excludes the
`step usage-limit` ending, D3), the security epoch markers (`security: epoch <n>`
bound round counts; `answered`/`accepted` read the whole run, D12), the e2e-pass
note read-back (R3 AC 13 / D8 / D16 — the v3 fix that stops a post-fix e2e re-run
from stranding an `accept`), and the ancestry gate before push (a conflict's merge
commit keeps the old HEAD as a parent, so `--is-ancestor` passes; D5) are all
internally consistent and restart-safe.

## Findings

### R1-1 (MINOR) — C6's "after each verifier step and fix round" undercounts the adjudicator note
C6's general rule writes a counts note "after each verifier step and fix round",
but the adjudicate step is neither. The adjudicator's counts note is required
elsewhere in the same document — the Data Models row `security: adjudicator:
findings <f>, suspicions 0`, R3 AC 12, and `readSecurityState`'s own transition
"`adjudicator` gives `recheck-adjudicated`". Read literally, C6's sentence would
leave the loop re-running `adjudicate` because the last stage note never advances.
Three concurring signals make the adjudicator note unambiguous, so this is a
wording tightening, not a defect: say "after each step" (pass, fix round, recheck,
adjudicator, recheck-adjudicated).

### R1-2 (MINOR) — Security deferral create fields beyond `body.context` are unpinned
`DeferralStorage.create` (:229-232) requires `title`, `revisitTrigger`,
`supersedes`, and `body.decision`/`body.revisitCriteria`; C6 pins only `owner`,
`tags`, `originSpec`, `originPhase` and `body.context`. The deferred-verification
deferral (:893-901) is a clear in-repo template, so compilation-required fields
are inferable, but naming them (title/trigger/decision/revisitCriteria) in C6
removes a guess.

### R1-3 (MINOR) — Merge-fix blocked path states only the window outcome
C3 says to "check `deps.isCancelled`, the token cap and `deps.windowBlock()` first"
on the resume path but specifies only the window ("pauses with no round"). The
cancelled and cap-exceeded outcomes are left to mirror `runOnce` (return, and the
`cap` error wait). Natural reading is right; one clause each would close it.

### R1-4 (MINOR) — `findings` value for the `merge` fix variant unspecified
The `fix` template requires `findings` (:1555). C4 names `taskId`/`commit:'none'`
for `renderMergeFix` but `renderMergeFix(v)` never consumes `findings`; the caller
must still pass a value to satisfy the key. State what (empty, or the blocking
texts).

### R1-5 (MINOR) — buildPrBody's source for the accepted-finding command is implicit
C6 step 4 routes an accepted finding into the Test plan as `… (<file>): <command>`,
but `buildPrBody` (:1042-1057) reads only the `gotchas`/`checksRun` closures and the
gotchas line carries no command. The command lives in the `security: accepted <json>`
note; say that buildPrBody (or its caller) reads it.

## Top risks/gaps
1. R1-1 — the adjudicator-note wording, the only finding with a runtime (not
   cosmetic) consequence if an implementer reads C6 in isolation.
2. R1-2 — unpinned required deferral fields.
3. R1-3 — unstated cancelled/cap outcomes on the merge-fix resume path.

## Top 3 conclusions to challenge
1. "The stubs cover every branch; no live check on a real red PR" (Scope notes).
   Accepted as reasonable: gh/claude are stubbed and the dependency read is git-only,
   so a real red PR adds no coverage the stubs lack. Not reversed.
2. "A ready result stays exactly `{ ready: true, reasons: [] }`" (C1). Verified
   against :172/:255 — holds because `blocking?`/`base?` are optional and absent on
   ready. Not reversed.
3. D16 — recording the e2e pass and not re-running it. Challenged under the resume
   lens and found sound: the escalation wait is only open before the HANDOFF write,
   so `e2ePassStands` is true on every accept/retry resume; a post-handoff re-entry
   re-runs e2e, which is the documented "behaves as today". Not reversed.

## What's missing before acting
Nothing blocking. Optionally fold R1-1 and R1-2 into C6 so the tasks phase has no
wording to reconcile, and add the two clauses of R1-3. All are MINOR; none change
an interface or a data shape.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 5
DESIGN_READY: yes
ESCALATE: none
```
