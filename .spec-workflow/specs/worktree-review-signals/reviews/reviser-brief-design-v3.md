# Reviser brief — worktree-review-signals design v3 (SHOULD_FIX-only corrective pass)

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
This is a SHOULD_FIX-only corrective pass. Produce v3 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/design.md` in place, fixing only the two SHOULD_FIX findings (R2-1 and R2-2) from round 2. Then report in 150 words or fewer: files touched; R2-1 and R2-2 each as `accepted | partially accepted | rejected`; citations verified (count); the document's word count; flags. No file contents.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/design.md` (v2). Cap: 4,000 words (body is 3,998 — NO slack; every clause you add must be paid for by trimming prose elsewhere so the body stays at or under 4,000).
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/requirements.md`.
- Findings: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/reviews/adversarial-analysis-design-r2.md` (round 2). Read R2-1 and R2-2 in full (sections `### R2-1` and `### R2-2`).
- Memory: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/reviews/adversarial-memory-design.md` (read `## Guidance for Next Review`; do not write it).
- You may call the spec-workflow `adversarial-response` tool (`specName: worktree-review-signals`, `phase: design`) for the response methodology. Ignore its instructions to present to a user, wait, or delete approvals.

## Scope
- Fix ONLY R2-1 and R2-2. Do NOT address the MINOR findings R2-3 and R2-4 in this pass (they are safely deferred; a later phase or a maintainer handles them). Do not widen scope.
- R2-1 (SHOULD_FIX): a git spawn with no timeout on the interactive status route can hang and never return, with no degraded path. Give the design a bounded git spawn (a timeout) and a stated degraded outcome when it fires, on both the status route and prepare, consistent with the existing `observed`/degraded model. Cite the real spawn site and the timeout mechanism you rely on.
- R2-2 (SHOULD_FIX): the atomic-write failure lifecycle leaks untracked temp/`.stale` debris into the git-tracked spec store, and Error Handling omits the store-write-throws path. Specify where the temp/stale files live and how they are kept out of the tracked tree (a gitignore entry or a temp dir outside the tracked store), and add the store-write-throws path to the Error Handling section with its stated outcome. Cite the real write path and any gitignore you rely on.

## Disposition rules
1. Assess R2-1 and R2-2 on their merits: accept, partially accept, or reject, each with one line of reasoning. When a finding says a rationale clause is false, delete the clause unless you can prove the replacement with a probe.
2. Verify every citation you add or change against the real tree under `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated artifact is a MUST_FIX in the narrow check.
3. Do not widen scope, and do not re-decide what requirements pinned.
4. Write v3 in place. Add the Revision History line `- **v3** (2026-09-18) — Round-2 adversarial response (adversarial-analysis-design-r2.md, verdict iterate 0/2/2), SHOULD_FIX-only corrective pass.` followed by one nested bullet per fixed finding: `- **R2-1 — <Accepted | Partially accepted | Rejected> (SHOULD_FIX).** <what changed>` and the same for R2-2. Set the `Document version:` header to v3. A Revision-History bullet cites findings by id and prose only; no backticked path or identifier token. State what the fix did and cite the exact post-fix line.
5. Closed by ruling, leave as is: D11 and D3.
6. MDX rule: no bare angle brackets outside code spans.
7. Edit only the document. You may replace a `codebase-context.md` line an accepted finding refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same construct (every other git spawn for R2-1; every other atomic write for R2-2) and fix each; list them under the finding's bullet. A sibling left unchanged is next round's finding.
11. R2-1 and R2-2 each name a cross-artifact seam (a component and the Error Handling section, or a producer and its stated degraded outcome): edit and cite both ends under the finding's bullet, never one side only.

## Findings
Round 2 analysis: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/reviews/adversarial-analysis-design-r2.md

Fix ONLY these two SHOULD_FIX findings:
- R2-1 (SHOULD_FIX, Novel): a git spawn that hangs has no degraded path; the new spawn on the interactive status route can never return. See section `### R2-1` for the spawn site, the failure scenario, and why the reviewer rated it SHOULD_FIX.
- R2-2 (SHOULD_FIX, Novel): the atomic-write failure lifecycle leaks untracked temp/`.stale` debris into the git-tracked spec store, and Error Handling omits the store-write-throws path. See section `### R2-2`.

Do NOT fix R2-3 or R2-4 (both MINOR) in this pass — they are out of scope for the SHOULD_FIX-only corrective pass. Read the analysis file for the full text and evidence of R2-1 and R2-2.
