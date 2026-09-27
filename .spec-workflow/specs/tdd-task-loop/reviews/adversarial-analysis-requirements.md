# Adversarial Analysis — tdd-task-loop/requirements (v1), Round 1

Primary attack surface: completeness, ambiguity, scope. Fresh lens: wire contracts
across a boundary (router, query params, response shapes, client state).

## What I checked and how

- Read the target, `codebase-context.md`, `docs/tdd-implementation-research.md`, the
  `tdd-task-loop` decomposition entry (spec 11) and `agent-rules.md`.
- The `## Changes since 48b754c` diff block is **empty**: there is no working-tree delta
  from the v1 checkpoint, so there are no deltas to attack first. This is the first review.
- Confirmed **every cited artifact at both ends of its range** against the live code.
  All resolve and describe the code correctly — no misstated artifact, so no automatic
  MUST_FIX from citations. Spot list: `task-parser.ts` 108-128/279-297/318-331;
  `lint-types.ts` 9-15/50-63; `spec-lint.ts` 158-187; `gate-rules.ts`
  34-40/192-198/258-273/280-359/384-437; `review-gate.ts`
  47-70/102-106/192-209/222-243/271-344; `review-task.ts` 249-271/281-312/858-864;
  `check-runner.ts` 5-7/35-44/92-104; `git-utils.ts` 45-51; `types.ts` 253-263;
  `task-review-manager.ts` 108-131/185-313; `spec-status.ts` 179-193;
  `multi-server.ts` 1931-1962; `api.tsx` 444-449; `TasksPage.tsx` 472-507;
  `ledger.ts` 18-24/56-57/246-250; `harness.ts` 485-535/537-538;
  `sync-plugin-assets.cjs` 90-134; `sdd-implementer.md` 1-38; `agent-profiles.json`
  1-74 (12 agents today); `SDD-HARNESS.md` 21-23/313-320; `.gitignore` 164;
  `SKILL.md` 55-68/93-104/209-216; `references/briefs.md` 60-101/127-159; document-phase
  `briefs.md` 184-209; Jev note section 1.3.
- Re-probed the context file's Probe (R4 criterion 9) against the runner: it is accurate
  and, importantly, self-flags the classification trap below (finding R1-3).
- Scope check against the decomposition: the document stays inside spec 11's boundary
  (mark, author, gate proof, Jev shadow) and correctly excludes spec 9 (task view) and
  spec 10 (provider map) in its Scope notes. The one intentional divergence from the
  decomposition's verification scenario (the "already-met" task) is a documented
  RE-DECISION in Scope notes and is sound — an honest author reports RED-IMPOSSIBLE
  (D6) so that task never reaches the gate; the vacuous case is proved in-process (R9-2).
  No finding.

## Findings

### R1-1 — SHOULD_FIX — R6 AC3: the happy-path proof line cannot render for a passing marked task

R6 AC3: "WHEN a review carries a `tdd` block, THEN THE task view SHALL show one line …
also when the review has no findings." The only cited artifact is
`TasksPage.tsx:472-507` (`TaskReviewFindings`). But that component is mounted only inside
the block gated by `reviewInfo && reviewInfo.verdict !== 'pass'` (`TasksPage.tsx:1384`)
**and** behind a click-to-expand toggle (`expandedFindings.has(task.id)`,
`TasksPage.tsx:1399-1401`). The feature's designed happy path — an honest marked task
whose proof is assertion-red / green / unamended — records `verdict: pass` with **no
findings**, so today's UI never mounts anything for it and the toggle never appears. The
cited anchor is therefore insufficient: satisfying AC3 requires an always-visible render
path outside the `verdict !== 'pass'` gate, at `TasksPage.tsx:1364-1406`, not an edit to
`TaskReviewFindings`. An implementer who edits only the cited component ships a feature
that shows the proof for failing tasks and hides it for the exact case the spec exists to
surface. Name the real change site in the anchor set.

### R1-2 — SHOULD_FIX — R4 AC9: classification needs full output, but the cited runner exposes one line

R4 AC9 requires the gate to "classify its **full output** as `assertion-red` … else
`structural-red`" by scanning for `AssertionError` / structural markers. The document's
own Probe (line 91) states: "The last output line is the duration line, so the one-line
check output cannot classify." The cited proof infrastructure —
`check-runner.ts:35-44` (`lastLine`) and `92-104` (`runChecks`) — returns only the last
non-empty line in `CheckResult.output` (≤200 chars). Reusing `runChecks` for the proof
runs (which `docs/tdd-implementation-research.md` §2 explicitly suggests: "`runChecks`
… takes any root, so a throwaway worktree can reuse it") makes the `AssertionError`
marker invisible, so **every** genuine assertion failure falls to AC9's else branch and
is misclassified `structural-red`. That flips the happy path to `tdd-structural-red`
(R5 AC2 → risk high → verifier always spawned), defeating the cost outcome the whole
spec is justified by. AC9 is internally consistent with AC14 (full output for
classification, one line in the response), but the requirement must state that the proof
captures full stdout/stderr for classification and does **not** reuse the one-line
`runChecks` path, or the design will inherit the trap.

### R1-3 — SHOULD_FIX — R3 AC4: no wire for the red section into the server-generated implementer brief

R3 AC4: the marked task's "implementer brief and every fix brief SHALL carry
`## Red tests (from the test author)` with the author's files, the `Test:` lines and the
author's report **verbatim**." But the implementer brief is server-generated:
`SKILL.md:105-110` calls `harness brief template: implementer`, and that template
(`harness.ts:525-534`) is `# {{title}} / read-and-obey / ## Task text / {{taskBlock}}` —
no free-form slot. The author's report is runtime data held by the orchestrator, not a
server value. Neither R2 (which defines only the `test-author` template and its values)
nor R3 nor R8 says how the section reaches the brief: a new `{{redTests}}` placeholder on
the implementer template, a new template, or an orchestrator append after `harness brief`
writes the file. Harness-bookkeeping (spec 6) deliberately moved brief authoring into the
server tool, so a silent "orchestrator hand-edits the file" reintroduces exactly what was
removed. (Fix briefs are less exposed — `SKILL.md:166-169` builds them from the `reviser`
template, whose `{{job}}` slot can carry the section — but the implementer template has no
slot at all.) Specify the injection point across the server/orchestrator boundary.

### R1-4 — SHOULD_FIX — R4 AC14: "run no command other than the two agent-rules keys" collides with the required git plumbing

R4 AC14: "THE gate SHALL … run no command other than the two agent-rules keys." Yet the
same requirement mandates git commands: AC4/AC5 diff the red commit
(`git diff --name-only`), AC6 runs `git worktree prune`, `git worktree add --detach` and
`git worktree remove`, and AC8 copies files into the worktree. Read literally, AC14
forbids the plumbing AC6 requires. The intent (memo §3.4; NFR Security "Only the strings
in `commands` run") is that the only **project-configurable** commands are
`tdd-test-command` and `red-on-base-setup`, with git plumbing as fixed internal
machinery. As written the AC is not verifiable — a test of "runs no other command" fails
on the git calls. Scope the word "command" (e.g. "runs no configurable test/setup command
other than the two agent-rules keys; the gate's own git plumbing excepted").

## Minor (do not keep the loop alive)

### R1-5 — MINOR — R4 AC13: `data.tdd.seams` is in the response but not in any input

The response shape (AC13) carries `seams`, and R7 AC3 says the gate sends "its `Test:`
lines" to Jev, but the gate's `tdd` **input** (AC1) is only `{ testFiles, redCommit }` and
R3 AC6 passes only those two. No AC says the gate derives the seams. It is derivable — the
gate already parses `tasks.md` (`review-gate.ts:161`) and the task's promoted `tests[]`
(R1 AC1) holds `{ path, seam }` — but the derivation should be stated so the output field
and the Jev payload are not orphaned.

### R1-6 — MINOR — R1 AC1/AC3: a malformed `Test:` line has no defined parser destination

AC1 promotes a well-formed line (path + em dash + call) to `tests[]` and forbids `files`/
`implementationDetails`. AC3 warns (lint) on a line with no em dash / empty call / non-test
path. But the parser's handling of the malformed line is unstated: does it still yield a
`tests[]` entry (empty seam) or fall through to `implementationDetails` (`task-parser.ts:289-296`),
inflating the task block against the 150-word cap? The lint reads raw lines so it warns
either way; state where the parser puts it.

## Top 5 risks / gaps

1. The visibility outcome silently fails on the happy path (R1-1): passing marked tasks
   show no proof line under today's `verdict !== 'pass'` mount gate.
2. Output classification misfires if the proof reuses the one-line runner (R1-2), turning
   every assertion-red into a risk-high structural-red and erasing the cost saving.
3. The red section has no defined path into the server-authored implementer brief (R1-3).
4. AC14 is unverifiable as worded and contradicts the mandated git plumbing (R1-4).
5. Cross-call state is unspecified: R5 AC7 + D10 require a review recorded by
   `review-task record` (`review-task.ts:858`, the verifier path) to carry "the `tdd`
   block of that task's latest gate run" without the caller passing it, but the gate and
   the record call are separate invocations and `saveReview` has no access to the earlier
   gate result. "The server keeps the latest proof" (D10) names no store or key. Not
   raised as a numbered finding (the WHAT is decided), but the design must define where the
   latest proof is persisted between the gate call and the verifier's record call.

## Top 3 conclusions to challenge or reverse

1. **"The gate reuses the existing check runner for the proof."** (memo §2, implied by the
   `check-runner` anchors.) Reverse for the proof runs: classification (AC9) needs full
   output, which `runChecks`/`lastLine` do not provide. Keep the one-line rule for the
   response only.
2. **"`TaskReviewFindings` is the visibility surface."** (R6 anchor.) Reverse: it is
   findings-only and pass-only-hidden. The tdd line needs its own render path; the anchor
   set points at the wrong site.
3. **"The tasks phase and briefs need no template change beyond the `test-author` entry."**
   (R1 AC8 "no other section"; R2 as the only template requirement.) Challenge: R3 AC4
   forces a change to the server implementer template (or a new placeholder) that no
   requirement captures.

## What's missing (before design)

- The full-output classifier path for the proof, distinct from the one-line response
  (R1-2).
- The injection mechanism for `## Red tests` into the server-authored implementer brief
  (R1-3).
- The persistence store/key for "the latest proof" between the gate and the verifier's
  `review-task record` (risk 5 / R5 AC7 / D10).
- The gate's derivation of `seams` for the response and the Jev payload (R1-5).
- A `test-author` standing-brief question: R2 AC4 has the author read `requirements.md`,
  `design.md`, `codebase-context.md` and an existing test file, and R2 AC10 has it commit
  under git rules, but R2/R3 name no standing brief (cf. `impl-standing.md`,
  `verify-standing.md`) — the code root, spec dir and git constraints must reach it via
  the `job` value or an equivalent. Confirm in design.

## Verdict

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 4
MINOR: 2
DESIGN_READY: no
ESCALATE: none
```

(TypeSafe data egress under R7/D3 was weighed for ESCALATE: it is public-repo content, a
gitignored key, and tradr stays off pending its DPA — a decided, gated item, not a new
human-review trigger.)
