# graph-orientation requirements v3 lint

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v3 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/requirements.md` in place, then report in 150 words or fewer: files touched; each finding as `<id>: accepted | partially accepted | rejected`; citations verified (count); the document's word count; flags. No file contents.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/codebase-context.md`. Read it first.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/requirements.md` (v3). Cap: 3,500 words (currently ~3,131 body words). Do not grow the document.
- Code under /home/mcf/repo/spec-workflow-mcp. Project rules: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md.
- Prior dispositions: the v1 and v2 lint passes both rejected the citation-identifier warnings on this feature's to-be-built artifacts (the `GRAPH`/`GRAPH_BEHIND`/`GRAPH_BUILT_AT`/`built_at_commit` env keys and fields, `CODE_ROOT` in the run.start range, the `graph`/`graphBuiltAt`/`graphBehind`/`start`/`spawns` usage fields, the `explain`/`query` subcommands) because each names an artifact this feature will build that does not yet exist in the cited range. The round-1 and round-2 reviewers confirmed that reasoning.

## Disposition rules
1. There are zero errors this pass; all 24 findings are citation-identifier warnings.
2. A warning on a token unchanged since a version where it was rejected with a reason is suppressed — reject it, reason `unchanged; to-be-built artifact, ruled in v1/v2 lint`.
3. The tokens newly written by v3 — `start` and `spawns` at line 93, and `built_at_commit` at line 104 — name the same class of to-be-built artifacts (the run.start row field, the usage spawns column, the graph-built-at commit field). Before rejecting each, verify its cited range points at the right code (line 93 cites harness/hooks/sdd-activity.sh:126-128 and src/watch/usage.ts:159; line 104 cites harness/skills/sdd-continue/SKILL.md:320-327). If a range is simply wrong, fix the range; otherwise reject with the to-be-built reason.
4. Edit v3 in place. Add no version line. Append under the v3 Revision History line one nested bullet: `- **Lint pass.** <n> fixed; rejected: <L-n reason, ...>`.
5. Every citation you insert or change carries its filename, never a bare `:<line>`.
6. MDX rule: no bare angle brackets outside code spans. EARS acceptance criteria keep their WHEN/IF/THEN/SHALL shape.
7. Edit only the document (and a context-file line an accepted finding refutes). Approvals, HANDOFF, memory file belong to others.
8. Do not ask questions. Do not widen scope.

## Findings
L-1 (warning, citation-identifier, line 19): 'GRAPH' absent from sdd-continue/SKILL.md:66-94, :224-247
L-2 (warning, line 23): 'GRAPH' absent from sdd-continue/SKILL.md:224-247
L-3 (warning, line 24): 'GRAPH' absent from sdd-continue/SKILL.md:320-327
L-4 (warning, line 24): 'GRAPH_BEHIND' absent from sdd-continue/SKILL.md:320-327
L-5 (warning, line 24): 'GRAPH_BUILT_AT' absent from sdd-continue/SKILL.md:320-327
L-6 (warning, line 34): 'GRAPH' absent from sdd-continue/SKILL.md:108-110
L-7 (warning, line 34): 'GRAPH_BEHIND' absent from sdd-continue/SKILL.md:108-110
L-8 (warning, line 34): 'CODE_ROOT' absent from sdd-continue/SKILL.md:108-110
L-9 (warning, line 35): 'GRAPH' absent from sdd-implementation-phase/SKILL.md:84-159
L-10 (warning, line 36): 'GRAPH' absent from sdd-closeout-phase/SKILL.md:120-159
L-11 (warning, line 48): 'graph' absent from src/tools/harness.ts:28-49, :485-535
L-12 (warning, line 53): 'graph' absent from src/tools/harness.ts:617-631
L-13 (warning, line 53): 'graphBuiltAt' absent from src/tools/harness.ts:617-631
L-14 (warning, line 53): 'graphBehind' absent from src/tools/harness.ts:617-631
L-15 (warning, line 65): 'GRAPH' absent from document-phase briefs.md:136-208, :386-409
L-16 (warning, line 75): 'GRAPH' absent from document-phase briefs.md:50-59
L-17 (warning, line 75): 'explain' absent from document-phase briefs.md:50-59
L-18 (warning, line 75): 'query' absent from document-phase briefs.md:50-59
L-19 (warning, line 89): 'graph' absent from usage.ts:361-410, harness.ts:1072-1093, usage.ts:113-218
L-20 (warning, line 93): 'graph' absent from sdd-activity.sh:126-128, usage.ts:159
L-21 (warning, line 93, NEW in v3): 'start' absent from sdd-activity.sh:126-128, usage.ts:159
L-22 (warning, line 93, NEW in v3): 'spawns' absent from sdd-activity.sh:126-128, usage.ts:159
L-23 (warning, line 101): 'graph' absent from docs/TOOLS-REFERENCE.md:547-579
L-24 (warning, line 104, NEW in v3): 'built_at_commit' absent from sdd-continue/SKILL.md:320-327
