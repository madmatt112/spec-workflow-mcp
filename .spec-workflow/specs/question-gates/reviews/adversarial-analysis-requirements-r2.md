# Adversarial Analysis — question-gates/requirements (v2)

Round 2. Fresh lens: a cold read for internal contradictions plus a truth table of
the stated cases (gate A/B × block/record × AskUserQuestion return approve/change/
annotate). Deltas since `d0d0cce` (the v2 round-1 response, R1-1..R1-9 + lint pass)
attacked first, then the fresh lens applied across the whole document.

## Delta citations re-verified (v2 lint commit 59decb3 + v2 body changes)

All citations the v2 delta introduced are accurate:

- `harness/skills/sdd-continue/SKILL.md:60` — "You commit your own HANDOFF edits
  (step 4)." Backs Req 1 AC 5's commit-together clause. Accurate.
- `harness/skills/sdd-continue/references/formats.md:25-26` — "At most 150 words above
  it, never file contents." Backs Req 1 AC 6. Accurate.
- `harness/agents/sdd-document-orchestrator.md:49,51` — line 49 "Never paste file
  contents…", line 51 "…at most 150 words above it." Backs Req 1 AC 6. Accurate.
- `harness/skills/sdd-document-phase/SKILL.md:20` — "…never the whole document…
  Nothing else." Backs Req 2 AC 1 / D2. Accurate (and load-bearing below).
- `src/core/gate-rules.ts:26` — `NO_LIST_REASON = 'sensitive-paths: no list; every
  path is sensitive'`; `:260-261` — `if (input.sensitive === null) reasons.push(NO_LIST_REASON)`;
  `src/tools/review-gate.ts:177-179` — "ENOENT ⇒ every path is sensitive (null)." All
  three back Req 4 AC 5. Accurate; the "would flood the veto list" characterization is
  correct, and the requirement correctly reuses the pure parser while rejecting the
  caller's null convention (no internal conflict with Req 4 AC 2).
- `harness/skills/sdd-continue/SKILL.md:198-203` — the design-defect loop re-spawns
  tasks in `MODE: revision`. Backs Req 5 AC 6. Accurate.

Lint findings L-1..L-5 (citation-identifier warnings) are correctly rejected: `record`,
`headless`, `question`, `options` are this document's own terms/payload keys, not text
that must appear in the cited source ranges. Confirmed, not overturned.

## Attack topics and findings

### Topic A — The R1-1 fix (Req 5 AC 6) contradicts the unchanged Req 4 AC 1

- Challenge the claim that gate B's fire-once guard is internally consistent.
- Stress-test Req 4 AC 1's unconditional trigger against Req 5 AC 6's new prohibition.

**R2-1 (MUST_FIX). Compounds R1-1.** Req 4 AC 1 and Req 5 AC 6 issue opposite `SHALL`
commands to the same actor for the same trigger. Req 4 AC 1: "WHEN the `tasks` phase
reports `approved` THEN the tasks orchestrator SHALL return one ranked veto list." Req 5
AC 6: "WHEN the tasks orchestrator resumes the tasks phase in `MODE: revision`… and
reports `approved` again THEN it SHALL NOT return a new veto list." A revision-mode
re-approval satisfies both triggers, so the tasks orchestrator is told both to return a
veto list and not to. The R1-1 fix guarded the *supervisor* side (AC 6 also says "the
supervisor SHALL proceed directly to implementation without running gate B a second
time"), which does prevent the human gate from re-firing — but it left the
*orchestrator's* production trigger (Req 4 AC 1) unscoped, so the two acceptance
criteria literally contradict. An implementer following Req 4 AC 1 recomputes and
returns a veto list on every design-defect and annotation-driven re-approval. Fix:
scope Req 4 AC 1 to the first/`MODE: normal` approval, or cross-reference AC 6 as its
exception.

### Topic B — Gate A's ranked list has no channel from the drafter (R1-4 moved the producer, R1-2's fix did not follow)

- Challenge the assumption that the orchestrator can "carry that ranked list" (Req 2
  AC 2) when the R1-4 fix made the *drafter* produce it.
- Stress-test the drafter → orchestrator hop against the drafter's report cap and the
  orchestrator's read rule.
- Cross-check which actor writes the server surface Req 1 AC 6 names.

**R2-2 (SHOULD_FIX). Compounds R1-2, R1-4.** After R1-4, the drafter extracts and ranks
the gate-A decisions and builds the `{header, question, options}` triples (Req 2 AC 1).
After R1-2, the payload "crosses from an orchestrator to the supervisor… via a
spec-workflow MCP server surface" (Req 1 AC 6). Nothing connects the two: the drafter is
a worker, and there is no defined channel for its ranked list to reach the orchestrator
(who must then "carry" it in `gate-a`, Req 2 AC 2). The drafter's own report is "150
words or fewer… No file contents" (`harness/agents/sdd-drafter.md:26`) — the same cap
R1-2 rejected for the orchestrator hop. The orchestrator cannot read it from the
document either: its standing rule is "never the whole document… read the Revision
History lines (grep), the verdict block…, `grep -n '^#'` for structure, and worker
reports. Nothing else" (`harness/skills/sdd-document-phase/SKILL.md:20`) — a side file
the drafter writes is not on that list. So Req 1 AC 6's "crosses from an orchestrator"
is wrong for gate A: the orchestrator never holds the data. The requirement must name
who writes the server surface for gate A's ranked list (the drafter, presumably, not
the orchestrator) and how it reaches the supervisor, or the drafter → orchestrator hop
inherits the exact unsatisfiable contract R1-2 closed for the next hop. (Gate B is
fine here: its veto list genuinely originates at the tasks orchestrator, so Req 1 AC 6's
"from an orchestrator" fits it.)

Supporting note (MINOR, R2-5 below): even if the channel is fixed, the drafter builds
the triples at v1-draft time while Req 2 AC 2 fires the gate *after* the Lint step, with
no re-extraction in between.

### Topic C — Truth table: the mixed change+annotate case is undefined and double-routed

- Enumerate gate A block mode over five decisions, each reply ∈ {approve, change,
  annotate}, against AC 5/6/7.
- Find the combination the acceptance criteria leave contradictory.

**R2-3 (SHOULD_FIX). Compounds R1-6.** AC 7 classifies each reply *per decision*
(approve / change / annotate), but AC 5, AC 6 and AC 7 are written as *whole-gate*
outcomes, and they overlap. When one decision is changed and another is annotated in the
same gate-A pass, AC 5 fires ("re-spawn `MODE: revision`… `REVISION_INPUT` naming the
changed decisions") and AC 7 fires ("re-spawn `MODE: revision`… `REVISION_INPUT` naming
the annotation text… record the decisions and the annotation"). Both command exactly one
revision round with a *different* `REVISION_INPUT`, and only AC 7 records to
`questions.md`. The document never says the round covers both, nor how `REVISION_INPUT`
is composed, nor whether the changed decisions are recorded. Failure scenario: a human
changes D1's option and adds "also reconsider the persistence choice" free text on D2 —
the implementer cannot tell whether one round is spawned with a merged input, or two, or
whether D2's annotation is dropped as AC 5 takes precedence. Define the combined case
(one round, `REVISION_INPUT` = union, record both).

### Topic D — Smaller truth-table gaps

**R2-4 (MINOR). Compounds R1-6.** AC 7 says "a reply selecting a different option is
change (AC 5)" — so a reply that both selects a different option *and* adds free text is
classified as change, and AC 5's `REVISION_INPUT` names only "the changed decisions,"
not the free text. The free text a human attaches to a changed option is silently
dropped, the same class of loss R1-6 fixed for the keep-option case.

**R2-5 (MINOR). Compounds R1-9, R1-4.** Extraction/ranking is pinned to "WHEN the
drafter writes requirements v1" (Req 2 AC 1), which runs in Step 1 *before* the Lint step
(`harness/skills/sdd-document-phase/SKILL.md:93,95-97`). Req 2 AC 2 fires `gate-a` *after*
the Lint step "so the human sees the lint-corrected v1 text." If a lint fix touches a
ranked decision's wording or its "options were" clause, the `{header, question, options}`
triple the human is asked is stale relative to the document text shown. No actor
re-extracts after lint. Low likelihood (lint usually only corrects citations) but a real
ordering gap between two accepted fixes.

**R2-6 (MINOR). Novel.** Recording asymmetry: AC 6 (all unchanged) and AC 7 (annotate)
both "record the decisions… to `questions.md`," but AC 5 (change) records nothing. An
interactive gate-A pass that changes an answer leaves no `questions.md` trace of the
confirmed/changed decisions, unlike every other interactive and record-mode branch.

## Top 3 risks / gaps

1. Req 4 AC 1 and Req 5 AC 6 contradict for the revision-mode re-approval case; the
   fire-once fix scoped the supervisor but not the orchestrator's veto-list trigger (R2-1).
2. Gate A's ranked list, now produced by the drafter (R1-4), has no defined channel to
   the orchestrator/supervisor; Req 1 AC 6's "from an orchestrator" no longer matches the
   producer, and the drafter's 150-word report plus the orchestrator's read rule leave no
   in-requirements path (R2-2).
3. The mixed change+annotate gate-A outcome is double-routed with conflicting
   `REVISION_INPUT`, and the changed-decision recording branch is silent (R2-3, R2-6).

## Top 3 conclusions to challenge or reverse

1. **Req 5 AC 6 "resolves" the gate-B re-fire.** It resolves the human-gate re-fire, not
   the veto-list recomputation: Req 4 AC 1 still unconditionally orders the list, so the
   fix is half-applied (R2-1).
2. **D2/Req 2 AC 2: the orchestrator "carries" the ranked list.** After R1-4 the
   orchestrator neither produces nor can read the list; the producer is the drafter, and
   Req 1 AC 6 attributes the server-surface write to the wrong actor (R2-2).
3. **AC 7 "maps AskUserQuestion's reply to approve/change/annotate."** It maps them per
   decision, but the outcome ACs (5/6/7) are whole-gate; the per-decision-to-whole-gate
   join is the undefined case (R2-3).

## What's missing before acting on this document

- Scope Req 4 AC 1 so the veto list is computed once (first `MODE: normal` approval),
  reconciling it with Req 5 AC 6.
- Name the actor that writes gate A's ranked list to the server surface and the
  drafter → (orchestrator/server) → supervisor path; correct Req 1 AC 6's "from an
  orchestrator" for gate A.
- Define the mixed change+annotate gate-A outcome: one round, `REVISION_INPUT`
  composition, and which branches record to `questions.md`.
- Decide whether a changed option's free text and a changed-answer pass are recorded.

VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 2
MINOR: 3
DESIGN_READY: no
ESCALATE: none
