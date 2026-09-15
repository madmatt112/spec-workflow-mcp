# Adversarial Analysis — spec-lint/requirements (v3)

Round 3. Primary surface: completeness, ambiguity, scope. Fresh lens: the cost of
touching an existing component (its tests, fixtures, e2e assumptions). Rounds 1 and 2
used wire contracts and the contradiction truth table.

Method: pulled the v2→v3 diff (`git diff 1e06fbf f556eee`), attacked the three accepted
fixes and the prose/decision trim first, then applied the fresh lens to every existing
artifact Requirements 8, 9 and 10 edit. Re-verified every citation the delta touched or
newly leans on, at both ends: `briefs.md:187-188` (reviser disposition rule 2),
`src/tools/adversarial-review.ts:318` (read-cited-files directive), `briefs.md:115-117`
(Alignment), `briefs.md:97-146` (round-section template), `SKILL.md:27/95-97/106-108/
128-129/143/159-162/193-206/227`, `harness/agents/sdd-document-orchestrator.md:19-46`,
`references/cleanup.md:17-22/62-85`, `docs/SDD-HARNESS.md:241-248`,
`docs/TOOLS-REFERENCE.md:5/18-33`, `src/tools/index.ts:16-31`,
`src/core/mdx-validator.ts:26-45`, `src/core/task-validator.ts:104-112`,
`src/tools/approvals.ts:369-391`.

## Delta check — the three v3 fixes and the trim

- **R2-1 (9.2 reword) — landed, but over-corrected. See R3-1.** The new bullet routes
  fixed citations to the reviewer via the `## Changes` diff. That closes R2-1's hole for
  D = 1; it opens a new inaccuracy for D > 1.
- **R2-2 (Req 3 "never needed" → "fires far less often") — resolved.** The user story no
  longer contradicts 8.9 (fallback kept) or 3.2 (first-error-only MDX). Clean.
- **R2-3 (5.1 drops `field`) — resolved.** 5.1 now maps `line` and `message` only, folds
  `field` into `message`, and 1.6's shape (`{ file, line, column?, rule, severity,
  message }`) is unbroken. `task-validator.ts:104-112` confirms the `taskId` error 5.2
  cites is a real `severity: 'error'` push.
- **Trim (Introduction, Alignment, D1–D15, Scope notes) — no criterion or chosen
  decision lost.** 10 `### Requirement` headings, 10 `#### Acceptance Criteria` blocks,
  `wc -w` 3491 against the 3,500 cap. D5/D9/D12 dropped only the rejected alternative
  ("not a new parser", "over none", "not the tool or `adversarial-review`") and D9's "the
  entry lists it" traceability line — none carries testable content, consistent with the
  v2 pattern the memory recorded. `wc -w` headroom is 9 words (see R3-1 note).
- **Citations — all accurate.** No misstated artifact in the delta; three rounds now
  find none. `briefs.md:187-188` is disposition rule 2 ("Verify every citation you add or
  change … Read both ends of a line range"), so 9.2's "only the reviser checked those"
  cite is grounded. `adversarial-review.ts:318` is the read-cited-files directive 9.2
  keeps.

## Findings

### R3-1 — SHOULD_FIX (Compounding on R2-1) — 9.2's "re-verify any citation the `## Changes` diff touches — only the reviser checked those" over-claims for D > 1

The reworded 9.2 tells the reviewer: (clause 1) a rule with no finding listed below
"passed only that pre-fix run — verify meaning only for it"; (clause 2) "Re-verify the
path and range of any citation the `## Changes` diff (9.4) touches — only the reviser
(`briefs.md:187-188`) checked those." Clause 2 is true for D = 1 but false for D > 1, and
it fights the tool's own reason to exist.

Trace D = 2 against Requirement 8's own steps:

- Step 3 revises v1 → v2 and checkpoints (`SKILL.md:143`). The round-1 reviser edits and
  adds citations here.
- **8.1 puts a Lint step at Step 3 item 5**, so `spec-lint` runs on **v2** and checks
  every v2 citation — including the round-1 reviser's new ones — *before* the round-2
  prompt is built (the loop returns Step 3 → Step 2).
- 9.1: the Machine-verified bullet is "filled from the lint response," i.e. the **v2**
  lint. Clause 1 therefore already reports the round-1 reviser's citations as passed
  (they are not in 9.3).
- 9.4 / D13: for D > 1 the diff base is the previous version's last commit, "so the
  reviewer sees the whole delta." The `## Changes` diff for round 2 spans v1 → v2, so it
  contains the round-1 reviser's citation edits **and** any v2 lint-pass edits.

So for round 2 the reviewer is told, of the same round-1 reviser citations: clause 1 —
"the citation checks passed the lint, verify meaning only"; clause 2 — "re-verify path
and range, only the reviser checked those." The provenance claim "only the reviser
checked those" is false: the v2 Lint step (8.1) machine-checked them. And clause 2 makes
the reviewer re-run path/range checks on the whole delta — the exact citation work the
Alignment says this tool exists to remove ("moving citation and structure checks off the
Opus reviewer"). Only the **lint-pass** edits (the in-place fixes the once-per-version
lint at 8.5 never re-ran) genuinely need reviewer re-verification; for D > 1 those are a
subset of the diff the reviewer cannot distinguish.

Fix: scope clause 2 to the lint-pass edits, not the whole `## Changes` diff — either
adopt R2-1's option (a) (re-lint after the lint pass so `data.checks`/`data.findings`
describe the reviewed version and no diff re-verify is needed), or have the script mark
the lint-pass commit's slice of the diff separately so clause 2 can point at only that.
Note the 9-word cap headroom: the reword must not grow the document past 3,500.

### R3-2 — MINOR (Novel) — 10.2's "exactly those seven findings … and nothing else" is a brittle fixture assertion

10.2 asserts the tool reports "exactly those seven findings, each with its line, and
nothing else." The tool's own rules make that count fragile:

- A tasks fixture with "an unclosed `_Prompt`" can trip **two** `tasks-format` findings,
  not one: `validateTasksMarkdown` emits the `prompt` closing-underscore warning
  (`task-validator.ts:205-215`) and, when the unclosed prompt swallows the sections, a
  `prompt_structure` warning (`:217-229`).
- The requirements fixture must be "200 words over" a cap — a long document — while
  carrying "a non-EARS criterion." Every other numbered item under `#### Acceptance
  Criteria` (4.1) must stay EARS-valid, and any block with a resolved citation must clear
  the `citation-identifier` heuristic (2.5), or the count exceeds seven.

The fixture is author-controlled, so this is achievable, but the criterion as written
will cost fixture-tuning rounds. State that the fixture must be minimal and crafted to
suppress incidental findings, or assert on the presence of the seven expected rule/line
pairs rather than exact-set equality.

## Fresh lens — existing components Req 8/9/10 touch

Checked each named artifact for a test or fixture the change would break:

- **`registerTools()` (`src/tools/index.ts:16-31`)** — 12 entries today; no test asserts
  the count (`grep` for `toHaveLength`/`registerTools` in `__tests__` finds none). Adding
  spec-lint breaks no count test. `TOOLS-REFERENCE.md:5` already says "11 tools" while the
  table lists 12 and the array holds 12 — a pre-existing drift 10.4 incidentally corrects
  by setting the count to the post-registration array length. Clean.
- **`adversarial-review.ts` scaffold test (`adversarial-review.test.ts:560`)** — asserts
  the tool's own standing-directives/verdict block. Req 9 changes `briefs.md` and
  `sdd-reviewer.md`, not the tool, so the scaffold test stays green. Clean.
- **`briefs.md`, `SKILL.md`, `sdd-document-orchestrator.md`, `cleanup.md`,
  `sdd-reviewer.md`, `SDD-HARNESS.md`, `TOOLS-REFERENCE.md`** — no unit test snapshots
  their content; `grep` for `lint-brief`/`Machine-verified`/`Word caps`/`spec-lint`/
  `Changes since` in `src`/`test`/`scripts` finds nothing. The only integrity gate is
  `check:plugin-assets` (byte-match to `plugins/`), which 10.5 covers. Clean.
- **Reused validators (`mdx-validator`, `task-validator`, `gate-rules`, `approvals`)** —
  Req 3.1 says the lint reuses `validateMarkdownForMdx` and does not re-implement the
  approval check, so no existing validator test is disturbed. Clean.

## Top risks / gaps

1. **R3-1** — the round prompt's citation guidance is right for round 1 and wrong for
   later rounds: it tells the reviewer to re-verify delta citations the subsequent Lint
   step already checked, with a false "only the reviser checked those" justification,
   re-importing the work the tool was built to remove.
2. **R3-2** — the e2e acceptance count ("exactly seven … nothing else") is fragile
   against the tool's own multi-finding validators and identifier heuristic.
3. **Cap headroom (9 words)** — the document sits 9 words under the cap. R3-1's reword and
   any 10.2 clarification must trade words out, or the fix trips 6.1's own `doc-words`.

## Top 3 conclusions to challenge or reverse

1. **9.2 clause 2: "any citation the `## Changes` diff touches — only the reviser checked
   those."** Reverse for D > 1: the whole-delta diff (D13) includes round-reviser edits
   the v<D> Lint step (8.1) machine-checked. Scope the re-verify to lint-pass edits.
2. **The "seven findings, nothing else" e2e contract (10.2).** Soften to "the seven
   expected rule/line pairs are present," or the test author fights the validators' own
   extra findings.
3. **The premise that the once-per-version lint (8.5) plus the diff makes the round
   prompt's guarantee true.** It holds only for D = 1. For D > 1 the guarantee still
   conflates "checked by the lint on the reviewed version" with "checked only by the
   reviser." R2-1 moved the conflation from bullets to the diff; it is not gone.

## What's missing before acting

- Decide the lint-freshness contract once (R3-1): re-lint after the lint pass, or mark the
  lint-pass slice of the diff. Until then the round prompt cannot both claim machine
  verification (clause 1) and demand reviewer re-verification (clause 2) of the same
  citations without a false provenance line.
- A worked D = 2 example — show the round-2 Machine-verified bullet plus the v1→v2 diff —
  would expose R3-1 on paper before code.
- Reword 10.2's assertion to match the tool's multi-finding behaviour (R3-2).

ESCALATE: none — the tool spawns nothing (1.9, D15), reads only under the three
`safeJoin` bases (NFR Security), and performs no destructive, auth, money or data
operation.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
