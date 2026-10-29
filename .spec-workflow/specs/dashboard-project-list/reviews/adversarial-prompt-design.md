# Adversarial Review — dashboard-project-list/design (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-project-list/design.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-project-list
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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-project-list/reviews/adversarial-analysis-design.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-project-list/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, doc-words on v1 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v1 lint commit changed: the whole `## Changes since` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the `docs(sdd): dashboard-project-list design v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `dashboard-project-list` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- A design sentence that names a specific library or framework API capability — a method, an option, or an exposed field — is a checkable claim, not prose. Confirm the document probed it against the installed version under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-project-list` and cited the probe, or stated only the behaviour it verified; an unproven library-capability assertion carried toward implementation is a MUST_FIX.
- Data Models completeness — any result or response object that a requirement references has its full field shape pinned in Data Models, not only its union arms. A named result object whose shape is given only through its union members, with no enumerated fields, is a MUST_FIX.
- Error-branch shape — every named error branch, a race loser included, pins both its error-type discriminant (for example a `LaunchError.step` value) and its response status code in the design, not only its message, before the phase closes. A named error branch that leaves its discriminant or its status code unstated is a MUST_FIX; left unpinned here, a race-loser shape is carried unresolved into tasks (retro P3).
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-project-list/reviews/adversarial-memory-design.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — design`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-project-list`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 63b12fdb

````diff
diff --git a/.spec-workflow/specs/dashboard-project-list/design.md b/.spec-workflow/specs/dashboard-project-list/design.md
index ee1c9a8e..bebaae72 100644
--- a/.spec-workflow/specs/dashboard-project-list/design.md
+++ b/.spec-workflow/specs/dashboard-project-list/design.md
@@ -39,7 +39,7 @@ graph LR
 ### C1 — Worktree classification (`src/core/git-utils.ts`)
 - **Purpose:** Classify one workspace as a linked worktree and return its main working tree, from one git call (R1 Terms, NFR Performance).
 - **Interfaces:** `linkedWorktreeInfo(workspacePath: string): { linked: boolean; mainTree: string | null }`. Post-conditions: runs `git rev-parse --git-common-dir` exactly once through `gitCapture` (`src/core/git-utils.ts:64-71`, scrubbed env, 5000 ms timeout at `src/core/git-utils.ts:7-11`); `linked` is true only when the raw output is non-null and not `.git` (the test `isGitWorktree` applies at `src/core/git-utils.ts:260-270`); `mainTree` is the parent of the realpath-normalized common directory (as `gitCommonDirAbsolute` computes it at `src/core/git-utils.ts:133-139`) when that directory's base name is `.git`, else null; a failed call returns `{ linked: false, mainTree: null }`. It never reads `SPEC_WORKFLOW_SHARED_ROOT`, unlike `resolveGitRoot` (`src/core/git-utils.ts:214-252`). Never throws.
-- **Dependencies:** `gitCapture`, `normalizeIdentityPath` (`src/core/git-utils.ts:101-112`).
+- **Dependencies:** `gitCapture` (`src/core/git-utils.ts:64-71`), `normalizeIdentityPath` (`src/core/git-utils.ts:101-112`).
 - **Reuses:** the existing common-dir handling; no new git command.
 
 ### C2 — Fold computation (new `src/dashboard/project-folding.ts`)
@@ -78,7 +78,7 @@ graph LR
   - `rememberProject` and `forgetProject` run their read-modify-write inside it. Signatures unchanged.
   - New `pruneMissingProjects(isMissing: (path: string) => Promise<boolean>): Promise<KnownProject[]>` runs inside the same lock, drops every entry whose `workspacePath` or `workflowRootPath` is missing, writes once when anything was dropped, logs one line per drop `[projects] Removed <id> from <projects.json path>: <missing path> does not exist`, and returns the dropped entries. On lock failure it logs and returns `[]` with no write.
 - **Dependencies:** the registry lock primitive.
-- **Reuses:** `readProjects`, `writeProjects`, `writeJsonAtomic` (`src/controller/state.ts:318-323`).
+- **Reuses:** `readProjects`, `writeProjects` (`src/controller/state.ts:451-457`), `writeJsonAtomic` (`src/controller/state.ts:318-323`).
 
 ### C6 — Missing-path check (new `src/dashboard/path-missing.ts`)
 - **Purpose:** One "does not exist" rule for C4 and C5 (R4 AC3, AC4).
@@ -188,9 +188,9 @@ The array is in sidebar order. It adds no path to the wire (NFR Security).
   - `src/dashboard/shell/__tests__/store-groups.test.ts` and `sidebar-rows.test.ts` (new): representative rule; each dot rule; live count with and without a controller run; last activity across statuses; sort order, ties and stability. `sidebar-rows.test.ts` also reads `NowPage.tsx` as text and asserts its `CTRL_LIVE_STATUSES` literal equals `NOW_LIVE_STATUSES`.
   - `src/dashboard/shell/__tests__/shell-feed.test.ts`: two projects on one store give one set of spec rows; `shell-now` carries `sidebar`. Message order is unchanged; an assertion that deep-equals a `shell-now` payload gains the `sidebar` key.
 - **Integration:** `src/evals/__tests__/runner-registry.test.ts` (new) runs `runCases` with a stub step that starts the configured server for real: it takes the `args` from the step's MCP config, swaps `dist/index.js` for `src/index.ts` and runs it with `tsx` (a dev dependency, used by `npm run dev`), waits for the registration log line, closes stdin, and asserts the per-worker registry and `projects.json` are byte-equal to before (R3 AC1, AC2, R7 AC2). At base the args lack the flag, the server registers the fixture, and the test fails.
-- **End-to-end:** `e2e/worktree-project-list.spec.ts` (new, worktree Playwright config, `playwright.worktree.config.ts:46-70`). It adds a main repo, starts one worktree MCP server on the same store, and seeds a controller run record (status `running`, project the main id) as `e2e/worktree-shell.spec.ts:174` does: one sidebar row, `data-state="running"`, count 1, and Specs and Deferrals counts equal to those read before the worktree server started (R7 AC1). A second project with a seeded open wait and an older run sorts above an idle project with a newer done run, with `data-state="waiting"` (R7 AC4). It also toggles the main project off and checks the dot and position stay (R5 AC11). R7 AC3 (deleted workspace, restart) is the `project-manager-durable` start-time case above, since the Playwright dashboard cannot restart mid-suite. `npm run build`, `npx tsc --noEmit` and `npm test` close the gate (R7 AC5).
+- **End-to-end:** `e2e/worktree-project-list.spec.ts` (new, worktree Playwright config, `./playwright.worktree.config.ts:46-70`). It adds a main repo, starts one worktree MCP server on the same store, and seeds a controller run record (status `running`, project the main id) as `e2e/worktree-shell.spec.ts:174` does: one sidebar row, `data-state="running"`, count 1, and Specs and Deferrals counts equal to those read before the worktree server started (R7 AC1). A second project with a seeded open wait and an older run sorts above an idle project with a newer done run, with `data-state="waiting"` (R7 AC4). It also toggles the main project off and checks the dot and position stay (R5 AC11). R7 AC3 (deleted workspace, restart) is the `project-manager-durable` start-time case above, since the Playwright dashboard cannot restart mid-suite. `npm run build`, `npx tsc --noEmit` and `npm test` close the gate (R7 AC5).
 - **Regression guards (hold at base, verified, not red-first):** R1 AC3 (`e2e/worktree-shared.spec.ts:370-414` stays green), R1 AC7 (`e2e/worktree-shared.spec.ts:748-795`), R1 AC8, R1 AC9, R1 AC10, R4 AC5 (`readRegistry` is not edited), R5 AC8 (the existing frontend style scan, `src/dashboard/__tests__/frontend-style-scan.test.ts`), R5 AC10.
-- **Why no frontend vitest test:** a 2026-10-29 probe showed vitest 4.0.16 imports a frontend module from a root test, but `tsc` 5.9.3 under the root `node16` resolution (`tsconfig.json:4-5`) rejects its extensionless imports (TS2835 on `src/dashboard_frontend/src/modules/shell/pause.ts:1`). So C9 lives on the server and C10 to C12 are proved by Playwright.
+- **Why no frontend vitest test:** a 2026-10-29 probe showed vitest 4.0.16 imports a frontend module from a root test, but `tsc` 5.9.3 under the root `node16` resolution (`./tsconfig.json:4-5`) rejects its extensionless imports (TS2835 on `src/dashboard_frontend/src/modules/shell/pause.ts:1`). So C9 lives on the server and C10 to C12 are proved by Playwright.
 
 ## Decisions taken in this document
 
@@ -220,3 +220,4 @@ The array is in sidebar order. It adds no path to the wire (NFR Security).
 ## Revision History
 
 - **v1** (2026-10-29) — Initial draft.
+  - **Lint pass.** 5 fixed: L-3,15,16 gave each listed existing function its own range; L-38,41 prefixed the root config files with `./`. Rejected: L-1,2,4,5,10,11,13,14,20,25,26,27,30,31,35,36 (identifier this design defines, not a cited-code claim); L-6,7,8,9,19,21,22,23,24,28,29,32,33,34 (citation anchors the behaviour it names, not the reused subject's declaration); L-12,17,18,37,39,40 (keyword/literal/tool name, not a citable symbol).

````
