# Lint brief — eval-gate-runs design v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/eval-gate-runs/design.md` in place.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/eval-gate-runs/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/eval-gate-runs/design.md` (v1). Cap: 4,000 words. Do not grow the document past it; a fix that adds a paragraph removes one.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/eval-gate-runs/requirements.md`.
- Findings: the list under `## Revision input`.
- Prior dispositions: a version's lint pass receives the prior version's dispositioned findings (each token, its disposition and reason).

## Revision input
L-1 (warning, citation-identifier, line 38): Identifier 'role' is absent from the cited ranges (src/evals/select.ts:131, src/evals/select.ts:153, src/evals/select.ts:200)
L-2 (warning, citation-identifier, line 38): Identifier 'profile' is absent from the cited ranges (src/evals/select.ts:131, src/evals/select.ts:153, src/evals/select.ts:200)
L-3 (warning, citation-identifier, line 40): Identifier 'selectCases' is absent from the cited ranges (src/evals/select.ts:204)
L-4 (warning, citation-identifier, line 41): Identifier 'selectCases' is absent from the cited ranges (src/evals/select.ts:19-23)
L-5 (warning, citation-identifier, line 47): Identifier 'runCases' is absent from the cited ranges (src/evals/runner.ts:42-49)
L-6 (warning, citation-identifier, line 50): Identifier 'runsByCase' is absent from the cited ranges (src/evals/runner.ts:160, src/evals/runner.ts:144)
L-7 (warning, citation-identifier, line 58): Identifier 'RunGateResult' is absent from the cited ranges (src/evals/gate.ts:8-18)
L-8 (warning, citation-identifier, line 60): Identifier 'runGate' is absent from the cited ranges (src/evals/gate.ts:56-58)
L-9 (warning, citation-identifier, line 60): Identifier 'runsByCase' is absent from the cited ranges (src/evals/gate.ts:56-58)
L-10 (warning, citation-identifier, line 60): Identifier 'plannedRuns' is absent from the cited ranges (src/evals/gate.ts:56-58)
L-11 (warning, citation-identifier, line 60): Identifier 'onLine' is absent from the cited ranges (src/evals/gate.ts:56-58)
L-12 (warning, citation-identifier, line 61): Identifier 'pass' is absent from the cited ranges (src/evals/gate.ts:76)
L-13 (warning, citation-identifier, line 61): Identifier 'length' is absent from the cited ranges (src/evals/gate.ts:76)
L-14 (warning, citation-identifier, line 62): Identifier 'length' is absent from the cited ranges (src/evals/gate.ts:96)
L-15 (warning, citation-identifier, line 63): Identifier 'revisitTrigger' is absent from the cited ranges (src/evals/gate.ts:45-49, src/evals/gate.ts:66-72, src/evals/gate.ts:74)
L-16 (warning, citation-identifier, line 71): Identifier 'runRun' is absent from the cited ranges (src/evals/cli.ts:171-187, src/evals/cli.ts:141)
L-17 (warning, citation-identifier, line 72): Identifier 'plannedRuns' is absent from the cited ranges (src/evals/cli.ts:151-169)
L-18 (warning, citation-identifier, line 91): Identifier 'grader' is absent from the cited ranges (docs/SDD-HARNESS.md:510-511)
L-19 (warning, citation-identifier, line 91): Identifier 'profile' is absent from the cited ranges (docs/SDD-HARNESS.md:510-511)
L-20 (warning, citation-identifier, line 96): Identifier 'SelectedCase' is absent from the cited ranges (src/evals/runner.ts:18-40)
L-21 (warning, citation-identifier, line 98): Identifier 'EvalResultRecord' is absent from the cited ranges (src/evals/gate.ts:66-81, src/evals/cli.ts:148)
L-22 (warning, citation-identifier, line 98): Identifier 'EvalCaseRecord' is absent from the cited ranges (src/evals/gate.ts:66-81, src/evals/cli.ts:148)
L-23 (warning, citation-identifier, line 98): Identifier 'select' is absent from the cited ranges (src/evals/gate.ts:66-81, src/evals/cli.ts:148)
L-24 (warning, citation-identifier, line 125): Identifier 'runsByCase' is absent from the cited ranges (src/evals/__tests__/runner.test.ts:378-394, src/evals/__tests__/runner.test.ts:200, src/evals/__tests__/runner.test.ts:242)
L-25 (warning, citation-identifier, line 127): Identifier 'target' is absent from the cited ranges (src/evals/__tests__/gate.test.ts:87-110, src/evals/__tests__/gate.test.ts:160-174)
L-26 (warning, citation-identifier, line 127): Identifier 'step' is absent from the cited ranges (src/evals/__tests__/gate.test.ts:87-110, src/evals/__tests__/gate.test.ts:160-174)
L-27 (warning, citation-identifier, line 127): Identifier 'logPath' is absent from the cited ranges (src/evals/__tests__/gate.test.ts:87-110, src/evals/__tests__/gate.test.ts:160-174)
L-28 (warning, citation-identifier, line 135): Identifier 'select' is absent from the cited ranges (scripts/stub-claude.mjs:62-72)
L-29 (warning, citation-identifier, line 135): Identifier 'gate' is absent from the cited ranges (scripts/stub-claude.mjs:62-72)
L-30 (warning, citation-identifier, line 137): Identifier 'counter' is absent from the cited ranges (scripts/sdd-self-update.sh:176-178)
L-31 (warning, citation-identifier, line 138): Identifier 'dist' is absent from the cited ranges (src/evals/cli.ts:208-215)
L-32 (warning, citation-identifier, line 138): Identifier 'type' is absent from the cited ranges (src/evals/cli.ts:208-215)
L-33 (warning, citation-identifier, line 140): Identifier 'type' is absent from the cited ranges (src/__tests__/service-scripts.test.ts:74-76)
L-34 (warning, citation-identifier, line 140): Identifier 'createWait' is absent from the cited ranges (src/__tests__/service-scripts.test.ts:74-76)
L-35 (warning, citation-identifier, line 140): Identifier 'import' is absent from the cited ranges (src/__tests__/service-scripts.test.ts:74-76)

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one line of reasoning. Never accept to be agreeable; never reject to save work. When a finding says a rationale clause is false, delete the clause unless you can prove the replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under `<CODE_ROOT>`. Read both ends of a line range. A misstated artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what an earlier phase pinned.
4. Edit v1 in place. Add no version line. Append under the v1 Revision History line one nested bullet: `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, …>`.
5. Closed by ruling, leave as is: none.
6. MDX rule: no bare angle brackets outside code spans. tasks.md: keep the template's task shape; every task numbered; `_Prompt: …_` ends with `_`.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file belong to others. You may replace a context-file line that an accepted finding refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same construct (the same rule table, command, fixture shape or union member) and fix each; list them under the finding's bullet. A sibling left unchanged is next round's finding.
10. Every citation you insert or change carries its directory-prefixed path (`src/core/typecheck.ts:30`), never a bare filename (`typecheck.ts:30`) or a bare `:<line>`. A citation that lacks a directory prefix, or a bare `:<line>` token, outside a code block is itself a finding to reject or repair before you hand off, so a later pass cannot re-resolve it to the wrong file (retro P6).
11. A citation-identifier warning on a token that is unchanged since a version where it was rejected with a reason is suppressed, not re-fired.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- version:
- words:
- accepted:
- partial:
- rejected:
- cut-scope:
- flags:
