# Lint brief — decisions-and-launch-guard design v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/decisions-and-launch-guard/design.md` in place.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/decisions-and-launch-guard/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/decisions-and-launch-guard/design.md` (v1). Cap: 4,000 words. Do not grow the document past it; a fix that adds a paragraph removes one.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/decisions-and-launch-guard/requirements.md`.
- Findings: the list under `## Revision input`.
- Prior dispositions: a version's lint pass receives the prior version's dispositioned findings (each token, its disposition and reason).

## Revision input
L-1 (warning, citation-identifier, line 34): Identifier 'displayName' is absent from the cited ranges (src/controller/state.ts:619-628, src/dashboard/project-manager.ts:233, src/dashboard/project-manager.ts:355)
L-2 (info, citation-bare, line 35): Bare range `:115` has no earlier path citation in its block
L-3 (info, citation-bare, line 35): Bare range `:145` has no earlier path citation in its block
L-4 (info, citation-bare, line 35): Bare range `:152` has no earlier path citation in its block
L-5 (info, citation-bare, line 35): Bare range `:216` has no earlier path citation in its block
L-6 (info, citation-bare, line 36): Bare range `:233-236` has no earlier path citation in its block
L-7 (warning, citation-identifier, line 36): Identifier 'addProject' is absent from the cited ranges (src/advisor/summary.ts:111-112)
L-8 (warning, citation-identifier, line 37): Identifier 'generateProjectDisplayName' is absent from the cited ranges (src/core/project-registry.ts:376, src/core/project-registry.ts:427-434)
L-9 (warning, citation-identifier, line 38): Identifier 'shownName' is absent from the cited ranges (src/advisor/push.ts:92)
L-10 (warning, citation-identifier, line 39): Identifier 'ActionTile' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/tiles.tsx:276-280)
L-11 (warning, citation-identifier, line 49): Identifier 'guard' is absent from the cited ranges (src/dashboard/multi-server.ts:620-632)
L-12 (warning, citation-identifier, line 49): Identifier 'storeProjects' is absent from the cited ranges (src/dashboard/multi-server.ts:620-632)
L-13 (warning, citation-identifier, line 49): Identifier 'getAllProjects' is absent from the cited ranges (src/dashboard/multi-server.ts:620-632)
L-14 (warning, citation-identifier, line 49): Identifier 'launchSpec' is absent from the cited ranges (src/dashboard/multi-server.ts:620-632)
L-15 (warning, citation-identifier, line 51): Identifier 'tasks' is absent from the cited ranges (src/core/task-parser.ts:332-345)
L-16 (warning, citation-identifier, line 61): Identifier 'nextTiles' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/board.ts:61-76)
L-17 (warning, citation-identifier, line 63): Identifier 'HomePage' is absent from the cited ranges (src/dashboard/project-manager.ts:302)
L-18 (warning, citation-identifier, line 63): Identifier 'projects' is absent from the cited ranges (src/dashboard/project-manager.ts:302)
L-19 (warning, citation-identifier, line 63): Identifier 'SetupView' is absent from the cited ranges (src/dashboard/project-manager.ts:302)
L-20 (warning, citation-identifier, line 72): Identifier 'classifyTarget' is absent from the cited ranges (src/tools/harness.ts:542, src/controller/phases/closeout.ts:368)
L-21 (warning, citation-identifier, line 76): Identifier 'answer' is absent from the cited ranges (src/controller/phases/closeout.ts:262-266)
L-22 (info, citation-bare, line 78): Bare range `:362-375` has no earlier path citation in its block
L-23 (info, citation-bare, line 79): Bare range `:404` has no earlier path citation in its block
L-24 (info, citation-bare, line 79): Bare range `:490` has no earlier path citation in its block
L-25 (info, citation-bare, line 79): Bare range `:526` has no earlier path citation in its block
L-26 (info, citation-bare, line 80): Bare range `:633` has no earlier path citation in its block
L-27 (info, citation-bare, line 80): Bare range `:585-625` has no earlier path citation in its block
L-28 (warning, citation-identifier, line 86): Identifier 'undefined' is absent from the cited ranges (src/core/task-parser.ts:338-343)
L-29 (warning, citation-identifier, line 88): Identifier 'reasons' is absent from the cited ranges (src/controller/phases/implementation.ts:912, src/controller/phases/implementation.ts:754)
L-30 (warning, citation-identifier, line 90): Identifier 'gateReasons' is absent from the cited ranges (src/controller/phases/implementation.ts:929-936, src/controller/phases/implementation.ts:805-807)
L-31 (warning, citation-identifier, line 90): Identifier 'fileListPatch' is absent from the cited ranges (src/controller/phases/implementation.ts:929-936, src/controller/phases/implementation.ts:805-807)
L-32 (warning, citation-identifier, line 90): Identifier 'commitSpecStore' is absent from the cited ranges (src/controller/phases/implementation.ts:929-936, src/controller/phases/implementation.ts:805-807)
L-33 (warning, citation-identifier, line 90): Identifier 'undefined' is absent from the cited ranges (src/controller/phases/implementation.ts:929-936, src/controller/phases/implementation.ts:805-807)
L-34 (info, citation-bare, line 91): Bare range `:880` has no earlier path citation in its block
L-35 (info, citation-bare, line 91): Bare range `:881` has no earlier path citation in its block
L-36 (info, citation-bare, line 91): Bare range `:860` has no earlier path citation in its block
L-37 (info, citation-bare, line 91): Bare range `:834-835` has no earlier path citation in its block
L-38 (warning, citation-identifier, line 100): Identifier 'renderReviser' is absent from the cited ranges (src/controller/phases/document.ts:452-454, src/tools/brief-templates.ts:457-462)
L-39 (warning, citation-identifier, line 101): Identifier 'lintStep' is absent from the cited ranges (src/controller/phases/document.ts:883, src/controller/phases/document.ts:885-888)
L-40 (warning, citation-identifier, line 101): Identifier 'narrowCheckRan' is absent from the cited ranges (src/controller/phases/document.ts:883, src/controller/phases/document.ts:885-888)
L-41 (info, citation-bare, line 102): Bare range `:345` has no earlier path citation in its block
L-42 (info, citation-bare, line 102): Bare range `:522-523` has no earlier path citation in its block
L-43 (info, citation-bare, line 102): Bare range `:855` has no earlier path citation in its block
L-44 (info, citation-bare, line 103): Bare range `:861-864` has no earlier path citation in its block
L-45 (warning, citation-identifier, line 112): Identifier 'false' is absent from the cited ranges (src/controller/state.ts:431-463, src/controller/state.ts:512-513, src/controller/runs.ts:566-571, src/controller/runs.ts:429-435)
L-46 (warning, citation-identifier, line 112): Identifier 'updateRun' is absent from the cited ranges (src/controller/state.ts:431-463, src/controller/state.ts:512-513, src/controller/runs.ts:566-571, src/controller/runs.ts:429-435)
L-47 (warning, citation-identifier, line 112): Identifier 'writeLastActivityLocked' is absent from the cited ranges (src/controller/state.ts:431-463, src/controller/state.ts:512-513, src/controller/runs.ts:566-571, src/controller/runs.ts:429-435)
L-48 (warning, citation-identifier, line 113): Identifier 'cancelled' is absent from the cited ranges (src/controller/step.ts:353, src/controller/phases/document.ts:389, src/controller/phases/implementation.ts:463, src/controller/phases/retrospect
L-49 (warning, citation-identifier, line 115): Identifier 'RunAbandonedError' is absent from the cited ranges (src/controller/waits.ts:87-104, src/controller/phases/gates.ts:169, src/controller/phases/gates.ts:256, src/controller/merge.ts:732, src
L-50 (warning, citation-identifier, line 115): Identifier 'abandoned' is absent from the cited ranges (src/controller/waits.ts:87-104, src/controller/phases/gates.ts:169, src/controller/phases/gates.ts:256, src/controller/merge.ts:732, src/control
L-51 (warning, citation-identifier, line 115): Identifier 'waitAnd' is absent from the cited ranges (src/controller/waits.ts:87-104, src/controller/phases/gates.ts:169, src/controller/phases/gates.ts:256, src/controller/merge.ts:732, src/controlle
L-52 (warning, citation-identifier, line 117): Identifier 'stopReason' is absent from the cited ranges (src/controller/runs.ts:419, src/controller/runs.ts:868, src/controller/runs.ts:754)
L-53 (info, citation-bare, line 118): Bare range `:846-851` has no earlier path citation in its block
L-54 (info, citation-bare, line 119): Bare range `:1347` has no earlier path citation in its block
L-55 (info, citation-bare, line 119): Bare range `:1024` has no earlier path citation in its block
L-56 (info, citation-bare, line 120): Bare range `:989` has no earlier path citation in its block
L-57 (info, citation-bare, line 120): Bare range `:1345` has no earlier path citation in its block
L-58 (warning, citation-identifier, line 123): Identifier 'RunTile' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/tiles.tsx:165-174, src/controller/runs.ts:1495-1500)
L-59 (warning, citation-identifier, line 127): Identifier 'RunTile' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/board.ts:46-59, src/dashboard_frontend/src/modules/shell/HomePage.tsx:18-39)
L-60 (warning, citation-identifier, line 131): Identifier 'branchReused' is absent from the cited ranges (src/controller/runs.ts:1490-1511, src/controller/controller.ts:382-395)
L-61 (warning, citation-identifier, line 131): Identifier 'codeRoot' is absent from the cited ranges (src/controller/runs.ts:1490-1511, src/controller/controller.ts:382-395)
L-62 (warning, citation-identifier, line 133): Identifier 'danger' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/tiles.tsx:149-150, src/dashboard_frontend/src/modules/shell/tiles.tsx:78-79, src/dashboard_frontend/src/mo
L-63 (warning, citation-identifier, line 133): Identifier 'isStalled' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/tiles.tsx:149-150, src/dashboard_frontend/src/modules/shell/tiles.tsx:78-79, src/dashboard_frontend/src
L-64 (warning, citation-identifier, line 133): Identifier 'warning' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/tiles.tsx:149-150, src/dashboard_frontend/src/modules/shell/tiles.tsx:78-79, src/dashboard_frontend/src/m
L-65 (warning, citation-identifier, line 133): Identifier 'runDot' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/tiles.tsx:149-150, src/dashboard_frontend/src/modules/shell/tiles.tsx:78-79, src/dashboard_frontend/src/mo
L-66 (warning, citation-identifier, line 133): Identifier 'amber' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/tiles.tsx:149-150, src/dashboard_frontend/src/modules/shell/tiles.tsx:78-79, src/dashboard_frontend/src/mod
L-67 (warning, citation-identifier, line 133): Identifier 'red' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/tiles.tsx:149-150, src/dashboard_frontend/src/modules/shell/tiles.tsx:78-79, src/dashboard_frontend/src/modul
L-68 (warning, citation-identifier, line 133): Identifier 'neutral' is absent from the cited ranges (src/dashboard_frontend/src/modules/shell/tiles.tsx:149-150, src/dashboard_frontend/src/modules/shell/tiles.tsx:78-79, src/dashboard_frontend/src/m
L-69 (warning, citation-identifier, line 193): Identifier 'running' is absent from the cited ranges (src/dashboard/shell/__tests__/board-view.test.ts:634-690)
L-70 (warning, citation-identifier, line 193): Identifier 'stopped' is absent from the cited ranges (src/dashboard/shell/__tests__/board-view.test.ts:634-690)
L-71 (warning, citation-identifier, line 193): Identifier 'runTone' is absent from the cited ranges (src/dashboard/shell/__tests__/board-view.test.ts:634-690)

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
