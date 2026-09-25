# Lint brief — graph-orientation requirements v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/requirements.md` in place, then report in 150 words or fewer: files touched; each finding as `<id>: accepted | partially accepted | rejected`; citations verified (count); the document's word count; flags. No file contents.

### Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: the requirements.md above (v1). Cap: 3,500 words. Do not grow the document past it; a fix that adds a paragraph removes one.
- Findings: the list below. Every one is a citation-identifier warning: the named identifier is absent from the cited line range. For each, either (a) point the citation at the range that actually contains the identifier, or (b) if the identifier is a NEW name this spec proposes (an env var, field, or section that does not exist in the code yet), reject the finding with that reason, or reword so the sentence does not read as citing an existing identifier. Verify against the real tree.

### Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one line of reasoning. Never accept to be agreeable; never reject to save work.
2. Verify every citation you add or change against the real tree under `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what an earlier phase pinned.
4. Edit v1 in place. Add no version line. Append under the v1 Revision History line one nested bullet: `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, ...>`.
5. Closed by ruling, leave as is: none.
6. MDX rule: no bare angle brackets outside code spans.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file belong to others. You may replace a context-file line that an accepted finding refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same construct and fix each; list them under the finding's bullet.
10. Every citation you insert or change carries its filename, never a bare `:<line>`.
11. A citation-identifier warning on a token unchanged since a version where it was rejected with a reason is suppressed, not re-fired.

## Findings
L-1 (warning, citation-identifier, line 19): Identifier 'GRAPH' is absent from the cited ranges (harness/skills/sdd-continue/SKILL.md:66-94)
L-2 (warning, citation-identifier, line 19): Identifier 'CODE_ROOT' is absent from the cited ranges (harness/skills/sdd-continue/SKILL.md:66-94)
L-3 (warning, citation-identifier, line 23): Identifier 'GRAPH' is absent from the cited ranges (harness/skills/sdd-continue/SKILL.md:224-247)
L-4 (warning, citation-identifier, line 24): Identifier 'GRAPH' is absent from the cited ranges (harness/skills/sdd-continue/SKILL.md:320-327)
L-5 (warning, citation-identifier, line 24): Identifier 'GRAPH_BEHIND' is absent from the cited ranges (harness/skills/sdd-continue/SKILL.md:320-327)
L-6 (warning, citation-identifier, line 24): Identifier 'GRAPH_BUILT_AT' is absent from the cited ranges (harness/skills/sdd-continue/SKILL.md:320-327)
L-7 (warning, citation-identifier, line 35): Identifier 'GRAPH' is absent from the cited ranges (harness/skills/sdd-implementation-phase/SKILL.md:84-159)
L-8 (warning, citation-identifier, line 36): Identifier 'GRAPH' is absent from the cited ranges (harness/skills/sdd-closeout-phase/SKILL.md:120-159)
L-9 (warning, citation-identifier, line 48): Identifier 'harness' is absent from the cited ranges (src/tools/harness.ts:485-535)
L-10 (warning, citation-identifier, line 48): Identifier 'brief' is absent from the cited ranges (src/tools/harness.ts:485-535)
L-11 (warning, citation-identifier, line 48): Identifier 'graph' is absent from the cited ranges (src/tools/harness.ts:485-535)
L-12 (warning, citation-identifier, line 53): Identifier 'graph' is absent from the cited ranges (src/tools/harness.ts:617-631)
L-13 (warning, citation-identifier, line 53): Identifier 'graphBuiltAt' is absent from the cited ranges (src/tools/harness.ts:617-631)
L-14 (warning, citation-identifier, line 53): Identifier 'graphBehind' is absent from the cited ranges (src/tools/harness.ts:617-631)
L-15 (warning, citation-identifier, line 55): Identifier 'git' is absent from the cited ranges (src/tools/harness.ts:17-27)
L-16 (warning, citation-identifier, line 55): Identifier 'values' is absent from the cited ranges (src/tools/harness.ts:17-27)
L-17 (warning, citation-identifier, line 65): Identifier 'GRAPH' is absent from the cited ranges (harness/skills/sdd-document-phase/references/briefs.md:136-208, harness/skills/sdd-document-phase/references/briefs.md:386-409)
L-18 (warning, citation-identifier, line 75): Identifier 'GRAPH' is absent from the cited ranges (harness/skills/sdd-document-phase/references/briefs.md:50-59)
L-19 (warning, citation-identifier, line 75): Identifier 'explain' is absent from the cited ranges (harness/skills/sdd-document-phase/references/briefs.md:50-59)
L-20 (warning, citation-identifier, line 75): Identifier 'query' is absent from the cited ranges (harness/skills/sdd-document-phase/references/briefs.md:50-59)
L-21 (warning, citation-identifier, line 88): Identifier 'agent' is absent from the cited ranges (src/watch/usage.ts:277-294)
L-22 (warning, citation-identifier, line 89): Identifier 'graph' is absent from the cited ranges (src/watch/usage.ts:361-410)
L-23 (warning, citation-identifier, line 100): Identifier 'graph' is absent from the cited ranges (docs/TOOLS-REFERENCE.md:547-579)
