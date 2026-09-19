# Lint brief — harness-usage-and-tiers design v2

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v2 of
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/design.md`
in place, then report in 150 words or fewer: files touched; each finding as `<id>:
accepted | partially accepted | rejected`; citations verified (count); the document's
word count; flags. No file contents.

## Inputs
- Context file:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/codebase-context.md`.
  Read it first.
- Document:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/design.md`
  (v2). Cap: 4,000 words (body only, H1 to line before `## Revision History`). The body
  is at exactly 4,000 — do not grow it; a fix that adds words removes the same elsewhere.
- Requirements:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/requirements.md`.
- Findings: the list under `## Revision input`.
- Prior dispositions: the v1 lint pass already dispositioned this same finding set (see
  the `- **Lint pass.**` bullet under the v1 Revision History line). It accepted the
  bare/unqualified citations and rejected 60 `citation-identifier` warnings because each
  named a new or proposed identifier this design introduces, or a symbol attributed to a
  different citation in the same prose block. Those rejections still stand under rule 11.

## Revision input
The one error (L-2) is the only finding that must change the document:

L-2 (error, citation-path, line 15): Cited path `vitest.config.ts` has no directory
prefix. The file is genuinely at the repo root, so the citation is accurate, but the
checker (`src/core/lint-citations.ts:244`) rejects any cited path without a `/`. Fix it by
citing the root file with an explicit relative prefix: change `vitest.config.ts:7` to
`./vitest.config.ts:7`. The checker refuses only `..` and a leading `/`; `./vitest.config.ts`
contains a `/`, resolves against the code root, and clears the error. Verify line 7 of
`/home/mcf/repo/spec-workflow-mcp/vitest.config.ts` still holds the fixture-exclusion
text you cite.

The remaining 77 findings are all `citation-identifier` warnings — the same set the v1
lint pass rejected, re-fired against v2's line numbers. Apply rule 11: a warning on a
token unchanged since the version where it was rejected with a reason is suppressed, not
re-worked. Re-reject each with the standing reason, unless on a fresh read the named
identifier is one the design claims already exists inside the cited range but does not —
that single case is a real fix. The warnings, by line: L-1 line 7 (transcript_path);
L-3, L-4 line 22 (SubagentStop, harness); L-5, L-6 line 60 (String, model); L-7 line 61
(jsonl); L-8, L-9, L-10 line 66 (role, main, build); L-11, L-12, L-13 line 73 (model,
effort, role); L-14, L-15 line 76 (SpawnNode, model); L-16 through L-29 line 94
(buildUsageReport, runs, usage, Spawn, current, tokens, model, phaseKey, unknown, spawns,
kinds, orchestratorShare, null, PHASE_ORDER); L-30 line 99 (buildModel); L-31 through
L-35 line 103 (harnessHandler, usage, compareSpecName, compare, delta); L-36, L-37, L-38
line 104 (buildUsageReport, usageDelta, formatUsageTable); L-39 through L-44 line 115
(slot, payload, compareSpecName, gate, usage, unknown); L-45 line 116 (SubagentStop);
L-46 line 125 (usage); L-47, L-48 line 137 (assistant, model); L-49 line 165 (readUsage);
L-50, L-51, L-52 line 168 (usage, compareSpecName, safeJoin); L-53, L-54 line 170 (start,
buildModel); L-55 through L-60 line 175 (assistant, usage, user, transcript_path, model,
tokens); L-61, L-62 line 176 (model, high); L-63 line 177 (model); L-64 through L-69 line
178 (report, message, compareSpecName, delta, tokens, usage); L-70, L-71 line 179 (model,
effort); L-72, L-73 line 182 (agentId, jsonl); L-74, L-75, L-76 line 183 (jsonl,
SubagentStop, verification); L-77 line 192 (loadAgentProfiles); L-78 line 200 (usage).

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one
   line of reasoning. Never accept to be agreeable; never reject to save work.
2. Verify every citation you add or change against the real tree under
   `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range.
3. Do not widen scope, and do not re-decide what the requirements pinned.
4. Edit v2 in place. Add no version line. Append under the v2 Revision History line one
   nested bullet: `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, …>`.
5. Closed by ruling, leave as is: none.
6. MDX rule: no bare angle brackets outside code spans.
7. Edit only the document. You may replace a context-file line an accepted finding refutes.
8. Do not ask questions.
9. After you accept a finding, fix every sibling with the same construct.
10. Every citation you insert or change carries its filename, never a bare `:<line>`.
11. A citation-identifier warning on a token unchanged since a version where it was
    rejected with a reason is suppressed, not re-fired.
