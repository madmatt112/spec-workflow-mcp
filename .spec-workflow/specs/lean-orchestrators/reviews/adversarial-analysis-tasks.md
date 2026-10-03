# Adversarial Analysis — lean-orchestrators/tasks (v1, round 1)

Attack surface: atomicity, ordering, coverage. Fresh lens: read each `_Prompt:` block
cold (design + requirements only) and judge whether an implementer could complete it
without guessing at a signature, label, path or helper a different task owns.

## What I checked and how

- Read the context map (`codebase-context.md`), `tasks.md` v1, `requirements.md`,
  `design.md`, the decomposition entry 14 (`.spec-workflow/spec-decomposition/decomposition.md:728-782`)
  and `agent-rules.md`.
- Re-verified every citation the v1 lint commit changed (the whole `## Changes since`
  diff): `src/tools/__tests__/harness.test.ts:7,110-116,131-136,243-269,335-402,409-415,491-504`,
  `src/core/task-parser.ts:446-485,490-492`, `harness/skills/sdd-continue/references/formats.md:164-183`,
  `harness/skills/sdd-document-phase/SKILL.md:14-17`,
  `harness/skills/sdd-implementation-phase/SKILL.md:6-13`,
  `harness/skills/sdd-implementation-phase/references/briefs.md:269-279`. All resolve to
  the claimed content; the lint delta is clean (backtick-wrapped Test calls and
  bare→full citation paths only).
- Verified the verbatim brief source ranges in tasks 8 and 9 against the real section
  boundaries of both `references/briefs.md` files (drafter 6-137, gate-A 139-158, round
  160-262, reviser 264-359, lint 361-417, adjudication 418-454, narrow-check 455-480;
  implementer-standing 5-65, implementer 67-101, fix 103-132, verifier-standing 134-156,
  verifier 158-191, task-adjudication 193-207, e2e 209-230, ci-fix 232-253, ci-verify
  255-267, PR-body 269-279). Every cited range maps to its claimed section.
- Verified `orientImplementation` (`src/tools/harness.ts:311-364`), `briefAction`
  (`:595-765`), the placeholder scan (`:717-719`), `BRIEF_TEMPLATES` (six kinds,
  `:493-557`), `reduceSpawn`/`tokenCell`/`usageDelta` (`src/watch/usage.ts:252-367`),
  the tool description "never spawns a process" (`:30-43`) and `usageAction` (`:1215-1244`).
- Ran every count/length grep the tasks pin, against the real tree, to see what each
  returns.
- Checked Test-line seams, success-clause coverage, requirement→task coverage, ordering
  edges, gate-B (new external dependency) and gate-C (over-reach).

Test seams, success-clause coverage, requirement coverage and gate-B/gate-C are clean:
no task names a test absent from the design/earlier prompts; every test a `Task:` body
names also appears in that task's `Success:` clause; every Req 1–8 criterion maps to a
task (8.4 is a retro responsibility, correctly named only in task 15's pending line); no
task adds an external dependency or exceeds the approved requirements.

## Re-decided requirement literal — ruling

**Req 7.3 (runaway-guard basis) → refinement (closed).** Req 7.3 literally says the
guard allowance is sized from "open tasks … read once at phase start." Design D14 and C10
size it from `data.tasks.total`; task 14 follows the design ("Use the task total, not
open tasks"). This stays inside the requirement's stated intent — "the allowance does not
shrink … and cannot trip the guard spuriously mid-phase." The total is always ≥ open, so
the allowance is never smaller and the guard never trips more easily; using the total also
survives a supervisor restart, which an in-memory "held fixed" open count cannot. The
design already adjudicated this (R2-4, accepted, design approved at v4), so it crosses no
human-owned decision and reverses no requirement. Closed as a refinement; I carry to the
next drafter that the Req 7.3 **text** is now stale (still says "open tasks") and could be
reconciled on the next requirements touch — not a blocking finding.

## Findings

### R1-1 — SHOULD_FIX — Task 9: the `reconcile` fix variant has no source text
Task 9 lists the `fix` kind's variants as "gate, verifier, repair, ci from :232-253, and
`reconcile`." Design C6's fix row also lists `reconcile`. Every other variant has a
verbatim source (103-132 for gate/verifier/repair, 232-253 for ci), but `reconcile` has
none, and the prompt gives no text or rule for how it differs from `ci`. Reading cold, the
implementer cannot render the `reconcile` variant without guessing. In today's skill the
"Reconcile a red PR" step (`sdd-implementation-phase/SKILL.md:457-491`) reuses the CI-fix
content (232-253) through the `reviser` template — so either `reconcile` is the same text
as `ci` (and the prompt should say "ci and reconcile from :232-253") or it is distinct
(and the prompt must source it). As written it is an orphan: task 9 cannot build it, and
task 13 (which moves the reconcile step) never names a `reconcile` fix variant to consume
it. Fix: cite the source for `reconcile` or fold it into `ci`.

### R1-2 — SHOULD_FIX — Task 11: the worker-cap grep sweeps in frontmatter and out-of-scope agents
Task 11 says run `grep -rn "150 words\|120 words\|100 words" harness/agents docs/SDD-HARNESS.md`
and "update every worker report cap it finds; orchestrator caps stay." Run against the
tree, that grep returns, besides the eight C9 workers and the four orchestrator caps:
- `harness/agents/sdd-implementer.md:3` — the **frontmatter** `description:` ("…reports
  in 150 words…"). The task's own restriction says "do not change any agent's frontmatter."
  The instruction and the restriction collide on this exact hit; and because the frontmatter
  is frozen, it is left stating "150 words" while the real cap becomes 80 (design C9,
  Req 5.1) — a contradiction the task neither resolves nor acknowledges.
- `harness/agents/sdd-retro-analyst.md:26` — "Report in 100 words or fewer." The
  retro-analyst is **not** one of the eight C9 workers and the retro orchestrator "keep[s]
  its current shape" (decomposition entry 14, requirements Scope notes). Changing its cap
  is scope creep; the grep + "every worker report cap" instruction would pull it in.
- `docs/SDD-HARNESS.md:78` — "each task block 150 words plus its prompt." This is the
  tasks.md task-block size, not a worker report cap; it must not change.

"Orchestrator caps stay" handles the four orchestrator hits but says nothing about these
three. Fix: scope the grep (or name the exact eight worker files), explicitly except the
frontmatter line, the retro-analyst and the task-block line, and state what to do about the
now-stale implementer frontmatter description.

### R1-3 — SHOULD_FIX — Task 13: the 20-task grep edits the supervisor line that task 14 owns
Task 13 says run `grep -rn "20 tasks\|default 20\|20-task" harness docs/SDD-HARNESS.md`
and "update each hit except the historical quote in docs/harness-efficiency-plan.md." The
`harness` scope makes that grep return `harness/skills/sdd-continue/SKILL.md:291` — the
supervisor launch `BUDGET` line — alongside the two intended impl-skill hits (`:16`,
`:17`). But `sdd-continue/SKILL.md` is **not in task 13's File list**, and line 291 is
exactly what **task 14** is written to change ("Change the launch line
(harness/skills/sdd-continue/SKILL.md:291) to BUDGET: <… 5 tasks …>"). So two tasks edit
the same line, and task 13 would touch a file outside its declared scope (which the review
gate scopes against). The one exception the prompt names —
`docs/harness-efficiency-plan.md` — is not even inside this grep's scope
(`harness docs/SDD-HARNESS.md`), so it protects nothing while the real overlap is left
unexcepted. Fix: scope task 13's grep to `harness/skills/sdd-implementation-phase docs/SDD-HARNESS.md`
(or except `sdd-continue/SKILL.md:291`).

### R1-4 — SHOULD_FIX — Task 14: the runaway-guard grep misses the doc statement it must update
Task 14 says "Update the guard text in docs/SDD-HARNESS.md where it states the limit;
`grep -rn "12 orchestrator spawns\|Runaway guard" harness docs` finds each statement."
That grep returns only `harness/skills/sdd-continue/SKILL.md:379`. It does **not** match
the docs statement at `docs/SDD-HARNESS.md:133` — "More than twelve spawns for one phase
is an error" — which spells the number as "twelve" and carries no "Runaway guard" label.
So the grep claim "finds each statement" is false, and a grep-driven implementer leaves
SDD-HARNESS.md:133 unchanged. That statement is phase-agnostic ("for one phase"); after
task 14 the implementation phase allows `max(12, ceil(T/B)+4)`, so left as-is it is an
affirmatively wrong blanket claim in the shipped docs. (The same word-vs-digit mismatch
means task 13's grep would also miss `SDD-HARNESS.md:131` "at most twenty tasks," but
task 13's explicit "Update docs/SDD-HARNESS.md … for the 5-task budget" covers that one.)
Fix: add "twelve"/"Budgets" (or the exact line) to task 14's grep, or point it straight
at `docs/SDD-HARNESS.md:130-134`.

### R1-5 — MINOR — Tasks 7/10: the brief-kind count grep is inert, and tasks 8/9 name no count grep
Task 7 asserts "Count check: `grep -rn "six\|drafter, reviser" src/tools docs/TOOLS-REFERENCE.md`
finds the count words; none change here," and task 10 says run the same grep and "update
every count word it finds." Run against the tree, that grep returns only two false
positives: `src/tools/__tests__/harness.test.ts:50` ("The six fixture states of
Requirement 1.7," unrelated) and `docs/TOOLS-REFERENCE.md:523` ("**Rules** (sixteen…)," a
correct spec-lint-rule count that must not change). "drafter, reviser" matches nothing in
`src`, `docs` or `harness`, and there is no brief-kind count word ("six…") anywhere in the
code or docs. So the guard tracks no real count, and "update every count word it finds"
risks a wrong edit to the correct "sixteen." Meanwhile tasks 8 and 9 — the tasks that
actually raise the kind count from six to ~eighteen — name no count grep at all
(`agent-rules.md` "Documents" expects every count-changing task to). Low harm (no real
count word exists to go stale), hence MINOR, but the instruction is misleading. Fix: drop
the inert grep or point it at a real assertion; drop the false-positive edit risk.

## Top risks/gaps

1. **R1-1** — an unbuildable `fix` variant (`reconcile`) that no later task consumes.
2. **R1-3** — task 13 and task 14 both edit `sdd-continue/SKILL.md:291`; task 13 reaches
   outside its declared files (ordering/scope collision, the core attack surface).
3. **R1-2 / R1-4** — count/length greps that collide with a frozen-frontmatter restriction
   (R1-2) or silently miss a spelled-out doc statement that then ships wrong (R1-4).
4. The whole count-maintenance scheme leans on digit-form greps ("12", "20", "six") while
   the docs use word forms ("twelve", "twenty") and carry collidable substrings ("sixteen")
   — a systemic weakness across tasks 7, 10, 11, 13, 14.

## Top 3 conclusions to challenge or reverse

1. **"The pinned greps find every dependent count/length assertion."** They do not.
   Four of five count greps either miss a real target (SDD-HARNESS.md "twelve"/"twenty"),
   collide with a forbidden edit (implementer frontmatter), or match only noise
   ("sixteen", "six fixture states"). The `agent-rules.md` "Documents" bar is not met.
2. **"Design C6's fix variants are all portable from the cited brief sections."** `reconcile`
   has no cited section and no distinguishing rule, so it is not portable as written.
3. **"Each harness task edits only the files in its File list."** Task 13's grep, taken
   literally, edits `harness/skills/sdd-continue/SKILL.md`, which is not in its File list
   and is task 14's surface.

## What's missing before acting on this document

- A source (or a "same as ci") ruling for the `reconcile` fix variant (R1-1).
- Scope-corrected count/length greps for tasks 11, 13 and 14, with explicit exceptions for
  frontmatter, the retro-analyst, the task-block line, and the supervisor launch line, and
  word-form terms so the SDD-HARNESS.md guard/budget statements are actually found
  (R1-2/3/4).
- A decision on the inert brief-kind count grep in tasks 7/10 (R1-5).

ESCALATE: none

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 4
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
