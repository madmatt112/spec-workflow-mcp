# Adversarial Review — run-pause/design (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/design.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/run-pause
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Analysis approach

Before writing your analysis, read the target document. Then identify **3–6 specific topics, decisions, or sections** to attack — name actual headings, claims, or structures from the document. For each, list **3–5 directive bullets** grounded in the document's concrete content. Frame bullets as directives ("Challenge the claim that…", "Stress-test the assumption that…"), not questions. Do not write generic advice.

**Primary attack surface for this phase:** Feasibility, consistency, edge cases

**Example attack angles to consider:** Conflicts with steering docs, unaddressed failure modes, scaling bottlenecks, missing error paths, alternatives not considered

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/reviews/adversarial-analysis-design.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, doc-words on v1 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v1 lint commit changed: the whole `## Changes since` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the `docs(sdd): run-pause design v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `run-pause` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- A design sentence that names a specific library or framework API capability — a method, an option, or an exposed field — is a checkable claim, not prose. Confirm the document probed it against the installed version under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/run-pause` and cited the probe, or stated only the behaviour it verified; an unproven library-capability assertion carried toward implementation is a MUST_FIX.
- Data Models completeness — any result or response object that a requirement references has its full field shape pinned in Data Models, not only its union arms. A named result object whose shape is given only through its union members, with no enumerated fields, is a MUST_FIX.
- Error-branch shape — every named error branch, a race loser included, pins both its error-type discriminant (for example a `LaunchError.step` value) and its response status code in the design, not only its message, before the phase closes. A named error branch that leaves its discriminant or its status code unstated is a MUST_FIX; left unpinned here, a race-loser shape is carried unresolved into tasks (retro P3).
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/run-pause/reviews/adversarial-memory-design.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — design`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/run-pause`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 9ffb679e

````diff
diff --git a/.spec-workflow/specs/run-pause/design.md b/.spec-workflow/specs/run-pause/design.md
index 49f17d16..bf871212 100644
--- a/.spec-workflow/specs/run-pause/design.md
+++ b/.spec-workflow/specs/run-pause/design.md
@@ -120,7 +120,7 @@ graph LR
 ### C9 — Runs page row and panel (`src/dashboard_frontend/src/modules/shell/RunsPage.tsx`)
 - **Purpose:** Pause and Resume buttons (Requirement 6 AC 1 to AC 4).
 - **Interfaces:**
-  - `PauseButton({ run })` — local to `RunsPage.tsx`, owning its `busy` and `error` state. On click it calls `e.stopPropagation()` (React 18.3.1 installed; `@types/react` declares it at `node_modules/@types/react/index.d.ts:2196`; the shell uses it at `src/dashboard_frontend/src/modules/shell/Sidebar.tsx:197`), then posts to the pause route. While busy it reads `Pausing…` and is disabled. A failure sets `pause failed (status)`, shown right of the button as a danger-tone span with `role="alert"` and the full message in `title`; it never selects the row or opens the panel. The new state arrives over the runs topic (`src/dashboard_frontend/src/modules/shell/RunsPage.tsx:260-271`).
+  - `PauseButton({ run })` — local to `RunsPage.tsx`, owning its `busy` and `error` state. On click it calls `e.stopPropagation()` (the shell already uses it at `src/dashboard_frontend/src/modules/shell/Sidebar.tsx:197`), then posts to the pause route. While busy it reads `Pausing…` and is disabled. A failure sets `pause failed (status)`, shown right of the button as a danger-tone span with `role="alert"` and the full message in `title`; it never selects the row or opens the panel. The new state arrives over the runs topic (`src/dashboard_frontend/src/modules/shell/RunsPage.tsx:260-271`).
   - Row (`src/dashboard_frontend/src/modules/shell/RunsPage.tsx:209-233`): renders `PauseButton` (test id `ctrl-row-pause-<id>`) when the status is live (`queued`, `running`, `paused`, `waiting` or `merging`) and `isOperatorHeld` is false. The row shows no Resume.
   - Panel (`src/dashboard_frontend/src/modules/shell/RunsPage.tsx:235-324`): renders `PauseButton` (test id `ctrl-pause`) under the same condition as the row. When `isOperatorHeld` is true, it shows a **Resume** button (test id `ctrl-resume-operator`) that posts to the resume route, and it hides **Resume now**. **Resume now** (`ctrl-resume`, `src/dashboard_frontend/src/modules/shell/RunsPage.tsx:296-306`) stays for a `paused` run that is not held. Cancel and Discard are unchanged.
 - **Reuses:** `Button`, the panel's `resume` handler shape, and the panel error line (`src/dashboard_frontend/src/modules/shell/RunsPage.tsx:321`) for Resume failures.
@@ -193,7 +193,7 @@ A test that seeds a held record through `writeRun` passes `{ ownsPauseRequest: t
 ## Scope notes
 
 - Carried items from requirements: none.
-- RE-DECIDED (D3): Requirement 2 AC 3 names each document-phase step as a boundary; this design parks the document phase only at a review-round top, so the reviewer, reviser, lint-fix, narrow-check and adjudicator steps of a round run on, and a pause can wait up to one round (an approval can land first). The other phases park at their existing `shouldStop` points, which are not before every spawn. A step-exact document resume is out of scope.
+- RE-DECIDED (D3): Requirement 2 AC 3 names each document-phase step as a boundary; this design parks the document phase only at a review-round top, so the reviewer, reviser, lint-fix, narrow-check and adjudicator steps of a round run on, and a pause can wait up to one round (an approval can land first). The other phases park at their existing `shouldStop` points. A step-exact document resume is out of scope.
 - Re-entry after a document-phase pause loses that phase's in-memory round state (standoff and circling history, the cap's extra round), as a usage-limit re-entry does today.
 - Decided here, as the decomposition asks: the self-update script (D8), the row error location (D9), and how waits opened under a pending pause display (D10, C8).
 - Out of scope, as the requirements set: the advisor second-opinion step, a pause timer, pausing every run with one click, and any change to cancel or discard.
@@ -201,3 +201,4 @@ A test that seeds a held record through `writeRun` passes `{ ownsPauseRequest: t
 ## Revision History
 
 - **v1** (2026-10-29) — Initial draft.
+  - **Lint pass.** 1 fixed (L-39: dropped unresolvable `node_modules/@types/react` citation, line 123); rejected L-1 to L-38, L-40 to L-62 as false positives.

````
