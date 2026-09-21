# Lint brief — harness-usage-and-tiers tasks v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v1 of
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/tasks.md`
in place, then report in 150 words or fewer: files touched; each finding as
`<id>: accepted | partially accepted | rejected`; citations verified (count); the
document's word count; flags. No file contents.

## Inputs
- Context file:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/codebase-context.md`.
  Read it first; it maps the code the document cites.
- Document: the tasks.md above (v1). Cap: 150 words per task block, excluding its
  `_Prompt:` line. Do not grow the document past it; a fix that adds a paragraph
  removes one.
- Requirements:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/requirements.md`.
- Design:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/design.md`.
- Findings: the list under `## Revision input`.
- Prior dispositions: none (v1, first lint pass).
- Code under `/home/mcf/repo/spec-workflow-mcp`.

## Revision input
L-1 (warning, citation-identifier, line 18): Identifier 'role' absent from cited ranges (harness/agents/sdd-document-orchestrator.md:1-5, scripts/sync-plugin-assets.cjs:83-100, scripts/sync-plugin-assets.cjs:20)
L-2 (warning, citation-identifier, line 18): Identifier 'main' absent from the same cited ranges as L-1
L-3 (warning, citation-identifier, line 18): Identifier 'rootDir' absent from the same cited ranges as L-1
L-4 (error, citation-path, line 18): Cited path `tsconfig.json` has no directory prefix; cite it by its path from the code root (for example `dir/tsconfig.json`)
L-5 (warning, citation-identifier, line 28): Identifier 'SpawnNode' absent from cited ranges (src/watch/ledger.ts:293-314, src/watch/ledger.ts:305-311, src/watch/render.ts:60, src/watch/__tests__/ledger.test.ts:169-226)
L-6 (warning, citation-identifier, line 28): Identifier 'model' absent from the same cited ranges as L-5
L-7 (warning, citation-identifier, line 28): Identifier 'AGENT_PROFILES' absent from the same cited ranges as L-5
L-8 (warning, citation-identifier, line 39): Identifier 'loadAgentProfiles' absent from cited ranges (src/core/workspace-initializer.ts:9, src/watch/render.ts:1, src/watch/render.ts:55-58, src/watch/__tests__/render.test.ts:108-116)
L-9 (warning, citation-identifier, line 39): Identifier 'model' absent from the same cited ranges as L-8
L-10 (warning, citation-identifier, line 39): Identifier 'effort' absent from the same cited ranges as L-8
L-11 (warning, citation-identifier, line 39): Identifier 'agentLines' absent from the same cited ranges as L-8
L-12 (warning, citation-identifier, line 39): Identifier 'bad' absent from the same cited ranges as L-8
L-13 (warning, citation-identifier, line 39): Identifier 'high' absent from the same cited ranges as L-8
L-14 (warning, citation-identifier, line 48): Identifier 'UsageCell' absent from cited ranges (src/watch/ledger.ts:183-186, src/tools/harness.ts:641-645, src/watch/ledger.ts:216-224, src/watch/ledger.ts:200-202)
L-15 (warning, citation-identifier, line 48): Identifier 'UsageKinds' absent from the same cited ranges as L-14
L-16 (warning, citation-identifier, line 48): Identifier 'UsagePhase' absent from the same cited ranges as L-14
L-17 (warning, citation-identifier, line 48): Identifier 'UsageReport' absent from the same cited ranges as L-14
L-18 (warning, citation-identifier, line 48): Identifier 'UsageDelta' absent from the same cited ranges as L-14
L-19 (warning, citation-identifier, line 48): Identifier 'LedgerEvent' absent from the same cited ranges as L-14
L-20 (warning, citation-identifier, line 48): Identifier 'PHASE_ORDER' absent from the same cited ranges as L-14
L-21 (warning, citation-identifier, line 48): Identifier 'runs' absent from the same cited ranges as L-14
L-22 (warning, citation-identifier, line 48): Identifier 'usage' absent from the same cited ranges as L-14
L-23 (warning, citation-identifier, line 48): Identifier 'tokens' absent from the same cited ranges as L-14
L-24 (warning, citation-identifier, line 48): Identifier 'model' absent from the same cited ranges as L-14
L-25 (warning, citation-identifier, line 48): Identifier 'unknown' absent from the same cited ranges as L-14
L-26 (warning, citation-identifier, line 48): Identifier 'orchestratorShare' absent from the same cited ranges as L-14
L-27 (warning, citation-identifier, line 48): Identifier 'formatUsageTable' absent from the same cited ranges as L-14
L-28 (warning, citation-identifier, line 48): Identifier 'compare' absent from the same cited ranges as L-14
L-29 (warning, citation-identifier, line 48): Identifier 'delta' absent from the same cited ranges as L-14
L-30 (warning, citation-identifier, line 48): Identifier 'usageDelta' absent from the same cited ranges as L-14
L-31 (error, citation-path, line 58): Cited path `vitest.config.ts` has no directory prefix; cite it by its path from the code root (for example `dir/vitest.config.ts`)
L-32 (warning, citation-identifier, line 68): Identifier 'compareSpecName' absent from cited ranges (docs/TOOLS-REFERENCE.md:5)
L-33 (warning, citation-identifier, line 68): Identifier 'specName' absent from cited ranges (docs/TOOLS-REFERENCE.md:5)
L-34 (warning, citation-identifier, line 68): Identifier 'harnessHandler' absent from cited ranges (docs/TOOLS-REFERENCE.md:5)
L-35 (warning, citation-identifier, line 68): Identifier 'description' absent from cited ranges (docs/TOOLS-REFERENCE.md:5)
L-36 (warning, citation-identifier, line 68): Identifier 'usage' absent from cited ranges (docs/TOOLS-REFERENCE.md:5)
L-37 (warning, citation-identifier, line 68): Identifier 'selectRoots' absent from cited ranges (docs/TOOLS-REFERENCE.md:5)
L-38 (warning, citation-identifier, line 68): Identifier 'getSpecPath' absent from cited ranges (docs/TOOLS-REFERENCE.md:5)
L-39 (warning, citation-identifier, line 68): Identifier 'ENOENT' absent from cited ranges (docs/TOOLS-REFERENCE.md:5)
L-40 (warning, citation-identifier, line 68): Identifier 'parseJsonl' absent from cited ranges (docs/TOOLS-REFERENCE.md:5)
L-41 (warning, citation-identifier, line 68): Identifier 'compare' absent from cited ranges (docs/TOOLS-REFERENCE.md:5)
L-42 (warning, citation-identifier, line 68): Identifier 'delta' absent from cited ranges (docs/TOOLS-REFERENCE.md:5)
L-43 (warning, citation-identifier, line 68): Identifier 'safeJoin' absent from cited ranges (docs/TOOLS-REFERENCE.md:5)
L-44 (warning, citation-identifier, line 68): Identifier 'writeLedger' absent from cited ranges (docs/TOOLS-REFERENCE.md:5)
L-45 (warning, citation-identifier, line 68): Identifier 'report' absent from cited ranges (docs/TOOLS-REFERENCE.md:5)
L-46 (warning, citation-identifier, line 68): Identifier 'message' absent from cited ranges (docs/TOOLS-REFERENCE.md:5)
L-47 (warning, citation-identifier, line 68): Identifier 'tokens' absent from cited ranges (docs/TOOLS-REFERENCE.md:5)
L-48 (warning, citation-identifier, line 68): Identifier 'start' absent from cited ranges (docs/TOOLS-REFERENCE.md:5)
L-49 (warning, citation-identifier, line 68): Identifier 'runs' absent from cited ranges (docs/TOOLS-REFERENCE.md:5)
L-50 (warning, citation-identifier, line 68): Identifier 'harness' absent from cited ranges (docs/TOOLS-REFERENCE.md:5)
L-51 (warning, citation-identifier, line 68): Identifier 'slot' absent from cited ranges (docs/TOOLS-REFERENCE.md:5)
L-52 (warning, citation-identifier, line 68): Identifier 'payload' absent from cited ranges (docs/TOOLS-REFERENCE.md:5)
L-53 (warning, citation-identifier, line 68): Identifier 'gate' absent from cited ranges (docs/TOOLS-REFERENCE.md:5)
L-54 (warning, citation-identifier, line 68): Identifier 'unknown' absent from cited ranges (docs/TOOLS-REFERENCE.md:5)
L-55 (warning, citation-identifier, line 77): Identifier 'num' absent from cited ranges (harness/hooks/hooks.json:33)
L-56 (warning, citation-identifier, line 77): Identifier 'readUsage' absent from cited ranges (harness/hooks/hooks.json:33)
L-57 (warning, citation-identifier, line 77): Identifier 'transcript_path' absent from cited ranges (harness/hooks/hooks.json:33)
L-58 (warning, citation-identifier, line 77): Identifier 'try' absent from cited ranges (harness/hooks/hooks.json:33)
L-59 (warning, citation-identifier, line 77): Identifier 'parse' absent from cited ranges (harness/hooks/hooks.json:33)
L-60 (warning, citation-identifier, line 77): Identifier 'input_tokens' absent from cited ranges (harness/hooks/hooks.json:33)
L-61 (warning, citation-identifier, line 77): Identifier 'output_tokens' absent from cited ranges (harness/hooks/hooks.json:33)
L-62 (warning, citation-identifier, line 77): Identifier 'cache_creation_input_tokens' absent from cited ranges (harness/hooks/hooks.json:33)
L-63 (warning, citation-identifier, line 77): Identifier 'cache_read_input_tokens' absent from cited ranges (harness/hooks/hooks.json:33)
L-64 (warning, citation-identifier, line 77): Identifier 'type' absent from cited ranges (harness/hooks/hooks.json:33)
L-65 (warning, citation-identifier, line 77): Identifier 'assistant' absent from cited ranges (harness/hooks/hooks.json:33)
L-66 (warning, citation-identifier, line 77): Identifier 'usage' absent from cited ranges (harness/hooks/hooks.json:33)
L-67 (warning, citation-identifier, line 77): Identifier 'model' absent from cited ranges (harness/hooks/hooks.json:33)
L-68 (warning, citation-identifier, line 77): Identifier 'SubagentStop' absent from cited ranges (harness/hooks/hooks.json:33)
L-69 (warning, citation-identifier, line 77): Identifier 'tokens' absent from cited ranges (harness/hooks/hooks.json:33)
L-70 (warning, citation-identifier, line 77): Identifier 'String' absent from cited ranges (harness/hooks/hooks.json:33)
L-71 (warning, citation-identifier, line 77): Identifier 'user' absent from cited ranges (harness/hooks/hooks.json:33)
L-72 (warning, citation-identifier, line 77): Identifier 'input' absent from cited ranges (harness/hooks/hooks.json:33)
L-73 (warning, citation-identifier, line 77): Identifier 'toMatchObject' absent from cited ranges (harness/hooks/hooks.json:33)
L-74 (warning, citation-identifier, line 91): Identifier 'input' absent from cited ranges (harness/skills/sdd-document-phase/SKILL.md:47-50, harness/skills/sdd-implementation-phase/SKILL.md:57-60, harness/skills/sdd-closeout-phase/SKILL.md)
L-75 (warning, citation-identifier, line 91): Identifier 'output' absent from the same cited ranges as L-74
L-76 (warning, citation-identifier, line 91): Identifier 'cacheWrite' absent from the same cited ranges as L-74
L-77 (warning, citation-identifier, line 91): Identifier 'cacheRead' absent from the same cited ranges as L-74
L-78 (warning, citation-identifier, line 91): Identifier 'model' absent from the same cited ranges as L-74
L-79 (warning, citation-identifier, line 91): Identifier 'SubagentStop' absent from the same cited ranges as L-74
L-80 (warning, citation-identifier, line 95): Identifier 'SpawnNode' absent from cited ranges (src/watch/__tests__/render.test.ts:53, src/watch/__tests__/render.test.ts:56, src/watch/__tests__/render.test.ts:104)
L-81 (warning, citation-identifier, line 95): Identifier 'PHASE_ORDER' absent from the same cited ranges as L-80
L-82 (info, citation-bare, line 106): Bare range `:305-311` has no earlier path citation in its block

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with
   one line of reasoning. Never accept to be agreeable; never reject to save work.
   When a finding says a rationale clause is false, delete the clause unless you can
   prove the replacement with a probe; never reword an unproven claim. Note: many
   citation-identifier warnings name an artifact the task itself creates (a new type,
   export or helper that does not yet exist in the cited range) — that is a legitimate
   forward reference; reject it with that reason rather than deleting the citation, but
   only after confirming the identifier is genuinely absent because the task creates it.
   Where a cited range is simply wrong (the identifier exists elsewhere in the file, or
   the range is off), fix the citation.
2. Verify every citation you add or change against the real tree under
   `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated
   artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what an earlier phase pinned.
4. Edit v1 in place. Add no version line. Append under the v1 Revision History line
   one nested bullet: `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, …>`.
5. Closed by ruling, leave as is: none.
6. MDX rule: no bare angle brackets outside code spans. tasks.md: keep the template's
   task shape; every task numbered; `_Prompt: …_` ends with `_`.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file
   belong to others. You may replace a context-file line that an accepted finding
   refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same
   construct (the same rule table, command, fixture shape or union member) and fix each;
   list them under the finding's bullet. A sibling left unchanged is next round's finding.
10. Every citation you insert or change carries its filename (`typecheck.ts:30`), never
    a bare `:<line>`. A bare `:<line>` token outside a code block is itself a finding to
    fix (see L-82), so a later pass cannot re-resolve it to the wrong file.
11. A citation-identifier warning on a token that is unchanged since a version where it
    was rejected with a reason is suppressed, not re-fired. (Not applicable at v1.)
