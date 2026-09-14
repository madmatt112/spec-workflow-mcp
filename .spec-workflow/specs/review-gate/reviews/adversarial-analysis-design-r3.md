# Adversarial Analysis — review-gate/design (v3)

Round 3. Target: `.spec-workflow/specs/review-gate/design.md` (v3). Read against the
approved requirements (v4), the codebase-context map, the memory file, and the R2 analysis.
Environment matches the design's probes: git 2.43.0, node v24.13.0 (both re-confirmed on
this machine below).

Delta attacked first (v3 Revision History): R2-1 `-c core.quotePath=false` on the
commit-mode `git log` and `git ls-files`; R2-2 the gitignore assumption in Component 5 plus
the e2e `.gitignore`; R2-3 D13 naming the `review-task ↔ review-gate` import cycle; and the
Scope/example trim under the 4,000-word cap.

Fresh lens: failure, rollback and partial-failure paths — every step of `handleGate` and
the check runner walked with one input failing at a time.

## Delta re-probe — what is fine

- **R2-1 confirmed correct.** Re-probed on git 2.43.0 with `src/café.ts` (tracked) and
  `src/naïve.ts` (untracked). Without the flag, commit-mode `git log --numstat` emits
  `"src/caf\303\251.ts"` and `ls-files --others` emits `"src/na\303\257ve.ts"` (both
  C-quoted); with `-c core.quotePath=false` both emit raw UTF-8, matching the baseRef
  `git diff --numstat` producer. All three producers of `touched` now share one encoding.
  The R2-1 regression is closed.
- **Commit-mode "no sha header" still holds.** `git log --first-parent -1 --numstat
  --format= --no-renames <c>` printed only the two numstat lines — no sha line, no leading
  blank line. `parseNumstat`'s `:277` (`if (parts.length < 3) continue`) never fires;
  adding `-c core.quotePath=false` did not change this.
- **R2-3 confirmed benign.** `runGit`/`parseNumstat` are file-private (verified: only
  `TaskDiffResult`, `containmentRejectionMessage`, `computeTaskDiff` are exported from
  `task-diff.ts`). `computeTypecheckMethodologyState` (`:54`) and `unwrapTypecheck/Hygiene/
  Diff` (`:79`, `:103`, `:134`) are all exported. `review-task.ts` uses `handleGate` only
  inside `reviewTaskHandler` (`:251-260`) and `review-gate.ts` would use the `unwrap*`
  helpers only inside `handleGate` — both call-time, so the ESM cycle resolves. D13's claim
  is accurate.
- **Check runner error taxonomy confirmed (node v24.13.0).** Probed `child_process.exec`:
  timeout ⇒ `killed:true, signal:'SIGTERM', code:null`; maxBuffer overflow ⇒
  `code:'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'` (a **string**, killed/signal undefined);
  non-zero exit ⇒ numeric `code`; missing binary ⇒ numeric `code` 127; success ⇒ no error.
  Component 6's four-way classification is exactly right, and the `code === null` guard on
  the timeout branch keeps a maxBuffer overflow (string code) from being misread as a
  timeout. Error Handling items 4/7 hold. No finding here.
- **`worstTypecheckState` never sees an empty array.** `runProjectTypecheck`
  (`typecheck.ts:124-238`) returns a one-element array on every path (`feature-disabled`,
  `no-tsconfig`, `tsc-not-found`, timeout, overflow, success). A typecheck rejection is
  converted by `unwrapTypecheck` to a one-element `unavailable`/`rejection` array, not `[]`.
  So the reduction cannot hit an undefined element. Fine.
- **Review-store integrity on a partial failure is sound.** `saveReview`
  (`task-review-manager.ts:108-132`) computes the version, then writes the file in one
  `fs.writeFile` (`:126`), then calls `removePrepareMarker`, which swallows ENOENT
  (`:98-102`). The gate writes no marker, so that cleanup is a harmless no-op — step 9's
  "no prepare marker written or checked" is consistent with the shared `saveReview`. A
  thrown `writeFile` leaves no committed review; a truncated file would be skipped by
  `parseReviewMarkdown` (`:168`). Error Handling item 9 is accurate on the store side.
- **NFR Reliability upheld.** A timed-out or failing check ⇒ `gate: fail` ⇒ `recorded:
  null`; a degraded typecheck/hygiene ⇒ `risk: high` and only `pass`+`low` records. So the
  gate never records `pass` when a check did not complete. Verified against rules a/e/g and
  Error Handling 8/10.

## Findings

### R3-1 — SHOULD_FIX — `handleGate`'s repo-existence probe has no reachable git mechanism, and `runGit` cannot distinguish "not a repo" from "bad ref" (Novel)

Component 2 step 5 and Error Handling items 2 and 3 promise **two distinct** failure
outcomes on the git path:

- item 2: "No git repository at `root` … `success: false` when `rev-parse --show-toplevel`
  exits 128."
- item 3: "`baseRef` or `commit` does not resolve: `success: false`, `message: 'baseRef <x>
  does not resolve in <root>'`."

Neither is implementable through the cited plumbing:

1. **`runGit` is file-private to `task-diff.ts` and unexported** (verified: exports are
   `TaskDiffResult`, `containmentRejectionMessage`, `computeTaskDiff` only). `computeRangeStats`
   is added *inside* `task-diff.ts` (D15) so it can use `runGit` — but `handleGate` lives in
   the new `review-gate.ts` (D13) and has **no** access to `runGit`. The design specifies no
   mechanism for `handleGate`'s own `git rev-parse --show-toplevel` call. The implementer
   must invent one (export `runGit`, write a fresh `execFile`, or move the probe), and
   different choices give different scrub/quoting behaviour.
2. **`runGit` returns only `{ stdout, ok }`** (`:43-46`) — it discards stderr and the exit
   code, collapsing ENOENT (git not on PATH), exit 128 (not a repo), and exit 1 all to
   `ok: false`. So even if the probe were moved into `computeRangeStats`, it could not
   produce two different messages: a non-repo and a bad ref both surface as `ok: false`
   with no distinguishing text. The design's item-2-vs-item-3 split cannot be honoured
   through this reuse.

Concrete failure walk that exposes it: `git` missing from PATH on the git path →
`execFile('git', …)` fails ENOENT → `ok: false`. Item 2's stated cause is "exits 128", but
this is ENOENT with `code === null`; the OUTCOME (`success: false`) is right only if the
implementation keys on `!ok` rather than on the literal exit 128 the design names.

Fix: state that `computeRangeStats` (or a new exported helper) performs the repo-existence
check and returns a distinguishable `message`, and drop the separate, unreachable
`handleGate` `rev-parse --show-toplevel` — or export a small git-probe helper `handleGate`
can call. Either way, name one mechanism and stop keying error text on an exit code
`runGit` never surfaces.

### R3-2 — MINOR — the R2-2 e2e `.gitignore` is added but not committed, so it re-pollutes `touched` (Compounding on R2-2)

The R2-2 fix added "a `.gitignore` ignoring `.spec-workflow`" before commit `C0`, but the
Testing Strategy still says only "commit `C0` adds `src/auth.ts`." An uncommitted
`.gitignore` does not ignore itself, so `git ls-files --others --exclude-standard` lists it
as an untracked file on every baseRef case. It enters `data.touched` and adds one file /
one line to `data.stats` in cases 1–3. Case 1's asserted `pass`/`low` survives (still under
200 lines), but `data.touched` is again semantically wrong — exactly the pollution R2-2
set out to remove — and the fixture now demonstrates the failure mode (add scaffolding,
forget to commit it) rather than the clean flow. State that `C0` also commits `.gitignore`
(or `git add .gitignore` before `C0`).

### R3-3 — MINOR — Error Handling item 3's message hardcodes "baseRef" but the same path serves `commit` mode (Novel)

Item 3 gives one message, `'baseRef <x> does not resolve in <root>'`, for both an
unresolvable `baseRef` and an unresolvable `commit` (close-out's primary mode, AC 7.1). A
close-out item gate with a bad sha would report a "baseRef" error naming a value the caller
passed as `commit`, which misdirects the fix. Name the failing selector by which argument
was given.

### R3-4 — MINOR — the implementation skill's gate routing has no branch for a `success: false` return after the checks ran (Novel)

Error Handling item 9 (and the D19 `baseRef`-unresolvable case) can return `success: false`
*after* work has happened, but Component 8's routing (AC 6.3–6.5) enumerates only
`fail`, `pass`+`low`, and `pass`+`high` — all of which assume `success: true` with
`data.gate`/`data.risk`. Requirements frame `success: false` only as a pre-run "cannot run
at all" (Req 1.8), so item 9's post-checks failure is a state the per-task loop
(`SKILL.md:67-105`) has no defined action for; the only recovery is a full re-gate that
re-runs every 300 s check. (Close-out is better off: `SKILL.md:96-98` has a generic
tool-error → resume escape.) Add one line to Component 8 telling the orchestrator what to do
on a gate `success: false` after `logged: yes`.

### R3-5 — MINOR — an unborn `HEAD` makes rule f return `success: false` instead of the decided "run against HEAD, score high" (Novel)

D12 and risk rule f decide that a task-mode call with no `baseRef`/`commit`/`files` runs
against `HEAD` and scores `high`, and AC 6.1 asserts a resumed `[-]` task "call[s] the gate
without `baseRef`, yielding `risk: high`." But `computeRangeStats` resolves first with
`git rev-parse --verify HEAD^{commit}`, which exits 128 on an unborn `HEAD` (a repo with no
commits) → `ok: false` → step 5 `success: false`. On that (narrow) input the gate refuses
rather than scoring high, contradicting D12 and AC 6.1. The harness commits before gating
(D3) so it rarely bites, but the stated "yielding `risk: high`" is not universally true.
Note the pre-first-commit case or special-case an unborn `HEAD` to the `no-diff`/`no-range`
high path.

## Top 3 risks/gaps

1. The two git-path failure outcomes (not-a-repo vs bad-ref) are promised but cannot be
   produced through the cited `runGit`, and `handleGate` has no reachable git mechanism for
   its `rev-parse --show-toplevel` probe (R3-1).
2. The e2e `.gitignore` is uncommitted, so it re-enters `touched`/`stats` and the fixture
   again mis-reports the change set (R3-2).
3. A post-checks `success: false` (saveReview throw, unresolvable ref discovered late) has
   no implementation-skill route (R3-4).

## Top 3 conclusions to challenge

1. **Error Handling items 2/3 as two distinct outcomes.** Challenge: `runGit` returns only
   `{ stdout, ok }` and `handleGate` cannot call it; the split is not implementable as
   written.
2. **"commit `C0` adds `src/auth.ts`" (Testing Strategy, with the new `.gitignore`).**
   Challenge: an uncommitted `.gitignore` is itself untracked and pollutes `touched`; the
   R2-2 fix is incomplete without committing it.
3. **AC 6.1 "call the gate without `baseRef`, yielding `risk: high`."** Challenge: not on a
   repo with no commits — there the resolve-first step fails and the gate returns
   `success: false`.

## What's missing before acting

- Name one git-invocation mechanism for the repo-existence probe and make the two failure
  messages (not-a-repo, bad-ref) derivable from information `runGit` actually surfaces
  (R3-1).
- Commit `.gitignore` in the e2e fixture (R3-2).
- Give Component 8 a route for a gate `success: false` after `logged: yes` (R3-4).
- Fix item 3's message to name the failing selector (R3-3) and note the unborn-`HEAD` case
  (R3-5).

## Verdict

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 4
DESIGN_READY: no
ESCALATE: none
```
