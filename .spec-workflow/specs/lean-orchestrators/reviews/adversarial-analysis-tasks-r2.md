# Adversarial Analysis — lean-orchestrators/tasks (v2, round 2)

Attack surface: atomicity, ordering, coverage. Fresh lens: every cited artifact the v2
delta added or changed re-read at both ends of its range, confirming the symbol and the
line range still resolve in the current tree.

## What I checked and how

- Read the memory file, the round-1 analysis, `codebase-context.md`, `tasks.md` v2,
  `requirements.md`, `design.md` and `agent-rules.md`.
- **Fix-induced re-checks (R1-1..R1-5).** Ran each re-pointed grep against the real tree:
  - Task 7/10 `grep -rn "six templates\|six kinds\|six brief" src/tools docs/TOOLS-REFERENCE.md`
    → **no match** (claim holds; also confirmed the `brief` bullet at
    `docs/TOOLS-REFERENCE.md:578-583` carries no brief-kind count word or name list).
  - Task 11 `grep -rn "150 words\|120 words\|100 words" harness/agents` → **14 hits**, every
    one dispositioned: the eight C9 workers (drafter:30, reviewer:26, reviser:35,
    adjudicator:29, checker:25, implementer:38, test-author:32, verifier:34), the four
    orchestrator caps (document:55, implementation:58, closeout:47, retro:42),
    retro-analyst:26, and the implementer frontmatter at `sdd-implementer.md:3`. Confirmed
    `sdd-implementer.md:3` is the only agent frontmatter carrying a report word count.
  - Task 13 `grep -rn "20 tasks\|default 20\|20-task\|twenty tasks" harness/skills/sdd-implementation-phase docs/SDD-HARNESS.md`
    → exactly `docs/SDD-HARNESS.md:131` ("twenty tasks"), `.../SKILL.md:16` ("default 20"),
    `.../SKILL.md:17` ("20-task"); does **not** reach `sdd-continue/SKILL.md:291`.
  - Task 14 `grep -rn "12 orchestrator spawns\|twelve spawns\|Runaway guard" harness docs`
    → exactly `sdd-continue/SKILL.md:379` and `docs/SDD-HARNESS.md:133`.
  - **All five greps are now correct.** The round-1 count/length-grep theme is resolved.
- **Behavioral verification of the R1-1 fix.** Confirmed today's "Reconcile a red PR" step
  (`harness/skills/sdd-implementation-phase/SKILL.md:457-491`) step 2 calls `template:
  reviser` with the CI-fix content, and step 3 calls `template: verifier` with the CI-verify
  content — so task 9's claim that `ci` and `reconcile` both render the CI-fix content
  (`references/briefs.md:232-253`) and `verifier`/`ci` renders CI-verify (`:255-267`) is
  accurate, and task 13 names the Reconcile step as the consumer. The orphan is resolved.
- **Fresh-lens citation re-reads (v2 delta).** Every range verified at both ends:
  impl `briefs.md` sections :103-132 (fix/repair), :232-253 (CI fix), :255-267 (CI verify),
  :158-191 (verifier), :209-230 (e2e), :193-207 (task adjudication);
  `sdd-continue/SKILL.md:291` (launch line), `:379-380` (guard);
  `sdd-implementer.md:3` (frontmatter "150 words"); `docs/SDD-HARNESS.md:130-134` and `:133`;
  impl `SKILL.md:14-20` (budget default :16, rationale :17-20) and `:22` (briefs read);
  `BRIEF_TEMPLATES` six kinds at `src/tools/harness.ts:493-557`; placeholder scan at `:717`.
  No misstated artifact; no MUST_FIX from the delta.
- Checked Test-line seams, success-clause coverage, requirement→task coverage, ordering
  edges, gate-B and gate-C. Test seams and success clauses are clean; no task adds an
  external dependency; no task exceeds the approved requirements (task 11's frontmatter
  correction is within Req 5.1).

## Findings

### R2-1 — SHOULD_FIX — Task 13 directs only the Reconcile brief re-point; the kept per-task-loop and Repair brief calls are left unaddressed
**Compounds: R1-1 (brief-kind consumption seam). Carried.**

The R1-1 fix made task 13 name the Reconcile step as the consumer of `fix`/`reconcile` and
`verifier`/`ci`, and task 13 also names the e2e verifier. But those are two of a dozen brief
calls in the implementation skill. The **kept** Per-task loop (which stays in the core
`SKILL.md`, so only task 13 can edit it) still carries:

- `SKILL.md:146-153` **Implement** — `template: implementer` passing `values.redTests` =
  "the `## Red tests (from the test author)` section from `references/briefs.md`". Task 9
  changes the `implementer` kind so `redTests` **stops being a caller value** and the kind
  requires `authorFiles`/`authorReport` instead — yet task 9's Restriction says "do not
  edit the skills here," and task 13's prompt never directs the Implement step to switch
  from `values.redTests` (read from `briefs.md`) to `authorFiles`/`authorReport`. The design
  states the passthrough in C9, but no task's prompt tells the skill editor to apply it.
- `SKILL.md:221-248` — the full-task verify (`template: verifier`, content "from
  `references/briefs.md`" at :225), the Fix rounds (`template: reviser` with the red-tests
  section from `references/briefs.md` at :238), the task adjudication (`template:
  adjudicator`), and the narrow verify (`template: verifier`).
- `SKILL.md:493-504` **Repair** — `template: reviser` with the CI-fix path for `ci:` inputs
  (consumes `fix`/`ci` and `fix`/`repair`).

Tasks 8 and 9 **replace** the old generic `reviser`/`implementer`/`verifier`/`adjudicator`
templates with the new kinds and new value sets, and task 13's summary says to **delete
`references/briefs.md`**. So every call above must re-point to task 9's kinds or it
references a deleted file and a changed template. Task 12 (document split) carries the
blanket that makes this explicit — "Every brief and prompt block comes from the kinds" —
but task 13 has no equivalent; it enumerates only Reconcile + e2e. The skill-split test
checks headings only, and the three harness checks validate plugin sync and YAML, not
brief-call correctness, so an incomplete re-point ships a broken skill caught only at the
deferred live verification (tasks 15/16).

**Failure scenario:** the implementer treats "re-point" as Reconcile-only (the only step
named), relies on "heading texts unchanged" for the rest, deletes `briefs.md`, and leaves
`SKILL.md:151-153` passing `redTests` from the now-deleted `briefs.md` into a kind that no
longer accepts it. Task 13 goes green; the Implement step is broken.

**Fix:** give task 13 the task-12-style blanket — every implementation brief and prompt
block comes from task 9's server kinds — and call out the Implement step's
`redTests → authorFiles/authorReport` change (and the removal of the `references/briefs.md`
content references at :135, :151-153, :225, :238) and the Repair step's `fix`/`ci` and
`fix`/`repair` re-point.

### R2-2 — MINOR — Task 11 lists `docs/SDD-HARNESS.md` but the v2 fix left it with no edit
**Compounds: R1-2. Fix-induced.**

The R1-2 fix scoped task 11's report-cap grep to `harness/agents` and excluded
`docs/SDD-HARNESS.md:78` (the task-block size, correctly not a report cap). That removed the
only edit task 11 made to `docs/SDD-HARNESS.md`, but the file stays in task 11's File list,
the prompt's only instruction for it is the vague "Note the block in docs/SDD-HARNESS.md
where it describes worker reports," and the Success clause ("each agent file states its C9
keys; the three harness checks pass") names no docs edit. There is no worker-report
cap/shape block in `docs/SDD-HARNESS.md` — the only "report" hits are the document caps
(:77-79) and a formats **pointer** (:155). So the entry is dangling and the "Note the
block" phrase points at nothing, inviting an undirected edit to the Report-contract
section. **Fix:** drop `docs/SDD-HARNESS.md` from task 11's File list, or specify the exact
edit (and update Success) if the new report-block shape should be documented there.

### R2-3 — MINOR — Task 12 over-cites task 9 as a source for the document-phase split
**Novel. Carried.**

Task 12's blanket reads "Every brief and prompt block comes from the kinds tasks 8 **and 9**
add." The document orchestrator writes only document-phase briefs (drafter, gate-a,
reviewer, reviser, adjudicator-docPath, checker) — all added by **task 8**. Task 9 adds only
implementation-phase kinds, which the document phase never writes. Naming task 9 here is an
imprecise cross-task dependency (harmless to ordering, since 9 < 12, but misleading). The
blanket it contains is exactly what task 13 is missing (R2-1). **Fix:** cite only task 8 in
task 12, and move the blanket into task 13 against task 9.

## Top risks/gaps

1. **R2-1** — the implementation skill's kept per-task-loop and Repair brief calls (Implement
   `redTests`, full/narrow verify, Fix rounds, adjudication, Repair) are not directed to
   task 9's new kinds; only Reconcile + e2e are named. A partial re-point ships a broken
   skill that no task-13 check catches.
2. The `redTests → authorFiles/authorReport` change straddles task 9 (server kind, "do not
   edit the skills") and task 13 (skill split, silent on it) — it is owned by neither prompt.
3. **R2-2 / R2-3** — a dangling File-list entry (task 11, `docs/SDD-HARNESS.md`) and an
   over-cited dependency (task 12 → task 9); both are precision defects, not blockers.

## Top 3 conclusions to challenge or reverse

1. **"Task 13 leaves no server-side brief kind unconsumed."** It demonstrates this only for
   `reconcile`/`ci`/`e2e`/standing. The primary consumers — `implementer`, `fix`/`gate`,
   `fix`/`verifier`, `verifier`/`task`, `verifier`/`narrow`, `adjudicator`/taskId,
   `fix`/`ci`, `fix`/`repair` — live in the kept per-task loop and Repair, which task 13
   edits but never names.
2. **"A heading-only skill-split test plus the three harness checks prove task 13 is done."**
   None of them exercise a brief call, so a skill that still passes `redTests` into the
   changed `implementer` kind, or references the deleted `briefs.md`, passes every task-13
   gate.
3. **"The count/length greps are the weak spot" (round-1 theme).** Reversed: all five
   re-pointed greps now return exactly their intended hits. The weak spot has moved from the
   greps to the under-specified per-task-loop re-pointing in task 13.

## What's missing before acting on this document

- A blanket instruction in task 13 that every implementation brief/prompt block comes from
  task 9's kinds, plus explicit direction for the Implement step
  (`redTests → authorFiles/authorReport`) and the Repair step (R2-1).
- A decision on task 11's dangling `docs/SDD-HARNESS.md` entry (R2-2).
- Correcting task 12's source citation to task 8 only (R2-3).

ESCALATE: none

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 2
DESIGN_READY: no
ESCALATE: none
```
