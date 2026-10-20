# Adversarial Review — project-bootstrap/design (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/design.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/project-bootstrap
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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/reviews/adversarial-analysis-design.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, doc-words on v1 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v1 lint commit changed: the whole `## Changes since` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the `docs(sdd): project-bootstrap design v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `project-bootstrap` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- A design sentence that names a specific library or framework API capability — a method, an option, or an exposed field — is a checkable claim, not prose. Confirm the document probed it against the installed version under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/project-bootstrap` and cited the probe, or stated only the behaviour it verified; an unproven library-capability assertion carried toward implementation is a MUST_FIX.
- Data Models completeness — any result or response object that a requirement references has its full field shape pinned in Data Models, not only its union arms. A named result object whose shape is given only through its union members, with no enumerated fields, is a MUST_FIX.
- Error-branch shape — every named error branch, a race loser included, pins both its error-type discriminant (for example a `LaunchError.step` value) and its response status code in the design, not only its message, before the phase closes. A named error branch that leaves its discriminant or its status code unstated is a MUST_FIX; left unpinned here, a race-loser shape is carried unresolved into tasks (retro P3).
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/reviews/adversarial-memory-design.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — design`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/project-bootstrap`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 41456ad

````diff
diff --git a/.spec-workflow/specs/project-bootstrap/design.md b/.spec-workflow/specs/project-bootstrap/design.md
index 05e1385..1b00e8c 100644
--- a/.spec-workflow/specs/project-bootstrap/design.md
+++ b/.spec-workflow/specs/project-bootstrap/design.md
@@ -17,7 +17,7 @@ N/A: no visual surface.
 
 ## Architecture
 
-`main` in `src/index.ts` gets one branch before its help check (`src/index.ts:378-384`). When `bootstrapCommand(args)` returns a name, `main` dynamically imports `src/bootstrap/cli.ts`, awaits `runBootstrapCommand(args)` and exits with the returned code (D1). The help check and `parseArguments` do not run for these commands, so `CLI_FLAGS` (`src/index.ts:143-156`) is unchanged. On the controller side, only the add route and `ProjectManager.addProjectByPath` change: both accept an explicit store root and remember the project when it is given.
+`main` in `src/index.ts` gets one branch before its help check (`src/index.ts:374-387`). When `bootstrapCommand(args)` returns a name, `main` dynamically imports `src/bootstrap/cli.ts`, awaits `runBootstrapCommand(args)` and exits with the returned code (D1). The help check and `parseArguments` do not run for these commands, so `CLI_FLAGS` (`src/index.ts:143-156`) is unchanged. On the controller side, only the add route and `ProjectManager.addProjectByPath` change: both accept an explicit store root and remember the project when it is given.
 
 ```mermaid
 graph LR
@@ -206,3 +206,4 @@ Tests run under the per-worker homes of `vitest.setup.ts` and set per-test `SDD_
 ## Revision History
 
 - **v1** (2026-10-20) — Initial draft.
+  - **Lint pass.** 2 fixed; rejected: L-2/L-3 bootstrapCommand/runBootstrapCommand new fns (absent from base by construction), L-5 addProjectByPath forward-ref cited in C7, L-6/L-9 top design-local var, L-7/L-8 registered/remote CheckName literals, L-10 serviceEnv new fn, L-11/L-12 readAgentRules/parseAgentRuleKey descriptive (cited C4), L-13 WorkspaceInitializer class name (citation anchors "fixed list" behaviour), L-14 projectId response field, L-15/L-29 workflowRootPath new field, L-16 resolveGitRoot "not" mention, L-17 syncWithRegistry decl at :134 (citation anchors behaviour :161-169), L-18 export keyword being added, L-19/L-20 mkdir/url descriptive, L-21/L-22/L-23/L-25/L-26 init/doctor new subcommands, L-24 bootstrapCommand test name, L-27 showHelp (cited C1), L-28 Starting banner string. L-1/L-4 fixed by widening the line-20 citation to src/index.ts:374-387 so main (:374) and parseArguments (:387) resolve.

````
