# Adversarial Review — run-pause/requirements (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/run-pause
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Analysis approach

Before writing your analysis, read the target document. Then identify **3–6 specific topics, decisions, or sections** to attack — name actual headings, claims, or structures from the document. For each, list **3–5 directive bullets** grounded in the document's concrete content. Frame bullets as directives ("Challenge the claim that…", "Stress-test the assumption that…"), not questions. Do not write generic advice.

**Primary attack surface for this phase:** Completeness, ambiguity, scope

**Example attack angles to consider:** Missing user stories, unstated assumptions, scope creep risk, contradictions between stories, acceptance criteria that can't be tested

## Closing deliverables
- Top N risks/gaps (3 for short docs, 5 for long)
- Top 3 conclusions to challenge or reverse, with reasoning
- What's missing — work that should be done before acting on this document

Be specific and concrete. Cite failure scenarios, not abstract risks. If something
is actually fine, say so briefly and move on.

## Standing directives

- Ground every claim in the real codebase. Read the files the document cites before you judge them. A misstated artifact (wrong path, wrong line range, wrong signature, wrong behaviour) is an automatic MUST_FIX.
- Attack the deltas since the previous version first, then apply one fresh lens the prior rounds did not use.
- Rulings recorded in the document's Revision History are closed. Do not re-open them.
- Do not pad. MINOR-only findings do not keep the loop alive. A clean round is a valid result: show your work (what you checked and how) and say converged.
- Severity: MUST_FIX = contradiction, false claim about the codebase, unimplementable requirement, data or security hole. SHOULD_FIX = a real gap that causes rework or a wrong implementation. MINOR = wording, a value safely left to a later phase, nice-to-have.
- ESCALATE only when a human should look now: security, secrets, auth bypass, data loss, destructive migrations, money, billing, pricing, legal or compliance. Otherwise write `ESCALATE: none`.

## Verdict block

End the analysis file with exactly this block, values filled in:

```
VERDICT: converged | iterate
MUST_FIX: <n>
SHOULD_FIX: <n>
MINOR: <n>
DESIGN_READY: yes | no
ESCALATE: none | <one-line reason a human should look now>
```

`converged` requires MUST_FIX = 0 and SHOULD_FIX = 0.

## Output
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/reviews/adversarial-analysis-requirements.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Changes: the diff from the `docs(sdd): run-pause requirements v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `run-pause` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: wire contracts across a boundary (router, query params, response shapes, client state), the default first lens for requirements.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/reviews/adversarial-memory-requirements.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — requirements`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/run-pause`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since a6febdb6

````diff
diff --git a/.spec-workflow/specs/run-pause/requirements.md b/.spec-workflow/specs/run-pause/requirements.md
index 94a07603..16f83f0d 100644
--- a/.spec-workflow/specs/run-pause/requirements.md
+++ b/.spec-workflow/specs/run-pause/requirements.md
@@ -30,7 +30,7 @@ The steering directory holds no `product.md`, so this document aligns with `docs
 3. IF no run has the id THEN the server SHALL answer `404 { error: 'run-not-found' }`, the same body as the cancel route (`src/dashboard/multi-server.ts:808-813`).
 4. IF the run's status is `done`, `abandoned` or `error` THEN the server SHALL answer `409 { error: 'not-pausable' }` and leave the record unchanged.
 5. IF the run already carries an operator pause, applied or pending, THEN the server SHALL answer `200 { ok: true }` and leave the record unchanged (the call is idempotent).
-6. WHEN a non-GET request to the pause route has no valid secret THEN the server SHALL answer `401`. Invariant (verified, not red-first): `makeRequireAccess` already rejects every non-GET under `/api/controller/` without the secret (`src/controller/access.ts:198-208`).
+6. WHEN a non-GET request to the pause route has no valid secret THEN the server SHALL answer `401`. Invariant (verified, not red-first): `makeRequireAccess` already rejects every non-GET under `/api/controller/` without the secret (`src/controller/access.ts:186-208`).
 7. WHEN the pause is recorded THEN the run's wire row SHALL change at once over the runs topic, through the same `runEvents` change event the other run writes emit.
 
 ### Requirement 2 — A running run pauses at the next step boundary
@@ -41,7 +41,7 @@ The steering directory holds no `product.md`, so this document aligns with `docs
 
 1. WHEN the operator pauses a `running` run with a step in flight THEN the controller SHALL let that step run to its normal end, SHALL act on its result as it does today (ledger rows, checkpoint commit, the lint step, an approval or a wait), and SHALL not signal or kill the step.
 2. WHEN that run reaches its next step boundary with the pause still pending THEN the controller SHALL write `status: 'paused'`, `pauseReason: 'operator'`, no `resumeAt`, and no `inFlight`, and SHALL spawn no further step.
-3. The step boundary in AC 2 SHALL hold in every phase that spawns steps: the document phase (between the drafter, lint-fix reviser, reviewer, reviser and narrow-check steps, and before the fresh retry in `handleDocumentOutcome`), the implementation phase, the merge-fix round, the retrospective and the close-out. Today the document phase has no stop check at all (`src/controller/phases/document.ts:159-198`), and the other phases check only cancel and the usage window (`src/controller/runs.ts:933`, `src/controller/runs.ts:964`, `src/controller/runs.ts:982`).
+3. The step boundary in AC 2 SHALL hold in every phase that spawns steps: the document phase (between the drafter, lint-fix reviser, reviewer, reviser and narrow-check steps, and before the fresh retry in `handleDocumentOutcome`, `src/controller/runs.ts:1209-1262`), the implementation phase, the merge-fix round, the retrospective and the close-out. Today the document phase has no stop check at all (`src/controller/phases/document.ts:159-198`), and the other phases check only cancel and the usage window (`src/controller/runs.ts:933`, `src/controller/runs.ts:964`, `src/controller/runs.ts:982`).
 4. WHEN the step that finishes under a pending pause opens a wait (for example gate A after the drafter, `src/controller/phases/document.ts:790-796`) THEN the run SHALL become `waiting` as today and the pause SHALL stay pending under Requirement 3 AC 4.
 5. WHEN the step that finishes under a pending pause ends the run (`done`) or the operator cancels the run THEN the pending pause SHALL be dropped and the run SHALL end as it does today.
 6. WHEN the step that finishes under a pending pause fails with a usage limit THEN the run SHALL take the operator pause, not a usage pause, so that only Resume ends it.
@@ -150,3 +150,4 @@ The steering directory holds no `product.md`, so this document aligns with `docs
 ## Revision History
 
 - **v1** (2026-10-29) — Initial draft.
+  - **Lint pass.** 2 fixed; rejected: L-3/L-4 `paused`/`operator` are the new status/reason this AC sets, the citation anchors the current `queued` branch (`src/controller/controller.ts:390`) it replaces; L-5/L-6/L-7 `operator` is the new reason, the citations anchor the existing window/startable/recover behaviour the invariants describe; L-8/L-9 the citation anchors the Now-page `pauseNote` render site, not `operator`/`pausedAt` (a record field); L-10 the text states the advisor step is not tracked in `inFlight`, so its absence from the cited call is the point.

````
