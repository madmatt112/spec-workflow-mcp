# Lint brief — project-bootstrap design v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/design.md` in place.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/design.md` (v1). Cap: 4,000 words. Do not grow the document past it; a fix that adds a paragraph removes one.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/project-bootstrap/requirements.md`.
- Findings: the list under `## Revision input`.
- Prior dispositions: a version's lint pass receives the prior version's dispositioned findings (each token, its disposition and reason).

## Revision input
L-1 (warning, citation-identifier, line 20): Identifier 'main' is absent from the cited ranges (src/index.ts:378-384, src/index.ts:143-156)
L-2 (warning, citation-identifier, line 20): Identifier 'bootstrapCommand' is absent from the cited ranges (src/index.ts:378-384, src/index.ts:143-156)
L-3 (warning, citation-identifier, line 20): Identifier 'runBootstrapCommand' is absent from the cited ranges (src/index.ts:378-384, src/index.ts:143-156)
L-4 (warning, citation-identifier, line 20): Identifier 'parseArguments' is absent from the cited ranges (src/index.ts:378-384, src/index.ts:143-156)
L-5 (warning, citation-identifier, line 20): Identifier 'addProjectByPath' is absent from the cited ranges (src/index.ts:378-384, src/index.ts:143-156)
L-6 (warning, citation-identifier, line 75): Identifier 'top' is absent from the cited ranges (src/core/git-utils.ts:101-112)
L-7 (warning, citation-identifier, line 109): Identifier 'registered' is absent from the cited ranges (src/controller/state.ts:425-427)
L-8 (warning, citation-identifier, line 110): Identifier 'remote' is absent from the cited ranges (src/core/git-utils.ts:45-51)
L-9 (warning, citation-identifier, line 110): Identifier 'top' is absent from the cited ranges (src/core/git-utils.ts:45-51)
L-10 (warning, citation-identifier, line 111): Identifier 'serviceEnv' is absent from the cited ranges (scripts/sdd-service.sh:136-147)
L-11 (warning, citation-identifier, line 121): Identifier 'readAgentRules' is absent from the cited ranges (src/core/workspace-initializer.ts:52-57, scripts/sync-store-templates.cjs:34-37)
L-12 (warning, citation-identifier, line 121): Identifier 'parseAgentRuleKey' is absent from the cited ranges (src/core/workspace-initializer.ts:52-57, scripts/sync-store-templates.cjs:34-37)
L-13 (warning, citation-identifier, line 121): Identifier 'WorkspaceInitializer' is absent from the cited ranges (src/core/workspace-initializer.ts:52-57, scripts/sync-store-templates.cjs:34-37)
L-14 (warning, citation-identifier, line 129): Identifier 'projectId' is absent from the cited ranges (src/dashboard/utils.ts:71-73)
L-15 (warning, citation-identifier, line 132): Identifier 'workflowRootPath' is absent from the cited ranges (src/dashboard/multi-server.ts:453-464)
L-16 (warning, citation-identifier, line 135): Identifier 'resolveGitRoot' is absent from the cited ranges (src/core/project-registry.ts:362-378, src/controller/state.ts:434-441)
L-17 (warning, citation-identifier, line 136): Identifier 'syncWithRegistry' is absent from the cited ranges (src/dashboard/project-manager.ts:77-92, src/dashboard/project-manager.ts:161-169, src/dashboard/project-manager.ts:240-249, src/controlle
L-18 (warning, citation-identifier, line 139): Identifier 'export' is absent from the cited ranges (src/controller/merge.ts:47-50)
L-19 (warning, citation-identifier, line 143): Identifier 'mkdir' is absent from the cited ranges (src/core/dashboard-session.ts:21-24)
L-20 (warning, citation-identifier, line 143): Identifier 'url' is absent from the cited ranges (src/core/dashboard-session.ts:21-24)
L-21 (warning, citation-identifier, line 146): Identifier 'init' is absent from the cited ranges (docs/SDD-HARNESS.md:312-331)
L-22 (warning, citation-identifier, line 146): Identifier 'doctor' is absent from the cited ranges (docs/SDD-HARNESS.md:312-331)
L-23 (warning, citation-identifier, line 147): Identifier 'init' is absent from the cited ranges (docs/SDD-HARNESS.md:252-270)
L-24 (warning, citation-identifier, line 171): Identifier 'bootstrapCommand' is absent from the cited ranges (src/__tests__/workspace-roots.test.ts:514-517)
L-25 (warning, citation-identifier, line 171): Identifier 'init' is absent from the cited ranges (src/__tests__/workspace-roots.test.ts:514-517)
L-26 (warning, citation-identifier, line 171): Identifier 'doctor' is absent from the cited ranges (src/__tests__/workspace-roots.test.ts:514-517)
L-27 (warning, citation-identifier, line 171): Identifier 'showHelp' is absent from the cited ranges (src/__tests__/workspace-roots.test.ts:514-517)
L-28 (warning, citation-identifier, line 171): Identifier 'Starting' is absent from the cited ranges (src/__tests__/workspace-roots.test.ts:514-517)
L-29 (warning, citation-identifier, line 177): Identifier 'workflowRootPath' is absent from the cited ranges (src/dashboard/__tests__/health-route.test.ts:49-71)

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
