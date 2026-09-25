# Lint brief — graph-orientation design v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
## Job
Fix the lint findings below in v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/design.md` in place, then report in 150 words or fewer: files touched; each finding as `<id>: accepted | partially accepted | rejected`; citations verified (count); the document's word count; flags. No file contents.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/design.md` (v1). Cap: 4,000 words. Do not grow the document past it; a fix that adds a paragraph removes one.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/requirements.md`.
- Findings: the list under `## Revision input`.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one line of reasoning. The 4 errors (L-3, L-4, L-5, L-15) are citation-path errors and MUST be fixed: L-3/L-4/L-5 cite an absolute path outside the code root (the graphify CLI in a pyenv site-packages dir) — that CLI is not in this repo, so drop the repo-style citation and state the graphify behaviour as a probe result, or cite the probe you ran; L-15 cites `references/formats.md` with no base — write the full path under the code root.
2. The citation-identifier warnings are your call: many name an identifier the design INTRODUCES (a new env line like GRAPH/GRAPH_BEHIND/GRAPH_BUILT_AT, a new field graphBuiltAt/graphBehind, a new function isGraphCall/applyGraphCounts/codeGraphSection) that is not yet in the cited existing range. For each, either reword the citation so it points at where the artifact is ADDED (without implying the identifier already exists), or, if the citation anchors an existing insertion point rather than claiming the identifier exists, reject with that reason. Never invent a line range you have not read both ends of.
3. Verify every citation you add or change against the real tree under `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range.
4. Do not widen scope, and do not re-decide what requirements pinned.
5. Edit v1 in place. Add no version line. Append under the v1 Revision History line one nested bullet: `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, ...>`.
6. Closed by ruling, leave as is: none.
7. MDX rule: no bare angle brackets outside code spans.
8. Edit only the document (and a context-file line an accepted finding refutes: same line, corrected text, the probe that proves it).
9. Do not ask questions.
10. After you accept a finding, search the document for every other place with the same construct and fix each; list them under the finding's bullet.
11. Every citation you insert or change carries its filename (`usage.ts:30`), never a bare `:<line>`.
12. A citation-identifier warning unchanged since a version where it was rejected is suppressed (first pass, none apply yet).

## Findings
L-1 (warning, citation-identifier, line 6): Identifier 'brief' absent from cited ranges (sdd-cache-ttl.sh:1-22, usage.ts:277-294, ledger.ts:26-36, ...).
L-2 (warning, citation-identifier, line 6): Identifier 'graph' absent from same cited ranges.
L-3 (error, citation-path, line 50): Cited path is absolute and not read: /home/mcf/.pyenv/versions/3.14.0/lib/python3.14/site-packages/graphify/cli.py.
L-4 (error, citation-path, line 50): Cited path is absolute and not read: .../graphify/watch.py.
L-5 (error, citation-path, line 50): Cited path is absolute and not read: .../graphify/watch.py (second occurrence).
L-6 (warning, citation-identifier, line 55): 'GRAPH' absent (SKILL.md:66-94).
L-7 (warning, citation-identifier, line 55): 'GRAPH_BEHIND' absent (SKILL.md:66-94).
L-8 (warning, citation-identifier, line 55): 'GRAPH_BUILT_AT' absent (SKILL.md:66-94).
L-9 (warning, citation-identifier, line 55): 'SPEC_STORE_REPO' absent (SKILL.md:66-94).
L-10 (warning, citation-identifier, line 56): 'GRAPH' absent (SKILL.md:96-116).
L-11 (warning, citation-identifier, line 56): 'GRAPH_BEHIND' absent (SKILL.md:96-116).
L-12 (warning, citation-identifier, line 56): 'WORKTREE' absent (SKILL.md:96-116).
L-13 (warning, citation-identifier, line 58): 'fact' absent (SKILL.md:320-327).
L-14 (warning, citation-identifier, line 59): 'GRAPH' absent (SKILL.md:262-269).
L-15 (error, citation-path, line 60): Cited path resolves under no base: references/formats.md (write the full path under the code root, e.g. harness/skills/sdd-continue/references/formats.md).
L-16 (warning, citation-identifier, line 81): 'graph' absent (harness.ts:547-655, 568, 633-635).
L-17 (warning, citation-identifier, line 81): 'none' absent (harness.ts:547-655, 568, 633-635).
L-18 (warning, citation-identifier, line 81): 'graphBuiltAt' absent (harness.ts:547-655, 568, 633-635).
L-19 (warning, citation-identifier, line 81): 'graphBehind' absent (harness.ts:547-655, 568, 633-635).
L-20 (warning, citation-identifier, line 89): 'GRAPH' absent (document-phase SKILL.md:8-12, implementation:14-19, closeout:...).
L-21 (warning, citation-identifier, line 89): 'GRAPH_BEHIND' absent (same ranges).
L-22 (warning, citation-identifier, line 89): 'GRAPH_BUILT_AT' absent (same ranges).
L-23 (warning, citation-identifier, line 90): 'GRAPH' absent (document-phase:43-44, implementation:37-38, closeout:...).
L-24 (warning, citation-identifier, line 90): 'harness' absent (same ranges).
L-25 (warning, citation-identifier, line 90): 'graph' absent (same ranges).
L-26 (warning, citation-identifier, line 90): 'graphBuiltAt' absent (same ranges).
L-27 (warning, citation-identifier, line 90): 'graphBehind' absent (same ranges).
L-28 (warning, citation-identifier, line 90): 'GRAPH_BUILT_AT' absent (same ranges).
L-29 (warning, citation-identifier, line 90): 'GRAPH_BEHIND' absent (same ranges).
L-30 (warning, citation-identifier, line 90): 'none' absent (same ranges).
L-31 (warning, citation-identifier, line 91): 'GRAPH' absent (implementation SKILL.md:84-159).
L-32 (warning, citation-identifier, line 91): 'WORKTREE' absent (implementation SKILL.md:84-159).
L-33 (warning, citation-identifier, line 92): 'CODE_ROOT' absent (closeout SKILL.md:120-159, 108-119).
L-34 (warning, citation-identifier, line 92): 'WORKTREE' absent (closeout SKILL.md:120-159, 108-119).
L-35 (warning, citation-identifier, line 93): 'GRAPH_BEHIND' absent (briefs.md:136-208, 386-409, ...).
L-36 (warning, citation-identifier, line 110): 'reduceSpawn' absent (usage.ts:283-292).
L-37 (warning, citation-identifier, line 112): 'readSpecActivity' absent (activity.sh:28-29, harness.ts:1029-1064, ledger.ts:176-189).
L-38 (warning, citation-identifier, line 114): 'graph' absent (usage.ts:361-410).
L-39 (warning, citation-identifier, line 120): 'graph' absent (TOOLS-REFERENCE.md:547-579, SDD-HARNESS.md:253-264).
L-40 (warning, citation-identifier, line 120): 'graphBuiltAt' absent (same ranges).
L-41 (warning, citation-identifier, line 120): 'graphBehind' absent (same ranges).
L-42 (warning, citation-identifier, line 165): 'graph' absent (harness.test.ts:165).
L-43 (warning, citation-identifier, line 165): 'codeGraphSection' absent (harness.test.ts:165).
L-44 (warning, citation-identifier, line 170): 'isGraphCall' absent (usage.test.ts:8-11, 320-355).
L-45 (warning, citation-identifier, line 170): 'applyGraphCounts' absent (usage.test.ts:8-11, 320-355).
L-46 (warning, citation-identifier, line 171): 'graphify' absent (providers-map.test.ts:17-34).
L-47 (warning, citation-identifier, line 171): 'PATH' absent (providers-map.test.ts:17-34).
L-48 (warning, citation-identifier, line 171): 'none' absent (providers-map.test.ts:17-34).
L-49 (warning, citation-identifier, line 171): 'built_at_commit' absent (providers-map.test.ts:17-34).
L-50 (warning, citation-identifier, line 171): 'unknown' absent (providers-map.test.ts:17-34).
L-51 (warning, citation-identifier, line 171): 'TIMEOUT_S' absent (providers-map.test.ts:17-34).
