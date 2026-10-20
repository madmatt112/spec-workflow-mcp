# Adversarial Review — project-bootstrap/requirements (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/project-bootstrap
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/reviews/adversarial-memory-requirements.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/reviews/adversarial-analysis-requirements.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/reviews/adversarial-memory-requirements.md using this format:

```markdown
# Adversarial Review Memory — requirements
Last updated: <today's date> (after v2 review)

## Cumulative Findings Summary
### Accepted
- <finding>: <brief description, which version identified it>

### Partially Accepted
- <finding>: <brief description, user's stance>

### Rejected
- <finding>: <brief description, reason for rejection>

### Unresolved
- <finding>: <not yet responded to>

## Patterns & Themes
- <high-level observations about recurring issues>

## Guidance for Next Review
- Focus areas based on what's been found
- Areas that have been well-covered and don't need re-examination
```

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/reviews/adversarial-analysis-requirements-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v2 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v2 lint commit changed: the `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the newest commit whose subject holds `docs(sdd): project-bootstrap requirements v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R<A-1>-<n>`, naming the round-<A-1> finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-<A> MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch, so the orchestrator sees which MUST_FIX the last fix created; the label is guidance and does not change the round budget.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/reviews/adversarial-memory-requirements.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/project-bootstrap`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 23c669d

````diff
diff --git a/.spec-workflow/specs/project-bootstrap/requirements.md b/.spec-workflow/specs/project-bootstrap/requirements.md
index 6b74b2e..2182e47 100644
--- a/.spec-workflow/specs/project-bootstrap/requirements.md
+++ b/.spec-workflow/specs/project-bootstrap/requirements.md
@@ -47,9 +47,9 @@ The steering directory has no `product.md`; this spec aligns with the re-planned
 
 1. WHEN `init` runs THEN it SHALL write `.mcp.json` at the repository's git top level with a `mcpServers.spec-workflow` entry whose `type` is `stdio`, whose `command` is `node`, and whose `args` are exactly one element: the absolute path of this checkout's `dist/index.js`, resolved from the running binary's own location.
 2. WHEN `--store` is given THEN the entry's `env` SHALL be `{ "SPEC_WORKFLOW_SHARED_ROOT": "<store root>" }`; WHEN it is not given THEN the entry's `env` SHALL be `{}`.
-3. IF `.mcp.json` exists THEN `init` SHALL replace only the `mcpServers.spec-workflow` entry and SHALL keep every other key and every other server entry with its value unchanged.
+3. IF `.mcp.json` exists THEN `init` SHALL replace only the `mcpServers.spec-workflow` entry and SHALL keep every other key and every other server entry with its value unchanged. WHEN the file has no `mcpServers` key THEN `init` SHALL add one holding only the spec-workflow entry.
 4. IF the existing `mcpServers.spec-workflow` entry differs from the one `init` writes THEN `init` SHALL print the previous entry's `command` and `args` on the line that reports the file; it SHALL NOT print the previous `env` values.
-5. IF `.mcp.json` exists and is not valid JSON, or its `mcpServers` is not an object THEN `init` SHALL print one line naming the file and SHALL exit 1 without writing any file.
+5. IF `.mcp.json` exists and is not valid JSON, or has a `mcpServers` key that is present and is not an object THEN `init` SHALL print one line naming the file and SHALL exit 1 without writing any file. An absent `mcpServers` key is not an error (AC 3 creates it).
 6. The written file SHALL be valid JSON, indented with two spaces, ending in one newline.
 
 ### Requirement 4 — `agent-rules.md` from a shipped template
@@ -75,7 +75,7 @@ The steering directory has no `product.md`; this spec aligns with the re-planned
 #### Acceptance Criteria
 
 1. WHEN `init` has written its files THEN it SHALL register the project through the controller's HTTP API, authenticated with `Authorization: Bearer` and the shared secret read from the controller home (`secretPath`, `src/controller/access.ts:25-28`). `init` SHALL NOT write `projects.json` or the MCP process registry itself.
-2. `init` SHALL find the controller at the URL of the live dashboard session file (`src/core/dashboard-session.ts:122-141`), else at `http://127.0.0.1:` followed by `SDD_PORT`, else port 5000 (the service's default, `scripts/sdd-service.sh:33`).
+2. `init` SHALL find the controller at the URL of the live dashboard session file (`src/core/dashboard-session.ts:122-141`), else at `http://127.0.0.1:` followed by `SDD_PORT`, else port 5000 (the service's default, `scripts/sdd-service.sh:33`). IF the resolved URL's host is not a loopback address (the dashboard was bound with a non-localhost `--host`, `src/index.ts:39-42`) THEN `init` SHALL NOT send the secret to it and SHALL use `http://127.0.0.1:` followed by that URL's port, so the secret stays on loopback (Security NFR).
 3. WHEN registration succeeds THEN `projects.json` in the controller home SHALL hold one entry whose `workspacePath` is the repository's git top level and whose `workflowRootPath` is the store root of Requirement 2, with or without `--store`.
 4. WHEN registration succeeds with `--store` THEN the entry of AC 3 SHALL still be in `projects.json` after the controller restarts. At base a project whose workspace and store root differ is not remembered (`src/dashboard/project-manager.ts:240-249`), and `addProjectByPath` derives the store root in the controller's own environment (`src/dashboard/project-manager.ts:318-343`); the design SHALL close both gaps.
 5. IF the project is already registered with the same two paths THEN `init` SHALL leave one entry, not two, and SHALL report the existing project id.
@@ -90,7 +90,7 @@ The steering directory has no `product.md`; this spec aligns with the re-planned
 
 1. `init` SHALL print one line per file it touched, of the form `wrote`, `updated` or `kept`, followed by the absolute path, and one line `registered` followed by the project id.
 2. `init` SHALL validate every input (Requirement 1 AC 7 and 9, Requirement 2 AC 3, Requirement 3 AC 5) before it writes any file.
-3. WHEN `init` is run a second time with the same arguments on a repository it has already set up THEN it SHALL change no file byte, SHALL print `kept` for every file, and SHALL exit 0.
+3. WHEN `init` is run a second time with the same arguments on a repository it has already set up THEN it SHALL change no file byte and SHALL print `kept` for every file; WHEN the controller is also reachable and registration succeeds THEN it SHALL exit 0; a registration failure on that re-run still exits 2 (Requirement 5 AC 7).
 4. `init` SHALL exit 0 when every file is written and the project is registered, 1 on an input error, and 2 on a registration failure.
 5. WHEN `init` has finished THEN its last line SHALL say that the written files are not committed and SHALL name `doctor` as the next command.
 
@@ -161,5 +161,11 @@ The steering directory has no `product.md`; this spec aligns with the re-planned
 
 ## Revision History
 
+- **v2** (2026-10-20) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 0/3/1).
+  - **R1-1 — Accepted (SHOULD_FIX).** Req 3 AC 5 now errors only when a `mcpServers` key is present and not an object, and states an absent key is not an error; Req 3 AC 3 now adds a `mcpServers` key holding only the spec-workflow entry when the existing file has none.
+  - **R1-2 — Accepted (SHOULD_FIX).** Req 5 AC 2 now requires that when the resolved controller URL's host is not loopback, `init` falls back to the loopback host on that port before sending the secret, keeping the Security NFR true.
+  - **R1-3 — Accepted (SHOULD_FIX).** Req 6 AC 3 now qualifies exit 0 to a reachable controller and successful registration, and points a registration failure on the re-run to the exit-2 rule, removing the contradiction with Req 5 AC 7.
+  - **R1-M1 — Rejected (MINOR).** The detection flags extending the decomposition command line are already justified by D8 and the Scope notes; the reviewer marked them acceptable, so no change.
+  - **Lint pass.** 0 fixed; rejected: L-1..L-9, L-13 (`init`/`doctor` are this spec's own new subcommands, absent from base code by definition; each cited range correctly anchors the adjacent existing-code claim and verifies against the tree); L-10..L-12 (`controller`/`token` are doctor check names in the prose, not code identifiers; the citations anchor the existing route/helper — `GET /api/health`, `service.env`, `CONTROLLER_GH_BIN` — all verified). Tokens unchanged since v1's rejection, suppressed per lint rule 11.
 - **v1** (2026-10-20) — Initial draft.
   - **Lint pass.** 0 fixed; rejected: L-1..L-9, L-13 (`init`/`doctor` are the spec's own new subcommands, absent from base code by definition; each cited range correctly supports the adjacent existing-code claim and verifies against the tree); L-10..L-12 (`controller`/`token` are doctor check names in the prose, not code identifiers; the citations anchor the existing route/helper they reference — `GET /api/health`, `service.env`, `ghBin`/`CONTROLLER_GH_BIN` — all verified).

````
