# Lint brief — provider-per-role requirements v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/requirements.md` in place, then report in 150 words or fewer: files touched; each finding as `<id>: accepted | partially accepted | rejected`; citations verified (count); the document's word count; flags. No file contents.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/codebase-context.md`. Read it first; it maps the code the document cites. (graphify-out/graph.json exists: prefer `graphify query`/`graphify explain` to orient before reading source files.)
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/requirements.md` (v1). Cap: 3,500 words (body only). Do not grow the document past it; a fix that adds a paragraph removes one.
- All findings are `citation-identifier` warnings: the identifier named is absent from the cited range. Either the citation should point at a range where the identifier actually appears (fix the range), or the sentence should not claim that token lives in existing code (reword so the citation supports only what the range shows, or drop the backticked identifier). A token that names a to-be-built artifact legitimately does not exist in the current tree: fix by rewording so it reads as prose, not a claim that it is present at that path. Verify every citation you add or change against the real tree, both ends of the range.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one line of reasoning. When a finding says a rationale clause is false, delete the clause unless you can prove the replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range.
3. Do not widen scope, and do not re-decide what an earlier phase pinned.
4. Edit v1 in place. Add no version line. Append under the v1 Revision History line one nested bullet: `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, ...>`.
5. Closed by ruling, leave as is: none.
6. MDX rule: no bare angle brackets outside code spans. Acceptance criteria stay EARS-form.
7. Edit only the document. You may replace a context-file line that an accepted finding refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same construct and fix each; list them under the finding's bullet.
10. Every citation you insert or change carries its filename (`usage.ts:76`), never a bare `:<line>`.
11. A citation-identifier warning on a token unchanged since a version where it was rejected is suppressed, not re-fired (no prior version here).

## Findings
L-1 (warning, citation-identifier, line 20): Identifier 'deepseek' is absent from the cited ranges (harness/agents/sdd-reviewer.md:7-12, harness/agents/sdd-checker.md:7-12)
L-2 (warning, citation-identifier, line 22): Identifier 'start' is absent from the cited ranges (harness/skills/sdd-continue/SKILL.md:71-72)
L-3 (warning, citation-identifier, line 33): Identifier 'deepseek' is absent from the cited ranges (harness/skills/sdd-continue/SKILL.md:76-86)
L-4 (warning, citation-identifier, line 33): Identifier 'LAUNCHER' is absent from the cited ranges (harness/skills/sdd-continue/SKILL.md:76-86)
L-5 (warning, citation-identifier, line 35): Identifier 'PROVIDERS' is absent from the cited ranges (harness/skills/sdd-document-phase/SKILL.md:160-161)
L-6 (warning, citation-identifier, line 35): Identifier 'deepseek' is absent from the cited ranges (harness/skills/sdd-document-phase/SKILL.md:160-161)
L-7 (warning, citation-identifier, line 37): Identifier 'tools' is absent from the cited ranges (harness/agent-profiles.json:47-51)
L-8 (warning, citation-identifier, line 42): Identifier 'LAUNCHER' is absent from the cited ranges (harness/agents/sdd-document-orchestrator.md:50, harness/skills/sdd-document-phase/SKILL.md:23-27)
L-9 (warning, citation-identifier, line 42): Identifier 'PROVIDERS' is absent from the cited ranges (harness/agents/sdd-document-orchestrator.md:50, harness/skills/sdd-document-phase/SKILL.md:23-27)
L-10 (warning, citation-identifier, line 42): Identifier 'deepseek' is absent from the cited ranges (harness/agents/sdd-document-orchestrator.md:50, harness/skills/sdd-document-phase/SKILL.md:23-27)
L-11 (warning, citation-identifier, line 51): Identifier 'start' is absent from the cited ranges (.spec-workflow/specs/harness-usage-and-tiers/harness-events.jsonl:105)
L-12 (warning, citation-identifier, line 51): Identifier 'jsonl' is absent from the cited ranges (.spec-workflow/specs/harness-usage-and-tiers/harness-events.jsonl:105)
L-13 (warning, citation-identifier, line 54): Identifier 'start' is absent from the cited ranges (harness/skills/sdd-continue/references/formats.md:163-182, harness/hooks/sdd-activity.sh:14-17)
L-14 (warning, citation-identifier, line 56): Identifier 'provider' is absent from the cited ranges (harness/skills/sdd-continue/references/formats.md:186-198)
L-15 (warning, citation-identifier, line 56): Identifier 'effort' is absent from the cited ranges (harness/skills/sdd-continue/references/formats.md:186-198)
L-16 (warning, citation-identifier, line 56): Identifier 'providers' is absent from the cited ranges (harness/skills/sdd-continue/references/formats.md:186-198)
L-17 (warning, citation-identifier, line 76): Identifier 'provider' is absent from the cited ranges (src/watch/usage.ts:76-216)
L-18 (warning, citation-identifier, line 76): Identifier 'anthropic' is absent from the cited ranges (src/watch/usage.ts:76-216)
L-19 (warning, citation-identifier, line 78): Identifier 'anthropic' is absent from the cited ranges (src/watch/usage.ts:253-298)
L-20 (warning, citation-identifier, line 79): Identifier 'provider' is absent from the cited ranges (src/__tests__/fixtures/usage-ledger.jsonl:1-20)
L-21 (warning, citation-identifier, line 79): Identifier 'deepseek' is absent from the cited ranges (src/__tests__/fixtures/usage-ledger.jsonl:1-20)
L-22 (warning, citation-identifier, line 79): Identifier 'report' is absent from the cited ranges (src/__tests__/fixtures/usage-ledger.jsonl:1-20)
L-23 (warning, citation-identifier, line 80): Identifier 'provider' is absent from the cited ranges (src/watch/ledger.ts:94-114, src/watch/ledger.ts:142-163, src/watch/render.ts:67-79, src/watch/render.ts:204-211)
L-24 (warning, citation-identifier, line 92): Identifier 'model' is absent from the cited ranges (harness/skills/sdd-document-phase/references/briefs.md:125-176, harness/skills/sdd-continue/references/formats.md:5-17)
