# Adversarial Analysis — spec-lint/requirements (v2)

Round 2. Primary surface: completeness, ambiguity, scope. Fresh lens: a cold read
for internal contradictions and a truth table of the stated cases (which rule yields
which severity, which severity blocks what, and what the round prompt vs the approval
path each do with each result). Round 1 used the wire-contracts lens.

Method: pulled the v1→v2 diff (`git diff 7fd4c64 1e06fbf`), attacked the delta first,
then ran the truth table. Re-verified every citation the reviser touched at both ends:
`briefs.md:151`/`:156` (reviser-brief title and Job), `src/core/task-validator.ts:205-215`
(the closing-underscore warning), `src/core/gate-rules.ts:73-93` (parseSensitivePaths
bullet-scan), `src/tools/root-selection.ts:36-40` (the four-tools comment),
`src/tools/index.ts:16-31`/`:17-30` (twelve entries) and `:75-76` (unknown-tool throw),
`docs/TOOLS-REFERENCE.md:5` ("11 tools"), `docs/SDD-HARNESS.md:241-248` ("Three lines
are machine-read"), `src/tools/adversarial-review.ts:318` (the read-cited-files
directive), `harness/skills/sdd-document-phase/SKILL.md:193-206` (Step 5 fallback).
Re-ran the D4 EARS probe under 4.1/4.2's own scope on both cited documents.

## Delta check — the seven round-1 fixes

All seven landed and none lost testable content:

- **R1-1** (9.2/9.3/3.2 reword) — landed, but the reworded 9.2 introduced a new
  contradiction. See R2-1.
- **R1-2** (D4 EARS counts) — re-probed under 4.1/4.2 scope (numbered items under
  `#### Acceptance Criteria`, continuation lines gathered): review-gate **2 of 52**
  (fails at lines 48, 126), tighter-reviews **2 of 37** (fails at lines 71 and 102 —
  both genuinely lack `SHALL`; line 102 is a `WHEN…THEN` assertion with no `SHALL`).
  D4's restated numbers are exact. Resolved.
- **R1-3** (5.1/D5) — `task-validator.ts:205-215` confirmed a `warning`
  ("Prompt field may be missing closing underscore"). 5.1 now maps straight across
  ("no exception"); D5 agrees. Resolved.
- **R1-4** (8.3 version) — `briefs.md:151` is the `v<D+1>` title, `:156` the `v<D+1>`
  Job line; rule 4 (`:190-195`) carries three more `v<D+1>`. 8.3's "every `v<D+1>`
  changed to `v<D>` … and disposition rule 4 replaced" covers all five. Resolved.
- **R1-5** (1.3) — `root-selection.ts:36-40` reads "Only the four tools named in
  requirement 3.8 use this — review-task, log-implementation, adversarial-review and
  adversarial-response." 1.3 now drops that cross-reference. Resolved; spec-lint is a
  genuine fifth `selectRoots` user because it reads code under `workspacePath`.
- **R1-6** (9.3 info-only) — consistent with 8.2. Resolved.
- **R1-7** (10.4, 6.3) — `SDD-HARNESS.md:241` reads "Three lines are machine-read";
  `TOOLS-REFERENCE.md:5` reads "11 tools" against twelve registry entries; 6.3 now
  says caps are "found by `parseSensitivePaths`'s bullet-scan … each bullet split on
  its first `:`", i.e. mirrors the scan rather than reusing it. Resolved.

The Decisions (D1–D15), Scope notes, User Stories and NFR tightenings dropped only
rejected-alternative framing and "so that"→"so" wording; no acceptance-criterion
content was lost.

## Findings

### R2-1 — MUST_FIX (Compounding on R1-1) — the `Machine-verified` bullet vouches for fixes the lint never re-checked

R1-1's accepted reword changed 9.2 from "every citation's path and line range exist;
do not re-verify" to: "a rule with no finding listed below (9.3) had **every instance
pass** and SHALL NOT be re-verified." That new claim is false for any finding the
reviser fixed, because the lint runs once and is never re-run on the fixed document:

- 8.5: "The Lint step SHALL run **at most once per version**; findings left after the
  pass go to the round prompt (9.3)."
- 8.3/8.4: on any error or warning the orchestrator spawns `sdd-reviser` to edit the
  document in place (D unchanged) — the "lint pass" — and commits `v<D> lint`. No
  second `spec-lint` call follows.
- 9.1: the `Machine-verified` and `Changes` bullets are "filled from **the lint
  response**." There is one lint response per version, produced **before** the reviser's
  fixes.
- 9.3/8.5: the listed findings are the ones "remaining after the lint pass" — i.e. the
  rejected subset. A citation-range/citation-path/coverage-component error the reviser
  **fixed** is therefore *not* listed in 9.3.

Trace it: v1 lint finds a `citation-range` error → reviser edits the range in place →
`v<D> lint` commit → no re-lint. The round prompt's `citation-range` rule now has "no
finding listed below," so 9.2 tells the reviewer it "had every instance pass … SHALL
NOT be re-verified — verify meaning only." But the tool's only actual `citation-range`
result on this version was a **failure**, and the reviser's replacement range was never
machine-checked. If the reviser wrote a plausible-but-wrong range, the reviewer is
explicitly told not to look, and "verify meaning only" will not catch it (the reviewer
reads the cited lines, they look fine, but the true range differs). This is the exact
"do not re-verify something the tool cannot vouch for" defect R1-1 was raised against,
relocated from citations-in-the-same-bullet to fixed-but-unreverified findings.

Sharpening it: 9.4/D13 make the `Changes` diff include the lint-pass edits (for D=1 the
base is the v1 checkpoint, "so the round-1 diff is the lint pass"). So in one prompt the
reviewer *sees the reviser's citation edits in the diff* and is *simultaneously told
those checks passed and must not be re-verified.* The reviser's disposition rule 2
(`briefs.md:187-188`) makes the reviser self-verify its citation edits — but that is the
manual verification the lint exists to replace (Alignment: "moving citation and structure
checks off the Opus reviewer"). Labelling a reviser self-check "Machine-verified … every
instance pass" is a false claim about what ran on the delivered version.

Fix one of: (a) re-lint after the lint pass so `data.checks`/`data.findings` describe the
version the reviewer sees, and amend 8.5; or (b) reword 9.2 so it claims only what the
single pre-fix run established — e.g. "the checks below ran on the drafted version; the
reviser fixed and re-verified the findings it did not list here; re-verify the meaning of
any cited line, and any citation the `## Changes` diff touched."

### R2-2 — SHOULD_FIX (Compounding on round-1 conclusion #2) — Requirement 3's "never needed" contradicts the retained fallback

Requirement 3's user story: "I want the approval's MDX failure caught at write time, so
**Step 5's lint-fix version** (`SKILL.md:199-203`) **is never needed**." The document's
own design contradicts "never":

- Scope notes: "Not linted: the adjudicator's post-cap write (Step 4a). Step 5's
  approval fallback (8.9) catches MDX and tasks-format errors there."
- 8.9: the Step 5 fallback "SHALL stay."
- 3.2: `validateMarkdownForMdx` returns only the first compile error, and 8.5 runs the
  lint at most once per version — so a document with two bare brackets can still reach
  Step 5 with an uncaught second error.

So there is a concrete path (an MDX or tasks-format error introduced by the unlinted
adjudicator write, or a second bare bracket) where Step 5's lint-fix version **is**
needed — which is why 8.9 keeps it. Round 1 flagged this as a conclusion to reverse; the
reviser left the "never" wording. Delete or soften the clause (the reviser's disposition
rule 1 is the mechanism: "when a finding says a rationale clause is false, delete the
clause") — e.g. "so Step 5's lint-fix version fires far less often." The testable
criteria (3.1, 3.2, 8.9) are already correct; only the user-story rationale overclaims.

### R2-3 — MINOR (Novel) — the finding shape has no `field`, but 5.1 maps one

1.6 fixes the finding as a closed shape: "Each finding SHALL be `{ file, line, column?,
rule, severity, message }`." 5.1 says to "map every error and warning to a finding with
rule `tasks-format`, the validator's `line`, `field` and `message`." `field` (e.g.
`prompt`, `prompt_structure`, checkbox-shape) has no slot in 1.6, and because every
task-validator finding collapses to the single rule id `tasks-format`, the message text
is the only discriminator. An implementer reading 5.1 literally may add a `field`
property and break the 1.6 wire contract the orchestrator parses. State that `field`
folds into `message` (the validator's message already names the field), or add `field?`
to 1.6.

## Top risks / gaps

1. The headline deliverable is still self-inconsistent (R2-1): the round prompt's
   "Machine-verified / every instance pass / do not re-verify" language describes a
   pre-fix lint run, while the reviewer reviews the post-fix document and sees the fixes
   in the `## Changes` diff. Fixed citations are the ones most likely to be wrong and are
   exactly the ones the reviewer is told to skip.
2. Requirement 3 advertises a dead fallback that the document deliberately keeps alive
   (R2-2); a reader may cut 8.9 believing the lint made it redundant.
3. `field` has no home in the finding shape (R2-3); a literal implementation breaks the
   response contract.

## Top 3 conclusions to challenge or reverse

1. **9.2's "had every instance pass … SHALL NOT be re-verified."** Reverse it for any
   fixed finding: the once-per-version lint (8.5) never re-checks the reviser's edits, so
   the pass claim is false on the delivered version. Either re-lint or reword to claim
   only the pre-fix run plus the diff-touched citations.
2. **Requirement 3: "so Step 5's lint-fix version is never needed."** Reverse "never":
   the adjudicator's unlinted write and the first-error-only MDX validator both leave a
   path to the Step 5 fallback that 8.9 keeps. Soften the clause.
3. **The "additive, machine-verified" premise for warning rules.** Not a finding —
   9.2's "verify meaning only" correctly preserves testability/meaning judgment for
   heuristic passes (ears-shape, citation-identifier, bridge-missing), so a passing
   heuristic offloads only the mechanical part. This one holds; no change.

## What's missing before acting

- Decide and state whether the lint re-runs after the lint pass, and reconcile 8.5 and
  9.2 accordingly (R2-1). This is the one change that makes the round-prompt guarantee
  true.
- One worked round-1 example — Lint finds a broken citation, reviser fixes it, then show
  the exact `Machine-verified` bullet + `## Changes` diff the reviewer receives — would
  expose R2-1 on paper before code.
- Reword Requirement 3's user story (R2-2) and clarify `field` placement (R2-3).

ESCALATE: none — the tool spawns nothing (1.9, D15), reads only under three `safeJoin`
bases (NFR Security), and performs no destructive, auth, money or data operation.

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 1
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
