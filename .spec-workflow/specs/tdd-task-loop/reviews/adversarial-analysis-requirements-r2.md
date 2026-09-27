# Adversarial Analysis — tdd-task-loop/requirements (v2), Round 2

Primary attack surface: completeness, ambiguity, scope. Fresh lens: a cold read for
internal contradictions and a truth table of the stated cases (Test-line classification,
malformed-line handling, red-on-base proof, risk tiers).

## What I checked and how

- Read the target, the memory file, the round-1 analysis, `codebase-context.md`,
  `agent-rules.md`, and the `## Changes since 48b754c` diff.
- Attacked the v2 delta first. The diff touches: Introduction/Alignment wording; R1 AC3
  (R1-6 fix); R3 AC4 (R1-3 fix); R4 AC9/AC13/AC14 (R1-2/R1-5/R1-4 fixes); the Probe text;
  the R6 anchor (R1-1 fix); D1–D5 condensation; and the Scope notes. The five SHOULD/MINOR
  disposition lines in the Revision History match the delta.
- **Delta citation check.** The only anchor the v2 commit changed is R6:
  `TasksPage.tsx:472-507` → `TasksPage.tsx:1364-1406`. Confirmed accurate: line 1364 is
  `{!task.isHeader && (() => {` — the block that renders for **every** non-header task —
  and line 1384 is the `reviewInfo && reviewInfo.verdict !== 'pass'` findings expander
  behind `expandedFindings.has(task.id)` (1399). R1-1 is correctly resolved; the anchor now
  names the always-shown row, not the pass-hidden expander. No misstated artifact in the
  delta.
- Re-verified the round-1 fixes against code: `check-runner`/`runChecks` one-line behaviour
  (R1-2, AC9 now says "full captured stdout and stderr (not the one-line `runChecks`
  output)" — resolved); AC14 now scopes "command" to configurable keys, git plumbing
  excepted (R1-4 — resolved); AC13 derives `seams` from the parsed task's `tests[]`
  (R1-5 — resolved).
- Applied the truth-table lens to the classification cases and found two seams the fixes
  re-opened. Details below.

## Attack topics and directives

**A. R1 AC1 vs AC3 — the Test-line promotion rule (the R1-6 fix).**
- Challenge the claim that AC1 and AC3 partition the input: AC1 promotes on structure
  alone (path + em dash + call text); AC3 now withholds promotion on a semantic test
  (path is not a test path). Stress-test the line `- Test: src/foo.ts — createWidget()`.
- Stress-test that the parser can even apply "the gate's test-path rule": `isTestPath`
  lives in `src/core/gate-rules.ts:192-198`, not in `task-parser.ts`.

**B. R3 AC4 — the "brief-filled slot" on the implementer template (the R1-3 fix).**
- Challenge the claim that adding a caller-filled slot is free: `harness.ts:664-675` makes
  every non-`SERVER_BRIEF_KEYS` placeholder **required** and fails the action writing no
  file when it is missing.
- Cross-test AC4 against AC8 ("an unmarked task … write no red section and pass no `tdd`
  argument") and the "kill switch" default of the Introduction.

**C. R4 AC13 — the `seams` derivation (the R1-5 fix).**
- Stress-test "the `seam` the parsed task's `tests[]` holds for each `testFiles` path" when
  `testFiles` (the author's committed files, R3 AC6) is a superset of the `Test:` lines.

**D. R8 AC3 — documentation coverage.**
- Challenge that R8's doc list still covers the delta: AC4 added a new implementer-template
  slot, but AC3's TOOLS-REFERENCE list names only the `test-author` template.

## Findings

### R2-1 — MUST_FIX — Compounds: R1-6 (fix-induced) — R1 AC1 and AC3 promote the same line to two different places

The v2 fix appended to AC3: "**and THE parser SHALL NOT promote it to `tests`; it remains
an `implementationDetails` bullet**." That clause now collides head-on with AC1.

- AC1 WHEN: "a task block holds a bullet `- Test:` with **a path, a space-padded em dash
  and a call text**" → SHALL add `{ path, seam }` to `tests` and **SHALL NOT** add it to
  `files` or `implementationDetails`. The trigger is purely structural — it does **not**
  require the path to be a test path.
- AC3 WHEN: "a `Test:` line has … **a path that is not a test path** by the gate's
  test-path rule" → lint `warning`, **and** the parser SHALL NOT promote it; it stays an
  `implementationDetails` bullet.

Feed both the line `- Test: src/foo.ts — createWidget()`. It has a path, a space-padded em
dash and a call text, so **AC1 fires** → add to `tests[]`, keep out of
`implementationDetails`. `src/foo.ts` is not a test path (`isTestPath`,
`src/core/gate-rules.ts:192-198`: needs `.test.`/`.spec.` basename or a test-dir segment),
so **AC3 fires** → do not promote, leave in `implementationDetails`. The two criteria
command the parser to do opposite things with one line: `tests[]` versus
`implementationDetails`, promote versus withhold.

Before the fix, AC3 only mandated a lint warning and left the parser destination open
(that was the R1-6 MINOR). The fix over-corrected: it wrote a parser behaviour into AC3
whose condition (non-test path) overlaps AC1's structural trigger without reconciling the
two. To close it, either add "a **test** path" to AC1's WHEN so AC1 and AC3 partition the
space, or drop AC3's "SHALL NOT promote" clause and let AC1 promote while lint warns. As
written it is a contradiction the parser cannot satisfy. Grounded: the bullet fallthrough
that would receive it is `src/core/task-parser.ts:289-296`, and `isTestPath` is not in the
parser's module, so AC3 also silently introduces a new parser→`gate-rules` coupling AC1
never mentions.

### R2-2 — SHOULD_FIX — Compounds: R1-3 (fix-induced) — the new implementer slot is a required placeholder, so the unmarked-task brief fails

R3 AC4's fix: "THE `implementer` template SHALL gain a **`brief`-filled slot** for this
section." A `brief`-filled slot is a `{{key}}` filled from the caller's `values`, not a
server key. The `brief` action treats every such placeholder as **mandatory**:

- `src/tools/harness.ts:665` — `required = [...keys].filter(key => !SERVER_BRIEF_KEYS.has(key))`
- `src/tools/harness.ts:666-675` — a `required` key whose value is `undefined`/`null`
  returns `success: false, "no file written"`.

`SERVER_BRIEF_KEYS` is only `{agentRules, taskBlock}` (`harness.ts:538`). So a new caller
slot on the shared `implementer` template becomes required for **every** implementer brief.
But R3 AC8 says an unmarked task "SHALL spawn no author, **write no red section and pass no
`tdd` argument**," and the implementer brief for every task is built through this same
`harness brief template: implementer` call (`SKILL.md:105-110`). An orchestrator that
follows AC8 literally — passes no red-tests value for an unmarked task — makes the action
fail and write no file, so the **default, kill-switch path (a task with no `Test:` line)
produces no implementer brief at all.**

The document never states the slot is optional or server-defaulted, and "`brief`-filled"
points away from the one safe route (adding the key to `SERVER_BRIEF_KEYS` with an empty
default). Resolve one of: (a) add the slot to `SERVER_BRIEF_KEYS` and default it empty when
no author ran; or (b) state that the orchestrator passes an empty value for unmarked tasks.
As worded, AC4 and AC8 combine into a wrong implementation of the primary path.

### R2-3 — MINOR — Novel — R4 AC13 `seams` has no entry when `testFiles` exceeds the `Test:` lines

AC13 derives `seams` as "the `seam` the parsed task's `tests[]` holds for each `testFiles`
path." `testFiles` comes from the author's report (R3 AC6), and the author MAY commit more
than one test file (R2 AC10, "its test files"; R2 AC6 lets it add tests). A committed
`testFiles` path that is not named on a `Test:` line has no matching `tests[]` entry, so its
`seam` is undefined. State the fallback (drop the path from `seams`, or emit an empty seam)
so the response shape and the Jev payload (R7 AC3) are total over `testFiles`.

### R2-4 — MINOR — Novel (relates to R1-3) — R8 AC3 does not require documenting the new implementer-template slot

The v2 fix added a slot to the shipped `implementer` server template, but R8 AC3's
TOOLS-REFERENCE list still names only "the `test-author` template." A new placeholder on an
existing template is a documentable server-surface change. Add it to AC3's list, or state
it is an internal fill not surfaced in TOOLS-REFERENCE.

## Checked and fine (no finding)

- AC9 vs AC12 timeout precedence: "base run **times out**" (AC12 → inconclusive) and "base
  run **exits non-zero**" (AC9 → classify) are distinct process outcomes (a killed process
  does not return a clean exit code), so they do not collide. Fine.
- Base/head outcome enumerations (AC13) are total: `base ∈ {assertion-red, structural-red,
  vacuous, inconclusive}` is produced by AC9/AC10/AC12; `head ∈ {pass, fail, not-run}` by
  AC11 and the base-fail short-circuits. Risk tiers (R5 AC2/AC3) force `high` only for
  structural-red/inconclusive/amended, leaving the assertion-red happy path on the normal
  fast path — internally consistent, and the cost outcome survives.
- R1-2 and R1-4 fixes (AC9 full stdout/stderr; AC14 configurable-command scope) resolve the
  round-1 findings without re-opening a seam.

## Top 3 risks / gaps

1. The Test-line promotion rule contradicts itself (R2-1): AC1 promotes any structurally
   valid `- Test:` line; AC3 withholds a non-test-path one. The parser cannot obey both, and
   the fix quietly assumes the parser knows `isTestPath`.
2. The default (no-`Test:`) path breaks (R2-2): a required implementer slot plus AC8's "pass
   nothing" means unmarked tasks get no implementer brief — the exact "kill switch" the spec
   sells.
3. Carried design gap (round-1, unnumbered, still open): R5 AC7 + D10 require a review
   recorded by `review-task record` to carry "the `tdd` block of that task's latest gate
   run" without the caller passing it, but the gate and the record are separate calls and no
   store/key is named. Not re-raised as a numbered finding (it is a design-phase WHERE), but
   still unresolved going into design.

## Top 3 conclusions to challenge or reverse

1. **"The R1-6 fix settled the malformed-line handling."** Reverse: it introduced a
   contradiction with AC1 (R2-1). Pick one owner of promotion.
2. **"Adding a slot to the implementer template resolves R1-3 cleanly."** Reverse: the
   `brief` action makes the slot required, so the resolution breaks the unmarked path unless
   the slot is server-defaulted (R2-2).
3. **"The classification/gating logic is internally closed."** Mostly true, and I say so —
   but only after AC1/AC3 (R2-1) is reconciled, because that pair is where the case set
   double-answers.

## What's missing (before design)

- A single owner of `- Test:` promotion, with AC1's WHEN and AC3's non-promotion clause
  made mutually exclusive (R2-1).
- A statement that the implementer's red-tests slot renders empty for unmarked tasks, and
  the mechanism (server key vs empty caller value) that keeps the `brief` action from
  failing (R2-2).
- The `seams` fallback when `testFiles` is a superset of the `Test:` lines (R2-3).
- The persistence store/key for "the latest proof" between the gate and the verifier's
  `review-task record` (carried from round 1; R5 AC7 / D10).

## Verdict

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 1
MINOR: 2
DESIGN_READY: no
ESCALATE: none
```
