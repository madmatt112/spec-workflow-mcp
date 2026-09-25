# graph-orientation requirements v2 lint

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v2 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/requirements.md` in place, then report in 150 words or fewer: files touched; each finding as `<id>: accepted | partially accepted | rejected`; citations verified (count); the document's word count; flags. No file contents.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/requirements.md` (v2). Cap: 3,500 words (currently ~3,355 body words — little headroom, so do not add prose; a fix that adds words removes words elsewhere).
- Code under /home/mcf/repo/spec-workflow-mcp. Project rules: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md.
- Prior dispositions: v1's lint pass rejected the citation-identifier warnings on the `GRAPH`/`GRAPH_BEHIND`/`GRAPH_BUILT_AT` env keys, the `graph`/`graphBuiltAt`/`graphBehind` fields, and the `explain`/`query` subcommands, because each names a to-be-built artifact of this feature that does not yet exist in the cited range. The round-1 reviewer confirmed that reasoning.

## Disposition rules
1. Assess every finding on its merits: accept (fix), partially accept, or reject, each with one line of reasoning.
2. The ONE error (L-22, citation-path, line 118) MUST be fixed: the document cites an absolute path outside the repo (`/home/mcf/.pyenv/.../site-packages/graphify/watch.py`). The lint cannot read an absolute or `..` path. Reword the Reliability line so the shrink-guard claim cites a path the lint can check under /home/mcf/repo/spec-workflow-mcp, or, if graphify's internal file is genuinely the only source and lives outside the repo, state the behaviour in prose without a backticked out-of-repo path token (do not invent a repo path). Keep the claim true; delete an unprovable clause rather than reword it.
3. Citation-identifier warnings (L-1..L-21): a warning on a token unchanged since a version where it was rejected with a reason is suppressed — reject it, reason `unchanged; to-be-built artifact, ruled in v1 lint`. The warnings on newly written lines (L-6, L-7, L-8 at line 34; L-19 at line 89; L-20 at line 93) name the same to-be-built artifacts (the `GRAPH`/`GRAPH_BEHIND` env keys, `CODE_ROOT`, the `graph` usage field) — reject each with the to-be-built reason unless the citation is simply wrong, in which case fix the range.
4. Edit v2 in place. Add no version line. Append under the v2 Revision History line one nested bullet: `- **Lint pass.** <n> fixed; rejected: <L-n reason, ...>`.
5. Every citation you insert or change carries its filename, never a bare `:<line>`.
6. MDX rule: no bare angle brackets outside code spans. EARS acceptance criteria keep their WHEN/IF/THEN/SHALL shape.
7. Edit only the document (and a context-file line an accepted finding refutes). Approvals, HANDOFF, memory file belong to others.
8. Do not ask questions. Do not widen scope.

## Findings
L-1 (warning, citation-identifier, line 19): 'GRAPH' absent from harness/skills/sdd-continue/SKILL.md:66-94, :224-247
L-2 (warning, citation-identifier, line 23): 'GRAPH' absent from harness/skills/sdd-continue/SKILL.md:224-247
L-3 (warning, citation-identifier, line 24): 'GRAPH' absent from harness/skills/sdd-continue/SKILL.md:320-327
L-4 (warning, citation-identifier, line 24): 'GRAPH_BEHIND' absent from harness/skills/sdd-continue/SKILL.md:320-327
L-5 (warning, citation-identifier, line 24): 'GRAPH_BUILT_AT' absent from harness/skills/sdd-continue/SKILL.md:320-327
L-6 (warning, citation-identifier, line 34): 'GRAPH' absent from harness/skills/sdd-continue/SKILL.md:108-110
L-7 (warning, citation-identifier, line 34): 'GRAPH_BEHIND' absent from harness/skills/sdd-continue/SKILL.md:108-110
L-8 (warning, citation-identifier, line 34): 'CODE_ROOT' absent from harness/skills/sdd-continue/SKILL.md:108-110
L-9 (warning, citation-identifier, line 35): 'GRAPH' absent from harness/skills/sdd-implementation-phase/SKILL.md:84-159
L-10 (warning, citation-identifier, line 36): 'GRAPH' absent from harness/skills/sdd-closeout-phase/SKILL.md:120-159
L-11 (warning, citation-identifier, line 48): 'graph' absent from src/tools/harness.ts:28-49, :485-535
L-12 (warning, citation-identifier, line 53): 'graph' absent from src/tools/harness.ts:617-631
L-13 (warning, citation-identifier, line 53): 'graphBuiltAt' absent from src/tools/harness.ts:617-631
L-14 (warning, citation-identifier, line 53): 'graphBehind' absent from src/tools/harness.ts:617-631
L-15 (warning, citation-identifier, line 65): 'GRAPH' absent from harness/skills/sdd-document-phase/references/briefs.md:136-208, :386-409
L-16 (warning, citation-identifier, line 75): 'GRAPH' absent from harness/skills/sdd-document-phase/references/briefs.md:50-59
L-17 (warning, citation-identifier, line 75): 'explain' absent from harness/skills/sdd-document-phase/references/briefs.md:50-59
L-18 (warning, citation-identifier, line 75): 'query' absent from harness/skills/sdd-document-phase/references/briefs.md:50-59
L-19 (warning, citation-identifier, line 89): 'graph' absent from src/watch/usage.ts:361-410, src/tools/harness.ts:1072-1093, src/watch/usage.ts:113-218
L-20 (warning, citation-identifier, line 93): 'graph' absent from harness/hooks/sdd-activity.sh:126-128, src/watch/usage.ts:366
L-21 (warning, citation-identifier, line 101): 'graph' absent from docs/TOOLS-REFERENCE.md:547-579
L-22 (ERROR, citation-path, line 118): Cited path is absolute or contains '..' and is not read: /home/mcf/.pyenv/versions/3.14.0/lib/python3.14/site-packages/graphify/watch.py
