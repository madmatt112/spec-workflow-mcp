# Adversarial Review — controller-liveness-and-push/requirements (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/controller-liveness-and-push
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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/reviews/adversarial-analysis-requirements.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Changes: the diff from the `docs(sdd): controller-liveness-and-push requirements v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `controller-liveness-and-push` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: wire contracts across a boundary (router, query params, response shapes, client state), the default first lens for requirements.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/controller-liveness-and-push/reviews/adversarial-memory-requirements.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — requirements`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/controller-liveness-and-push`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since ebf67bc4

````diff
diff --git a/.spec-workflow/specs/controller-liveness-and-push/requirements.md b/.spec-workflow/specs/controller-liveness-and-push/requirements.md
index ae182e14..a6559e40 100644
--- a/.spec-workflow/specs/controller-liveness-and-push/requirements.md
+++ b/.spec-workflow/specs/controller-liveness-and-push/requirements.md
@@ -34,7 +34,7 @@ The steering directory holds no `product.md`, so this spec aligns with the ADRs
 
 1. The wire run row SHALL carry `driven: boolean`: true while the controller holds the run in its `active` set or has a drive or a re-attach poll for it (`src/controller/controller.ts:75-78`, `:320-332`, `:417-434`), else false. The row is built in `src/controller/runs.ts:1429-1444` and read by the shell feed at `src/dashboard/shell/shell-feed.ts:115-120`.
 2. A run SHALL be stalled when its status is `running` and `driven` is false. The row SHALL carry `driven`; the dashboard derives stalled from the two fields.
-3. WHEN a drive ends because `runOnce` threw (today only logged, `src/controller/controller.ts:428-429`) THEN the controller SHALL open an `error` wait whose question text is "step `stepKind` failed inside the controller: `message`" (the cursor's step kind and the error's message) with options `retry` and `abandon`, recommended `retry`, and SHALL set the run `waiting` with no `inFlight`. The wait SHALL carry a question id the controller recognises as a drive-crash wait (design names it).
+3. WHEN a drive ends because `runOnce` threw (today only logged, `src/controller/controller.ts:427-429`) THEN the controller SHALL open an `error` wait whose question text is "step `stepKind` failed inside the controller: `message`" (the cursor's step kind and the error's message) with options `retry` and `abandon`, recommended `retry`, and SHALL set the run `waiting` with no `inFlight`. The wait SHALL carry a question id the controller recognises as a drive-crash wait (design names it).
 4. WHEN the drive-crash wait or the run write in AC 3 itself fails THEN the controller SHALL log the failure and leave the run as it is; the row SHALL then read stalled (status `running`, `driven` false).
 5. WHEN a drive ends, by return or by throw, THEN the controller SHALL emit a run change, so the shell feed re-sends the row and the row shows `driven: false` within 5 seconds.
 6. WHEN the drive-crash wait is answered `retry` THEN the run SHALL be re-queued and re-driven from its cursor, and WHEN it is answered `abandon` THEN the run SHALL be cancelled. Both hold at base for every `error` wait through `onWaitChange` (`src/controller/controller.ts:438-466`): invariant (verified, not red-first) for the answer handling; only the wait's creation is new.
@@ -134,3 +134,4 @@ The steering directory holds no `product.md`, so this spec aligns with the ADRs
 ## Revision History
 
 - **v1** (2026-11-03) — Initial draft.
+  - **Lint pass.** 1 fixed; rejected: L-1..L-4 (`lastActivity` is the new field these ACs add; cites correctly locate the record and its writers at base, which lack it), L-6..L-11 (`stepKind`/`message`/`retry`/`abandon`/`waiting`/`inFlight` name the new drive-crash wait's content; cite anchors only "today only logged"), L-12 (`retry` is handled by `onWaitChange`'s non-`abandon` else branch at `:461-463`; cite anchors the invariant, literal token aside), L-13/L-14 (`pauseRequested` is the RunRecord field the loop-top stop reads via `isPauseRequested`; `paused` is the status the `pause()` call at `:856` sets), L-15..L-17 (`open` is a WaitState, `url`/`topic` are `notify.json` fields from AC 1; unrelated to the durable-project-list cite), L-18..L-20 (`nextUnstartedSpec`/`launchable`/`disabledReason` belong to run-setup.ts; cite anchors only the all-on-disk-complete reason), L-21 (`launchSpec` is the enclosing function at `:101`; cite anchors its create-before-enqueue body), L-22 (`ambiguous` is a RoutingState from AC 1; unrelated to the launchSpec cite).

````
