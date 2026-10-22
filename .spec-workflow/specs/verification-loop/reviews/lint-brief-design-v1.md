# Lint brief — verification-loop design v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/design.md` in place.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/design.md` (v1). Cap: 4,000 words. Do not grow the document past it; a fix that adds a paragraph removes one.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/requirements.md`.
- Findings: the list under `## Revision input`.
- Prior dispositions: a version's lint pass receives the prior version's dispositioned findings (each token, its disposition and reason).

## Revision input
L-1 (warning, citation-identifier, line 47): Identifier 'check' is absent from the cited ranges (src/controller/merge.ts:357-405)
L-2 (warning, citation-identifier, line 47): Identifier 'runId' is absent from the cited ranges (src/controller/merge.ts:357-405)
L-3 (warning, citation-identifier, line 47): Identifier 'conflict' is absent from the cited ranges (src/controller/merge.ts:357-405)
L-4 (warning, citation-identifier, line 47): Identifier 'other' is absent from the cited ranges (src/controller/merge.ts:357-405)
L-5 (warning, citation-identifier, line 48): Identifier 'baseRefName' is absent from the cited ranges (src/controller/merge.ts:38-39, src/controller/merge.ts:319-412, src/controller/merge.ts:568-642)
L-6 (warning, citation-identifier, line 57): Identifier 'stdout' is absent from the cited ranges (src/controller/merge.ts:459-465)
L-7 (warning, citation-identifier, line 69): Identifier 'check' is absent from the cited ranges (src/controller/phases/implementation.ts:1117-1126)
L-8 (warning, citation-identifier, line 71): Identifier 'worktree' is absent from the cited ranges (src/controller/phases/implementation.ts:371-381)
L-9 (warning, citation-identifier, line 71): Identifier 'IMPLEMENTER_SCHEMA' is absent from the cited ranges (src/controller/phases/implementation.ts:371-381)
L-10 (warning, citation-identifier, line 71): Identifier 'runModelStep' is absent from the cited ranges (src/controller/phases/implementation.ts:371-381)
L-11 (warning, citation-identifier, line 73): Identifier 'mergeFixHistory' is absent from the cited ranges (src/controller/runs.ts:669-682, src/controller/runs.ts:750-771)
L-12 (warning, citation-identifier, line 73): Identifier 'mergeFixEligible' is absent from the cited ranges (src/controller/runs.ts:669-682, src/controller/runs.ts:750-771)
L-13 (warning, citation-identifier, line 73): Identifier 'isCancelled' is absent from the cited ranges (src/controller/runs.ts:669-682, src/controller/runs.ts:750-771)
L-14 (warning, citation-identifier, line 73): Identifier 'windowBlock' is absent from the cited ranges (src/controller/runs.ts:669-682, src/controller/runs.ts:750-771)
L-15 (warning, citation-identifier, line 73): Identifier 'runOnce' is absent from the cited ranges (src/controller/runs.ts:669-682, src/controller/runs.ts:750-771)
L-16 (warning, citation-identifier, line 73): Identifier 'runCloseoutMergeStep' is absent from the cited ranges (src/controller/runs.ts:669-682, src/controller/runs.ts:750-771)
L-17 (info, citation-bare, line 78): Bare range `:713-750` has no earlier path citation in its block
L-18 (info, citation-bare, line 78): Bare range `:1553-1557` has no earlier path citation in its block
L-19 (info, citation-bare, line 79): Bare range `:682-705` has no earlier path citation in its block
L-20 (info, citation-bare, line 81): Bare range `:833-848` has no earlier path citation in its block
L-21 (warning, citation-identifier, line 81): Identifier 'renderVerifier' is absent from the cited ranges (src/controller/phases/implementation.ts:961-963)
L-22 (warning, citation-identifier, line 81): Identifier 'security' is absent from the cited ranges (src/controller/phases/implementation.ts:961-963)
L-23 (warning, citation-identifier, line 81): Identifier 'renderVerifierSecurity' is absent from the cited ranges (src/controller/phases/implementation.ts:961-963)
L-24 (warning, citation-identifier, line 87): Identifier 'reason' is absent from the cited ranges (harness/agent-profiles.json:50-55, src/controller/step.ts:229-242)
L-25 (warning, citation-identifier, line 87): Identifier 'null' is absent from the cited ranges (harness/agent-profiles.json:50-55, src/controller/step.ts:229-242)
L-26 (warning, citation-identifier, line 87): Identifier 'keyword' is absent from the cited ranges (harness/agent-profiles.json:50-55, src/controller/step.ts:229-242)
L-27 (warning, citation-identifier, line 89): Identifier 'classAItems' is absent from the cited ranges (src/controller/phases/gates.ts:291-294, src/core/veto-rules.ts:65-101)
L-28 (warning, citation-identifier, line 90): Identifier 'runModelStep' is absent from the cited ranges (src/controller/step.ts:108-111)
L-29 (warning, citation-identifier, line 90): Identifier 'loadRole' is absent from the cited ranges (src/controller/step.ts:108-111)
L-30 (warning, citation-identifier, line 90): Identifier 'start' is absent from the cited ranges (src/controller/step.ts:108-111)
L-31 (warning, citation-identifier, line 107): Identifier 'pass' is absent from the cited ranges (src/core/gate-rules.ts:158-160)
L-32 (warning, citation-identifier, line 107): Identifier 'security' is absent from the cited ranges (src/core/gate-rules.ts:158-160)
L-33 (warning, citation-identifier, line 107): Identifier 'main' is absent from the cited ranges (src/core/gate-rules.ts:158-160)
L-34 (warning, citation-identifier, line 107): Identifier 'master' is absent from the cited ranges (src/core/gate-rules.ts:158-160)
L-35 (warning, citation-identifier, line 120): Identifier 'security' is absent from the cited ranges (src/controller/runs.ts:1015-1056)
L-36 (warning, citation-identifier, line 121): Identifier 'securityAnswers' is absent from the cited ranges (src/controller/runs.ts:859-867)
L-37 (warning, citation-identifier, line 121): Identifier 'security' is absent from the cited ranges (src/controller/runs.ts:859-867)
L-38 (warning, citation-identifier, line 121): Identifier 'runOnce' is absent from the cited ranges (src/controller/runs.ts:859-867)
L-39 (warning, citation-identifier, line 122): Identifier 'security' is absent from the cited ranges (src/controller/runs.ts:997-1008)
L-40 (warning, citation-identifier, line 122): Identifier 'accept' is absent from the cited ranges (src/controller/runs.ts:997-1008)
L-41 (warning, citation-identifier, line 127): Identifier 'pending' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/RunPage.tsx:345-394)
L-42 (warning, citation-identifier, line 173): Identifier 'base' is absent from the cited ranges (src/controller/__tests__/merge.test.ts:172, src/controller/__tests__/merge.test.ts:255, src/controller/__tests__/merge.test.ts:471, src/controller/__
L-43 (warning, citation-identifier, line 173): Identifier 'head' is absent from the cited ranges (src/controller/__tests__/merge.test.ts:172, src/controller/__tests__/merge.test.ts:255, src/controller/__tests__/merge.test.ts:471, src/controller/__
L-44 (warning, citation-identifier, line 173): Identifier 'newDependencies' is absent from the cited ranges (src/controller/__tests__/merge.test.ts:172, src/controller/__tests__/merge.test.ts:255, src/controller/__tests__/merge.test.ts:471, src/co
L-45 (warning, citation-identifier, line 179): Identifier 'newDependencies' is absent from the cited ranges (e2e/worktree-shell.spec.ts:163-170)

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
