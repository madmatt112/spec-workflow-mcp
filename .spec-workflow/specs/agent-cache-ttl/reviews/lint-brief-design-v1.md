# Lint brief — agent-cache-ttl design v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings under `## Revision input` (or `## Findings`) in v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/agent-cache-ttl/design.md` in place, then report in 150 words or fewer: files touched; each finding as `<id>: accepted | partially accepted | rejected`; citations verified (count); the document's word count; flags. No file contents.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/agent-cache-ttl/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/agent-cache-ttl/design.md` (v1). Cap: 4,000 words. Do not grow the document past it; a fix that adds a paragraph removes one.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/agent-cache-ttl/requirements.md`.
- Code under `/home/mcf/repo/spec-workflow-mcp`.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one line of reasoning. The error (L-10) must be fixed. For each citation-identifier warning, open the cited range and either point the citation at the range that truly contains the identifier, or (when the token is discussed in prose but is not a real code identifier at that site) reword so the citation carries no unresolvable token. Never leave a false citation.
2. Verify every citation you add or change against the real tree under `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what an earlier phase pinned.
4. Edit v1 in place. Add no version line. Append under the v1 Revision History line one nested bullet: `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, ...>`.
5. Closed by ruling, leave as is: none.
6. MDX rule: no bare angle brackets outside code spans.
7. Edit only the document. You may replace a context-file line that an accepted finding refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same construct and fix each; list them under the finding's bullet.
10. Every citation you insert or change carries its filename (`typecheck.ts:30`), never a bare `:<line>`. A bare `:<line>` token outside a code block is itself a finding to fix.
11. First lint pass; no prior dispositions to suppress.

## Findings
L-1 (warning, citation-identifier, line 6): Identifier 'SubagentStop' is absent from the cited ranges (harness/hooks/sdd-activity.sh:47-55, scripts/sync-plugin-assets.cjs:85-128, src/watch/usage.ts:90-242, harness/skills/sdd-continue/references).
L-2 (warning, citation-identifier, line 47): Identifier 'experimental' is absent from the cited ranges (scripts/sync-plugin-assets.cjs:94-98).
L-3 (warning, citation-identifier, line 47): Identifier 'default' is absent from the cited ranges (scripts/sync-plugin-assets.cjs:94-98).
L-4 (warning, citation-identifier, line 58): Identifier 'agentLines' is absent from the cited ranges (src/watch/render.ts:220).
L-5 (warning, citation-identifier, line 58): Identifier 'cacheTtl' is absent from the cited ranges (src/watch/render.ts:220).
L-6 (warning, citation-identifier, line 58): Identifier 'default' is absent from the cited ranges (src/watch/render.ts:220).
L-7 (warning, citation-identifier, line 77): Identifier 'emptyCell' is absent from the cited ranges (src/watch/usage.ts:13).
L-8 (warning, citation-identifier, line 77): Identifier 'addCell' is absent from the cited ranges (src/watch/usage.ts:13).
L-9 (warning, citation-identifier, line 113): Identifier 'WORKTREE' is absent from the cited ranges (scripts/dev-link.sh:19, scripts/dev-link.sh:37-38, scripts/dev-link.sh:50-64).
L-10 (error, citation-path, line 113): Cited path `.mcp.json` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/.mcp.json`).
L-11 (warning, citation-identifier, line 117): Identifier 'jsonl' is absent from the cited ranges (harness/hooks/sdd-activity.sh:96).
L-12 (warning, citation-identifier, line 117): Identifier 'agent' is absent from the cited ranges (harness/hooks/sdd-activity.sh:96).
L-13 (warning, citation-identifier, line 180): Identifier 'claude' is absent from the cited ranges (src/__tests__/providers-map.test.ts:17-18).
L-14 (warning, citation-identifier, line 180): Identifier 'PATH' is absent from the cited ranges (src/__tests__/providers-map.test.ts:17-18).
L-15 (warning, citation-identifier, line 180): Identifier 'HOME' is absent from the cited ranges (src/__tests__/providers-map.test.ts:17-18).
L-16 (warning, citation-identifier, line 180): Identifier 'FORCE_PROMPT_CACHING_5M' is absent from the cited ranges (src/__tests__/providers-map.test.ts:17-18).
L-17 (warning, citation-identifier, line 180): Identifier 'CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL' is absent from the cited ranges (src/__tests__/providers-map.test.ts:17-18).
L-18 (warning, citation-identifier, line 180): Identifier 'CLAUDE_CONFIG_DIR' is absent from the cited ranges (src/__tests__/providers-map.test.ts:17-18).
