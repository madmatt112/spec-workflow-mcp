# Lint brief — provider-per-role design v2

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v2 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/design.md` in place, then report in 150 words or fewer: files touched; each finding as `<id>: accepted | partially accepted | rejected`; citations verified (count); the document's word count; flags. No file contents.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/codebase-context.md`. Read it first.
- Document: the design.md above (v2). Cap: 4,000 words (body: H1 to before `## Revision History`). The body is at 4,000 now — do not grow it; a fix that adds words removes words.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/requirements.md`.
- Findings: the list under `## Revision input`.
- Prior dispositions: the v1 lint pass rejected the citation-identifier warnings L-3..L-51 as false positives — the flagged tokens are the design's own new vocabulary (PROVIDERS, LAUNCHER, ALIAS, SID, CFG, SLUG, providers, provider, effort, deepseek, anthropic, MODEL, none, start, status, stdout, existsSync, and env-var names) at insertion-point citations, or prose words bound to a different citation in the same block. Rule 11 applies: a warning on a token unchanged since it was rejected with a reason is suppressed, not re-fired.

## Revision input
L-1 (ERROR, citation-path, line 183): Cited path `usage.test.ts` has no directory prefix; cite it by its full path from the code root (for example `src/watch/__tests__/usage.test.ts`). This was introduced by the v2 Testing Strategy edit. MUST fix.
L-2 (ERROR, citation-path, line 183): second occurrence of the same bare `usage.test.ts` on line 183. MUST fix — give it its full path prefix.
L-3..L-51 (warning, citation-identifier, lines 5,45,53,55,58,65,71,77,83,135,183,184,213): the same false-positive identifier warnings the v1 lint pass already rejected with a reason (design's own new vocabulary at insertion-point citations, or prose words bound to a different citation in the block). Suppress under rule 11 unless you find one that is a genuinely wrong citation, in which case fix that one and say which.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one line of reasoning.
2. Verify every citation you add or change against the real tree under `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. Confirm the corrected `usage.test.ts` range still exists in the file you cite.
3. Do not widen scope, and do not re-decide what an earlier phase pinned.
4. Edit v2 in place. Add no version line. Append under the v2 Revision History line one nested bullet: `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, …>`.
5. Closed by ruling, leave as is: the two round-1 refinement rulings (Req 2 crit 5, Req 2 crit 7).
6. MDX rule: no bare angle brackets outside code spans.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file belong to others.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same construct and fix each.
10. Every citation you insert or change carries its filename with directory prefix (`src/watch/__tests__/usage.test.ts:42-73`), never a bare filename or bare `:<line>`.
11. A citation-identifier warning on a token unchanged since a version where it was rejected with a reason is suppressed, not re-fired.
