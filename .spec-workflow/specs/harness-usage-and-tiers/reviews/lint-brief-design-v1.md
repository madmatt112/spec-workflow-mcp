# Lint brief — harness-usage-and-tiers design v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v1 of
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/design.md`
in place, then report in 150 words or fewer: files touched; each finding as `<id>:
accepted | partially accepted | rejected`; citations verified (count); the document's
word count; flags. No file contents.

## Inputs
- Context file:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/codebase-context.md`.
  Read it first; it maps the code the document cites.
- Document:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/design.md`
  (v1). Cap: 4,000 words. Do not grow the document past it; a fix that adds a paragraph
  removes one.
- Requirements:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/requirements.md`.
- Findings: the list under `## Revision input`.
- Code under `/home/mcf/repo/spec-workflow-mcp`.

## Revision input
L-1 (warning, citation-identifier, line 7): Identifier 'transcript_path' is absent from the cited ranges (harness/hooks/sdd-activity.sh:63-65, harness/hooks/sdd-activity.sh:83-85, src/watch/ledger.ts:41-53, src/tools/harness.ts:46, ...).
L-2 (warning, citation-identifier, line 7): Identifier 'parseJsonl' is absent from the cited ranges (same ranges as L-1).
L-3 (error, citation-path, line 15): Cited path `vitest.config.ts` has no directory prefix; cite it by its path from the code root (for example `dir/vitest.config.ts`).
L-4 (warning, citation-identifier, line 22): Identifier 'unknown' is absent from the cited ranges (harness/skills/sdd-continue/SKILL.md:213-217).
L-5 (warning, citation-identifier, line 22): Identifier 'SubagentStop' is absent from the cited ranges (harness/skills/sdd-continue/SKILL.md:213-217).
L-6 (warning, citation-identifier, line 22): Identifier 'harness' is absent from the cited ranges (harness/skills/sdd-continue/SKILL.md:213-217).
L-7 (info, citation-bare, line 41): Bare range `:63-65` has no earlier path citation in its block.
L-8 (info, citation-bare, line 41): Bare range `:83-85` has no earlier path citation in its block.
L-9 (warning, citation-identifier, line 60): Identifier 'SubagentStop' is absent from the cited ranges (src/watch/ledger.ts:31, :83, :65).
L-10 (warning, citation-identifier, line 60): Identifier 'String' is absent from the cited ranges (src/watch/ledger.ts:31, :83, :65).
L-11 (warning, citation-identifier, line 60): Identifier 'model' is absent from the cited ranges (src/watch/ledger.ts:31, :83, :65).
L-12 (warning, citation-identifier, line 61): Identifier 'jsonl' is absent from the cited ranges (harness/hooks/hooks.json:33).
L-13 (warning, citation-identifier, line 66): Identifier 'role' is absent from the cited ranges (harness/agents/sdd-checker.md:1-8, harness/agents/sdd-document-orchestrator.md:3, scripts/sync-plugin-assets.cjs:83-100, ...).
L-14 (warning, citation-identifier, line 66): Identifier 'main' is absent from the cited ranges (same ranges as L-13).
L-15 (warning, citation-identifier, line 66): Identifier 'build' is absent from the cited ranges (same ranges as L-13).
L-16 (warning, citation-identifier, line 73): Identifier 'model' is absent from the cited ranges (src/core/workspace-initializer.ts:9).
L-17 (warning, citation-identifier, line 73): Identifier 'effort' is absent from the cited ranges (src/core/workspace-initializer.ts:9).
L-18 (warning, citation-identifier, line 73): Identifier 'role' is absent from the cited ranges (src/core/workspace-initializer.ts:9).
L-19 (info, citation-bare, line 76): Bare range `:240-247` has no earlier path citation in its block.
L-20 (info, citation-bare, line 76): Bare range `:245` has no earlier path citation in its block.
L-21 (info, citation-bare, line 77): Bare range `:271` has no earlier path citation in its block.
L-22 (info, citation-bare, line 78): Bare range `:316` has no earlier path citation in its block.
L-23 (info, citation-bare, line 80): Bare range `:129-142` has no earlier path citation in its block.
L-24 (info, citation-bare, line 80): Bare range `:226-291` has no earlier path citation in its block.
L-25 (info, citation-bare, line 85): Bare range `:203` has no earlier path citation in its block.
L-26 (info, citation-bare, line 85): Bare range `:188` has no earlier path citation in its block.
L-27 (info, citation-bare, line 85): Bare range `:267-271` has no earlier path citation in its block.
L-28 (info, citation-bare, line 87): Bare range `:205-209` has no earlier path citation in its block.
L-29 (info, citation-bare, line 89): Bare range `:16-19` has no earlier path citation in its block.
L-30 (info, citation-bare, line 89): Bare range `:44-58` has no earlier path citation in its block.
L-31 (warning, citation-identifier, line 94): Identifier 'buildUsageReport' is absent from the cited ranges (src/watch/ledger.ts:183-186, :217-224, :238).
L-32 (warning, citation-identifier, line 94): Identifier 'runs' is absent from the cited ranges (same ranges as L-31).
L-33 (warning, citation-identifier, line 94): Identifier 'usage' is absent from the cited ranges (same ranges as L-31).
L-34 (warning, citation-identifier, line 94): Identifier 'Spawn' is absent from the cited ranges (same ranges as L-31).
L-35 (warning, citation-identifier, line 94): Identifier 'current' is absent from the cited ranges (same ranges as L-31).
L-36 (warning, citation-identifier, line 94): Identifier 'tokens' is absent from the cited ranges (same ranges as L-31).
L-37 (warning, citation-identifier, line 94): Identifier 'model' is absent from the cited ranges (same ranges as L-31).
L-38 (warning, citation-identifier, line 94): Identifier 'phaseKey' is absent from the cited ranges (same ranges as L-31).
L-39 (warning, citation-identifier, line 94): Identifier 'unknown' is absent from the cited ranges (same ranges as L-31).
L-40 (warning, citation-identifier, line 94): Identifier 'spawns' is absent from the cited ranges (same ranges as L-31).
L-41 (warning, citation-identifier, line 94): Identifier 'kinds' is absent from the cited ranges (same ranges as L-31).
L-42 (warning, citation-identifier, line 94): Identifier 'orchestratorShare' is absent from the cited ranges (same ranges as L-31).
L-43 (warning, citation-identifier, line 94): Identifier 'null' is absent from the cited ranges (same ranges as L-31).
L-44 (warning, citation-identifier, line 94): Identifier 'PHASE_ORDER' is absent from the cited ranges (same ranges as L-31).
L-45 (warning, citation-identifier, line 99): Identifier 'buildModel' is absent from the cited ranges (src/watch/ledger.ts:250-291, :200-202).
L-46 (warning, citation-identifier, line 103): Identifier 'harnessHandler' is absent from the cited ranges (src/tools/harness.ts:46, :49-52, :95, :109-120, :29-40, ...).
L-47 (warning, citation-identifier, line 103): Identifier 'compareSpecName' is absent from the cited ranges (same ranges as L-46).
L-48 (warning, citation-identifier, line 103): Identifier 'compare' is absent from the cited ranges (same ranges as L-46).
L-49 (warning, citation-identifier, line 103): Identifier 'delta' is absent from the cited ranges (same ranges as L-46).
L-50 (warning, citation-identifier, line 104): Identifier 'buildUsageReport' is absent from the cited ranges (src/types.ts:218-222).
L-51 (warning, citation-identifier, line 104): Identifier 'usageDelta' is absent from the cited ranges (src/types.ts:218-222).
L-52 (warning, citation-identifier, line 104): Identifier 'formatUsageTable' is absent from the cited ranges (src/types.ts:218-222).
L-53 (info, citation-bare, line 105): Bare range `:658-683` has no earlier path citation in its block.
L-54 (warning, citation-identifier, line 115): Identifier 'slot' is absent from the cited ranges (docs/TOOLS-REFERENCE.md:551-570).
L-55 (warning, citation-identifier, line 115): Identifier 'payload' is absent from the cited ranges (docs/TOOLS-REFERENCE.md:551-570).
L-56 (warning, citation-identifier, line 115): Identifier 'compareSpecName' is absent from the cited ranges (docs/TOOLS-REFERENCE.md:551-570).
L-57 (warning, citation-identifier, line 115): Identifier 'gate' is absent from the cited ranges (docs/TOOLS-REFERENCE.md:551-570).
L-58 (warning, citation-identifier, line 115): Identifier 'usage' is absent from the cited ranges (docs/TOOLS-REFERENCE.md:551-570).
L-59 (warning, citation-identifier, line 115): Identifier 'unknown' is absent from the cited ranges (docs/TOOLS-REFERENCE.md:551-570).
L-60 (warning, citation-identifier, line 116): Identifier 'SubagentStop' is absent from the cited ranges (docs/SDD-HARNESS.md:284-298, :325-328).
L-61 (warning, citation-identifier, line 125): Identifier 'usage' is absent from the cited ranges (src/watch/ledger.ts:200-202, src/watch/render.ts:100-114).
L-62 (warning, citation-identifier, line 137): Identifier 'assistant' is absent from the cited ranges (src/watch/ledger.ts:14-20).
L-63 (warning, citation-identifier, line 137): Identifier 'model' is absent from the cited ranges (src/watch/ledger.ts:14-20).
L-64 (warning, citation-identifier, line 165): Identifier 'readUsage' is absent from the cited ranges (harness/hooks/sdd-activity.sh:35, :88, :69, :84).
L-65 (warning, citation-identifier, line 168): Identifier 'usage' is absent from the cited ranges (src/tools/harness.ts:664-670, src/core/path-utils.ts:190-194).
L-66 (warning, citation-identifier, line 168): Identifier 'compareSpecName' is absent from the cited ranges (src/tools/harness.ts:664-670, src/core/path-utils.ts:190-194).
L-67 (warning, citation-identifier, line 168): Identifier 'safeJoin' is absent from the cited ranges (src/tools/harness.ts:664-670, src/core/path-utils.ts:190-194).
L-68 (warning, citation-identifier, line 170): Identifier 'start' is absent from the cited ranges (src/watch/ledger.ts:183-186, :230).
L-69 (warning, citation-identifier, line 170): Identifier 'buildModel' is absent from the cited ranges (src/watch/ledger.ts:183-186, :230).
L-70 (info, citation-bare, line 175): Bare range `:13` has no earlier path citation in its block.
L-71 (info, citation-bare, line 175): Bare range `:36-41` has no earlier path citation in its block.
L-72 (info, citation-bare, line 175): Bare range `:110-116` has no earlier path citation in its block.
L-73 (info, citation-bare, line 175): Bare range `:9-11` has no earlier path citation in its block.
L-74 (info, citation-bare, line 176): Bare range `:169-226` has no earlier path citation in its block.
L-75 (info, citation-bare, line 177): Bare range `:53` has no earlier path citation in its block.
L-76 (info, citation-bare, line 177): Bare range `:56` has no earlier path citation in its block.
L-77 (info, citation-bare, line 178): Bare range `:12-29` has no earlier path citation in its block.
L-78 (info, citation-bare, line 178): Bare range `:248-253` has no earlier path citation in its block.
L-79 (warning, citation-identifier, line 179): Identifier 'model' is absent from the cited ranges (.github/workflows/ci.yml:30).
L-80 (warning, citation-identifier, line 179): Identifier 'effort' is absent from the cited ranges (.github/workflows/ci.yml:30).
L-81 (warning, citation-identifier, line 182): Identifier 'agentId' is absent from the cited ranges (src/__tests__/hook-spawn-events.test.ts:21-30).
L-82 (warning, citation-identifier, line 182): Identifier 'jsonl' is absent from the cited ranges (src/__tests__/hook-spawn-events.test.ts:21-30).
L-83 (warning, citation-identifier, line 183): Identifier 'jsonl' is absent from the cited ranges (scripts/dev-link.sh:21).
L-84 (warning, citation-identifier, line 183): Identifier 'SubagentStop' is absent from the cited ranges (scripts/dev-link.sh:21).
L-85 (warning, citation-identifier, line 183): Identifier 'verification' is absent from the cited ranges (scripts/dev-link.sh:21).
L-86 (error, citation-path, line 192): Cited path `render.ts` has no directory prefix; cite it by its path from the code root (for example `dir/render.ts`).
L-87 (warning, citation-identifier, line 200): Identifier 'usage' is absent from the cited ranges (src/tools/harness.ts:673-683).

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with
   one line of reasoning. Never accept to be agreeable; never reject to save work. When a
   finding says a rationale clause is false, delete the clause unless you can prove the
   replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under
   `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated
   artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what the requirements pinned.
4. Edit v1 in place. Add no version line. Append under the v1 Revision History line one
   nested bullet: `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, …>`.
5. Closed by ruling, leave as is: none.
6. MDX rule: no bare angle brackets outside code spans.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file
   belong to others. You may replace a context-file line that an accepted finding
   refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same
   construct (the same rule table, command, fixture shape or union member) and fix each;
   list them under the finding's bullet. A sibling left unchanged is next round's finding.
10. Every citation you insert or change carries its filename (`typecheck.ts:30`), never a
    bare `:<line>`. A bare `:<line>` token outside a code block is itself a finding to
    fix, so a later pass cannot re-resolve it to the wrong file. The two `citation-path`
    errors (L-3, L-86) and the `citation-bare` findings all fall under this rule: give
    each cited range its full path from the code root.
11. A citation-identifier warning on a token that is unchanged since a version where it
    was rejected with a reason is suppressed, not re-fired. Many `citation-identifier`
    warnings name a symbol the prose describes conceptually rather than one meant to be
    literally inside the cited range; reject those with that reason, or repoint the
    citation to the range where the symbol truly lives.
