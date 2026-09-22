# Lint brief — provider-per-role design v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/design.md` in place, then report in 150 words or fewer: files touched; each finding as `<id>: accepted | partially accepted | rejected`; citations verified (count); the document's word count; flags. No file contents.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: the design.md above (v1). Cap: 4,000 words. Do not grow the document past it; a fix that adds a paragraph removes one.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/requirements.md`.
- Findings: the list under `## Revision input`.

## Revision input
L-1 (warning, citation-identifier, line 5): Identifier 'provider' absent from cited ranges (harness/skills/sdd-continue/references/formats.md:170-182, harness/hooks/sdd-activity.sh:37-49, harness/skills/sdd-continue/references/harness-source...).
L-2 (warning, citation-identifier, line 45): Identifier 'PROVIDERS' absent from cited ranges (harness/skills/sdd-continue/SKILL.md ranges).
L-3 (warning, citation-identifier, line 45): Identifier 'LAUNCHER' absent (same ranges).
L-4 (warning, citation-identifier, line 45): Identifier 'providers' absent (same ranges).
L-5 (warning, citation-identifier, line 45): Identifier 'provider' absent (same ranges).
L-6 (warning, citation-identifier, line 45): Identifier 'effort' absent (same ranges).
L-7 (warning, citation-identifier, line 53): Identifier 'ALIAS' absent (.spec-workflow/spec-decomposition/decomposition.md:255-258, harness/agents/sdd-reviewer.md:7-12).
L-8 (warning, citation-identifier, line 53): Identifier 'ROLE' absent (same ranges).
L-9 (warning, citation-identifier, line 53): Identifier 'AGENT' absent (same ranges).
L-10 (warning, citation-identifier, line 53): Identifier 'TOOLS' absent (same ranges).
L-11 (warning, citation-identifier, line 53): Identifier 'MCP_TOOLS' absent (same ranges).
L-12 (warning, citation-identifier, line 53): Identifier 'mcp__' absent (same ranges).
L-13 (warning, citation-identifier, line 55): Identifier 'SID' absent (harness/hooks/sdd-activity.sh:11-12, harness/hooks/hooks.json:4-36, scripts/dev-link.sh:47-64).
L-14 (warning, citation-identifier, line 58): Identifier 'CFG' absent (harness/skills/sdd-continue/references/harness-source.sh:21, harness/hooks/sdd-activity.sh:37-49, harness/hooks/sdd-activity.sh:114-123).
L-15 (warning, citation-identifier, line 58): Identifier 'SLUG' absent (same ranges).
L-16 (warning, citation-identifier, line 58): Identifier 'SDD_CODE_ROOT' absent (same ranges).
L-17 (warning, citation-identifier, line 58): Identifier 'jsonl' absent (same ranges).
L-18 (warning, citation-identifier, line 65): Identifier 'PROVIDERS' absent (harness/skills/sdd-document-phase/SKILL.md ranges).
L-19 (warning, citation-identifier, line 65): Identifier 'LAUNCHER' absent (same ranges).
L-20 (warning, citation-identifier, line 65): Identifier 'deepseek' absent (same ranges).
L-21 (warning, citation-identifier, line 71): Identifier 'provider' absent (src/watch/usage.ts ranges).
L-22 (warning, citation-identifier, line 71): Identifier 'anthropic' absent (same ranges).
L-23 (warning, citation-identifier, line 71): Identifier 'AGENT' absent (same ranges).
L-24 (warning, citation-identifier, line 77): Identifier 'provider' absent (src/watch/ledger.ts ranges).
L-25 (warning, citation-identifier, line 77): Identifier 'providers' absent (same ranges).
L-26 (warning, citation-identifier, line 77): Identifier 'none' absent (same ranges).
L-27 (warning, citation-identifier, line 77): Identifier 'anthropic' absent (same ranges).
L-28 (warning, citation-identifier, line 77): Identifier 'MODEL' absent (same ranges).
L-29 (warning, citation-identifier, line 83): Identifier 'escalation' absent (harness/skills/sdd-document-phase/references/briefs.md:125-176, harness/agents/sdd-reviser.md:7-16, docs/step-0-answers.md:1-17, ...).
L-30 (warning, citation-identifier, line 135): Identifier 'SDD_SPEC_STORE_REPO' absent (docs/SDD-HARNESS.md:244).
L-31 (warning, citation-identifier, line 135): Identifier 'SDD_CODE_ROOT' absent (docs/SDD-HARNESS.md:244).
L-32 (warning, citation-identifier, line 135): Identifier 'MCP_TOOLS' absent (docs/SDD-HARNESS.md:244).
L-33 (warning, citation-identifier, line 135): Identifier 'ANTHROPIC_API_KEY' absent (docs/SDD-HARNESS.md:244).
L-34 (info, citation-bare, line 183): Bare range `:42-73` has no earlier path citation in its block.
L-35 (info, citation-bare, line 183): Bare range `:263-267` has no earlier path citation in its block.
L-36 (info, citation-bare, line 183): Bare range `:270-283` has no earlier path citation in its block.
L-37 (info, citation-bare, line 183): Bare range `:251-263` has no earlier path citation in its block.
L-38 (info, citation-bare, line 183): Bare range `:122-132` has no earlier path citation in its block.
L-39 (warning, citation-identifier, line 183): Identifier 'start' absent (src/watch/__tests__/index.test.ts:82-94).
L-40 (warning, citation-identifier, line 183): Identifier 'anthropic' absent (same range).
L-41 (warning, citation-identifier, line 183): Identifier 'providers' absent (same range).
L-42 (warning, citation-identifier, line 183): Identifier 'spawns' absent (same range).
L-43 (warning, citation-identifier, line 183): Identifier 'provider' absent (same range).
L-44 (warning, citation-identifier, line 183): Identifier 'tokensByProvider' absent (same range).
L-45 (warning, citation-identifier, line 183): Identifier 'tokensTotal' absent (same range).
L-46 (warning, citation-identifier, line 183): Identifier 'deepseek' absent (same range).
L-47 (ERROR, citation-range, line 183): Cited range src/watch/__tests__/index.test.ts:519-530 is out of bounds (file has 95 lines). MUST fix — cite a real range or drop it.
L-48 (warning, citation-identifier, line 184): Identifier 'DEEPSEEK_API_KEY' absent (src/__tests__/hook-spawn-events.test.ts:36-41, :58-94, .spec-workflow/agent-rules.md:30-32).
L-49 (warning, citation-identifier, line 184): Identifier 'none' absent (same ranges).
L-50 (warning, citation-identifier, line 184): Identifier 'PATH' absent (same ranges).
L-51 (warning, citation-identifier, line 184): Identifier 'CLAUDE_CONFIG_DIR' absent (same ranges).
L-52 (warning, citation-identifier, line 184): Identifier 'start' absent (same ranges).
L-53 (warning, citation-identifier, line 184): Identifier 'ANTHROPIC_API_KEY' absent (same ranges).
L-54 (warning, citation-identifier, line 184): Identifier 'ANTHROPIC_MODEL' absent (same ranges).
L-55 (warning, citation-identifier, line 184): Identifier 'status' absent (same ranges).
L-56 (warning, citation-identifier, line 184): Identifier 'stdout' absent (same ranges).
L-57 (warning, citation-identifier, line 184): Identifier 'existsSync' absent (same ranges).
L-58 (warning, citation-identifier, line 185): Identifier 'model' absent (harness/skills/sdd-implementation-phase/SKILL.md:201-205).
L-59 (warning, citation-identifier, line 185): Identifier 'anthropic' absent (same range).
L-60 (warning, citation-identifier, line 185): Identifier 'provider' absent (same range).
L-61 (warning, citation-identifier, line 185): Identifier 'providers' absent (same range).
L-62 (warning, citation-identifier, line 185): Identifier 'deepseek' absent (same range).
L-63 (warning, citation-identifier, line 185): Identifier 'verification' absent (same range).
L-64 (warning, citation-identifier, line 213): Identifier 'providers' absent (src/watch/__tests__/usage.test.ts:266).

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one line of reasoning. Never accept to be agreeable; never reject to save work. When a finding says a rationale clause is false, delete the clause unless you can prove the replacement with a probe.
2. Verify every citation you add or change against the real tree under `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated artifact is a MUST_FIX next round. L-47 is the error: the cited range does not exist in the file — correct it to the real range in `src/watch/__tests__/index.test.ts` (95 lines) or drop the citation.
3. Do not widen scope, and do not re-decide what an earlier phase pinned.
4. Edit v1 in place. Add no version line. Append under the v1 Revision History line one nested bullet: `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, …>`.
5. Closed by ruling, leave as is: none.
6. MDX rule: no bare angle brackets outside code spans.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file belong to others. You may replace a context-file line that an accepted finding refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same construct (the same rule table, command, fixture shape or union member) and fix each; list them under the finding's bullet.
10. Every citation you insert or change carries its filename, never a bare `:<line>`. A bare `:<line>` token outside a code block is itself a finding to fix (see L-34..L-38).
11. A citation-identifier warning on a token that is unchanged since a version where it was rejected with a reason is suppressed, not re-fired. (No prior version here; judge each on merits — many identifier warnings fire on prose words like 'provider', 'none', 'start' that legitimately are not literal tokens in the cited range. Reject those with a one-line reason; fix any that point at a genuinely wrong citation.)
