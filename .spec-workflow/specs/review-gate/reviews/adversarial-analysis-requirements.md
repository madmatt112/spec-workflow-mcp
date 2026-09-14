# Adversarial Analysis — review-gate/requirements (v1)

Round: R1 (first review). Reviewer lens for this round: completeness, ambiguity, scope,
plus wire contracts across the `review-task gate` boundary. No prior version exists, so
there are no deltas to attack first; the whole document is fresh surface.

## What I checked and how

- Read the target document end to end and every code artifact it cites, both ends of
  each range: `src/tools/review-task.ts` (30-73, 152-261, 413-508), `root-selection.ts`
  (51-56, 195-215), `git-utils.ts` (27-51), `task-diff.ts` (8-14, 135-175, 263-291),
  `typecheck.ts` (8-49, 124-140), `hygiene-signals.ts` (4-50), `task-review-manager.ts`
  (10-27, 62-132, 185-311), `get-task-review.ts` (103-141), `spec-status.ts` (153-205),
  `path-utils.ts` (208-226), `multi-server.ts` (1913-1960), `task-parser.ts` (160-300),
  `ledger.ts` (93-99, 296-310).
- Read the harness contracts it edits: `sdd-implementation-phase/SKILL.md`,
  `sdd-closeout-phase/SKILL.md`, both `references/briefs.md`, the three agent files
  (`sdd-implementation-orchestrator.md`, `sdd-closeout-orchestrator.md`,
  `sdd-verifier.md`, `sdd-implementer.md`), and `agent-rules.md`.
- Read the scope sources: decomposition entry `### 4. review-gate`,
  `docs/harness-efficiency-plan.md` (8-9, 126-128, 164-167, 176) and
  `docs/step-0-answers.md` (9-17). Every plan/step-0/decomposition citation in the
  document's Introduction and Alignment sections checks out.
- Grepped the harness for every "run … checks" instruction to test Requirement 6.5.

Citation spot-check result: plan lines 8-9, 126-128, 164-167, 176 are correct;
`path-utils.ts:208-210` (`getWorkflowRoot`), `git-utils.ts:45-50` (`scrubbedGitEnv`),
`review-task.ts:179-183`/`224`/`251-260`, `task-diff.ts:169-170`, `ledger.ts:93-99`/`303`,
`spec-status.ts:179-193`, `multi-server.ts:1913-1944`, `TOOLS-REFERENCE.md:399-437`,
`SDD-HARNESS.md:233-238` all verify. One citation is wrong on behaviour: see R1-1.

## Attack topics and directives

### Topic A — Requirement 3.3, the test-naming span (`task-parser.ts:226-298`)
- Challenge the claim that the parser's task block runs "through the line before the next
  task line **or heading**": `task-parser.ts:175` bounds the block at the next *checkbox*
  only, not at a heading.
- Stress-test the case of a `## Phase N tests` heading sitting between two tasks: under
  the real span it lands inside the earlier task's block.
- Force the author to pick one definition — the prose ("or heading") and the cited code
  disagree inside a single acceptance criterion.

### Topic B — Requirement 7.2 home items vs Requirement 1.3 / 1.8 (git at `root`)
- Challenge the assumption that every `root` is a git repository: home items land in
  `~/.claude/` with "no commit" (`sdd-closeout-phase/SKILL.md:71,113`), which is not a git
  checkout (the commit script at `references/briefs.md:44-60` is only used by
  store/harness/code).
- Stress-test AC 1.8 "no git repository at `root` ⇒ `success:false`" against AC 7.2
  "check that every listed path exists under `root`, risk not scored."
- Stress-test AC 1.3 "WHEN gate runs THEN it SHALL run, in `root`, … diff statistics"
  when `root` has no git.

### Topic C — Close-out routing (Requirement 7) vs the close-out skill it edits
- Challenge the completeness of Requirement 7 against Requirement 6: 6.2 and 6.5 name the
  exact skill lines and brief lines to edit; 7 names none for the close-out verify brief
  (`sdd-closeout-phase/references/briefs.md:112-138`) or step 4 (`SKILL.md:121-124`).
- Stress-test AC 7.4 "brief lists only the high-risk items with their gate results" — the
  current brief lists every item and tells the verifier to run the checks.
- Challenge the omission of a ledger `note` for close-out gate calls (6.6 has one; 7 has
  none), against the plan's step-4 measurement of skipped verifier spawns.

### Topic D — The typecheck wire contract (`typecheck.ts:124-140`, `review-task.ts:452`)
- Challenge "the typecheck" as a singular: `runProjectTypecheck` returns
  `TypecheckResult[]`.
- Stress-test AC 4.1b (fail on an `inScope:true` diagnostic) and AC 3.1e (risk on
  `unavailable`/`timeout`) when the array holds more than one result.
- Challenge the precedent: prepare collapses to `typecheckResults[0]` only for the
  *methodology display*, not for a gate/risk decision.

### Topic E — The gate-fail loop terminus (Requirement 6.3, hygiene D8)
- Challenge that "fix rounds after a gate fail count against the existing cap of three"
  fully defines the loop: nothing states what happens when the gate still fails after
  three rounds.
- Stress-test D8 "fail on `debugger` only … the scan reads whole files": a pre-existing
  `debugger` in any touched file fails the gate with no code the implementer's task added.
- Challenge whether the existing adjudicator path (`SKILL.md:89-96`), built for verifier
  findings, can resolve a mechanical gate fail.

## Findings

### R1-1 — MUST_FIX — Requirement 3.3 misstates the parser's task-block span
AC 3.3 defines the test-naming block as "its task line through the line before the next
task line **or heading**, the span the parser reads (`src/core/task-parser.ts:226-298`)."
The parser does not stop at a heading. `task-parser.ts:175` sets
`endLine = idx < checkboxIndices.length - 1 ? checkboxIndices[idx + 1] : lines.length`, and
the metadata loop (line 226) runs to that `endLine`. The block is bounded by the next
*checkbox* only; headings between two tasks fall inside the earlier task's span. The prose
("or heading") and the cited behaviour contradict each other, and the cited behaviour is
wrong. Functional consequence: a heading such as `## Unit tests` between task N and task
N+1 makes task N score as "names tests" (AC 3.1c) even when task N never mentioned tests,
flipping it to `risk: high`. A misstated artifact behaviour is an automatic MUST_FIX; here
it also changes the risk score. Fix by defining the scan span explicitly (and, if a
heading boundary is wanted, state it as new behaviour, not as "the span the parser reads").

### R1-2 — MUST_FIX — The home-item gate contradicts "no git repository at `root`"
AC 7.2 routes class `home` items (in-place edits under `~/.claude/`, "no commit",
`sdd-closeout-phase/SKILL.md:71,113`) through the gate with `files` and no `commit`,
expecting a plain path-existence check (AC 4.1e) with "risk not scored, `data.risk` low."
But `~/.claude/` is not a git checkout — the close-out commit script
(`references/briefs.md:44-60`) is only used by store/harness/code. AC 1.8 makes "no git
repository at `root`" a hard `success:false`, and AC 1.3 requires the gate to "run, in
`root`, … diff statistics" unconditionally, which needs git. So the home-item path AC 7.2
promises cannot run: the gate either returns `success:false` (AC 1.8) or has no diff to
compute (AC 1.3). The document specifies a path it also forbids. Fix by carving the
files-only / non-git item gate out of AC 1.3 and AC 1.8 (or by requiring the caller to
pass a diff range for every gated item and dropping the home path).

### R1-3 — SHOULD_FIX — Requirement 7 does not edit the close-out verify brief or step 4
Requirement 6 names the exact edits for the implementation phase: 6.2 replaces step 4
(`SKILL.md:84-88`) with the gate call, 6.5 replaces line 124 of the impl verifier brief.
Requirement 7 restructures close-out (gate per item, verifier only for high-risk
harness/code, "brief lists only the high-risk items with their gate results," "not re-run
the checks the gate ran") but gives no acceptance criterion to edit
`sdd-closeout-phase/SKILL.md:121-124` (Verify) or the close-out verify brief template
`sdd-closeout-phase/references/briefs.md:112-138`, which today lists every item and says
"run the checks listed." An implementer who follows the requirements literally inserts the
gate but leaves the close-out verifier processing all items and re-running checks — the
opposite of AC 7.4. Add the close-out skill/brief edits, parallel to 6.2/6.5.

### R1-4 — SHOULD_FIX — Typecheck array reduction unspecified for gate/risk
`runProjectTypecheck` returns `TypecheckResult[]` (`typecheck.ts:124-140`). AC 4.1b ("the
typecheck ran with status `success` and reports at least one diagnostic with
`inScope:true`") and AC 3.1e ("the typecheck did not run … status `unavailable` or
`timeout`") both treat "the typecheck" as one result, and AC 1.6 fixes `data.typecheck` to
a single methodology-state kind (`review-task.ts:45-52`). prepare reduces to
`typecheckResults[0]` (`review-task.ts:452`) but only for the display methodology, not for
a fail/risk decision. The document never says how the gate reduces multiple results (first
result, any-fail, all-must-pass). This is a wire-contract ambiguity that changes when the
gate fails and when it raises risk. State the reduction (e.g. "any result with an
in-scope diagnostic fails; any result `unavailable`/`timeout` raises risk").

### R1-5 — SHOULD_FIX — The verifier's standing rule still says "run the task's checks yourself"
AC 6.5 edits only the per-task verifier brief (`sdd-implementation-phase/references/briefs.md:124`).
The verifier *agent's* standing rule (`harness/agents/sdd-verifier.md:26`) still reads
"read the files it names … run the task's checks yourself." The verifier reads both on
every spawn; after this spec the high-risk verifier is meant not to re-run the checks the
gate already ran (AC 6.5). Leaving line 26 unedited leaves the verifier a direct
contradiction and re-runs the checks the gate ran, eroding the token saving that justifies
the spec. Requirement 8 ("surfaces that stay as they are") does not list
`sdd-verifier.md:26` as intentionally frozen. Name this edit, or state why line 26 stays.

### R1-6 — SHOULD_FIX — No ledger note for close-out gate calls; step-4 measurement misses close-out skips
AC 6.6 requires one ledger `note` per implementation gate call "so step 4 of the plan can
count skipped verifier spawns (`docs/harness-efficiency-plan.md:164-167`)." Requirement 7
has no equivalent for close-out, yet close-out is where the largest number of verifier
spawns are skipped: every `store` and `home` item never reaches a verifier (AC 7.3). With
no note, step 4 cannot count those skips, and step-0 fact 2 (hook spawn events carry no
token usage, `docs/step-0-answers.md:14`) means the skipped work leaves no other trace.
Add a close-out ledger-note requirement mirroring 6.6.

### R1-7 — SHOULD_FIX — No defined terminus for a gate that still fails after the cap
AC 6.3 says a gate fail triggers "one implementer fix round … and call the gate again.
Fix rounds after a gate fail count against the existing cap of three (`SKILL.md:89-96`)."
It never says what happens when the gate still fails after three rounds. The existing cap
path (89-96) escalates to `sdd-adjudicator` then a *narrow verification* that runs
`review-task prepare`+`record` — i.e. a verifier spawn — which contradicts "gate fail ⇒
spawn no verifier," and the adjudicator is built to rule on verifier findings, not a
mechanical gate fail. A concrete trigger: D8 fails the gate on a `debugger` signal, and
`computeHygieneSignals` scans whole files (`hygiene-signals.ts:21-50`), so a pre-existing
`debugger` anywhere in a touched file fails every round with nothing the task's implementer
can fix — the loop wedges with no defined exit. Define the terminal behaviour of a
persistent gate fail.

### R1-8 — MINOR — `root` vs `projectPath` interaction is unstated
The existing tool overrides the workspace through `projectPath` (`root-selection.ts:202-209`),
and `selectRoots` derives the workflow root from it. AC 1.2 adds a new `root` argument
defaulting to "the workspace under review." The document never states how `root` and
`projectPath` interact when both are passed, or that the workflow root (agent-rules.md and
the review store) always comes from context/`projectPath` while `root` governs only git,
checks and `data.touched`. In the harness flow the skills pass neither `projectPath` (they
rely on context) so this will not bite in practice, but a direct caller has no contract.
One sentence resolves it.

## Top 5 risks / gaps

1. R1-2 — the home-item close-out path is specified and simultaneously forbidden; the
   close-out promise "Markdown and memory items close without an LLM spawn" cannot execute
   for memory (home) items as written.
2. R1-1 — the risk score for the test-file rule is wrong whenever a heading with the word
   "test" sits between tasks; this is exactly the conservative-default rule the plan (126-128)
   demands be correct.
3. R1-7 — a persistent gate fail (a flaky/red check, or a pre-existing `debugger`) has no
   exit, and the fallback it inherits re-enters the verifier the gate was meant to skip.
4. R1-3 — close-out gets a gate call but keeps its old verifier brief, so high-risk items
   are not briefed with gate results and low-risk items still trigger a full verifier run.
5. R1-4 — a multi-`tsconfig` result set has no defined reduction, so gate/risk can differ
   between reasonable implementations of the same requirement.

## Top 3 conclusions to challenge or reverse

1. Alignment section: "none of the five [step-0 facts] constrains this spec." Reverse this.
   Step-0 fact 2 (SubagentStop carries no token usage) is the reason a *skipped* spawn
   leaves no token trace, which is exactly why the ledger note (AC 6.6) exists — and why
   its absence in close-out (R1-6) makes the spec's headline saving unmeasurable. The fact
   does constrain the spec's verification.
2. D8: "fail on `debugger` only … `console.*` and `TODO` appear legitimately … the scan
   reads whole files, not changed lines." The whole-file property is used to justify *not*
   failing on console/todo, but it makes the `debugger` fail equally blind to authorship: a
   `debugger` the task never touched fails the gate and (R1-7) wedges the loop. Either scan
   changed lines for `debugger`, or define the escape.
3. D3 / AC 6.1: the recorded `baseRef` is presented as the clean way to bound the change.
   Challenge its resilience: any `[-]` task resumed from an interrupted run has no base ref
   and is forced to `risk: high` (AC 6.1, 3.1f), which re-spawns the verifier. In a harness
   that resumes on budget caps and interruptions, this quietly returns spend toward the
   pre-spec baseline; the document should state the expected frequency or a cheaper resume.

## What's missing (do before acting on this document)

- Resolve the non-git `root` case (R1-2): decide whether item gates always require a diff
  range, and re-scope AC 1.3 and AC 1.8 accordingly.
- Give the test-naming span one unambiguous definition and stop citing the parser for a
  behaviour it does not have (R1-1).
- Add the close-out skill and brief edits, and the close-out ledger note, so Requirement 7
  is as concrete as Requirement 6 (R1-3, R1-6).
- Pin the typecheck-array reduction and the gate-fail terminus (R1-4, R1-7).
- Align `sdd-verifier.md:26` with the new "don't re-run gate checks" rule, or freeze it
  explicitly in Requirement 8 (R1-5).

## Verdict

```
VERDICT: iterate
MUST_FIX: 2
SHOULD_FIX: 5
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
