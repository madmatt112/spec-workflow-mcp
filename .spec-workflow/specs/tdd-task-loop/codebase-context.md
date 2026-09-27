# Codebase context — tdd-task-loop

## Task parser and tasks template
- src/core/task-parser.ts:108-128 — `ParsedTask` shape; no test field today
- src/core/task-parser.ts:279-297 — unanchored `Files?:` branch, then the bullet fallthrough into `implementationDetails`
- src/core/task-parser.ts:318-331 — the parsed task literal with its optional metadata spreads
- src/markdown/templates/tasks-template.md:1-36 — shipped tasks template: shape rules line and example tasks
- src/core/workspace-initializer.ts:54-85 — copies the shipped templates into the spec store, overwriting
- src/core/task-parser.ts:279-288 — unanchored `Files?:` branch the Test branch goes before
- src/core/task-parser.ts:300-306 — `hasDetails`, the header-task test
- src/core/task-parser.ts:314-332 — parsed task literal (current range)
- src/core/task-parser.ts:365-385 — `taskBlock(content, taskId)`, the brief's task block
- src/core/task-validator.ts:167-170 — `Files?:` check; other bullets pass untouched

## Tasks lint
- src/core/lint-tasks.ts:1-19 — module header: pure tasks rules, findings leave `file` empty
- src/core/lint-tasks.ts:276-298 — `checkBridges`, the last tasks rule, the shape a new rule follows
- src/core/lint-types.ts:9-15 — `LintRule` union of rule ids
- src/core/lint-types.ts:50-63 — `CHECKS_BY_PHASE`, the per-phase rule list
- src/tools/spec-lint.ts:158-187 — tasks-phase wiring; `checkBridges` call at the end
- src/core/lint-ears.ts:13-18 — EARS shape: `SHALL`, and `THEN` after `WHEN`/`IF`
- src/core/lint-markdown.ts:67-76 — `Criterion` shape
- src/core/lint-markdown.ts:84-98 — `TaskBlock` shape
- src/core/lint-markdown.ts:163-202 — `criteria`, acceptance items by requirement

## Tasks reviewer lens
- src/tools/adversarial-review.ts:282-285 — tasks-phase attack angles
- harness/skills/sdd-document-phase/references/briefs.md:184-209 — reviewer brief lens list and the tasks gate-B tags
- harness/skills/sdd-document-phase/references/briefs.md:205-209 — tasks gate-B bullet, the lens goes after it

## Brief templates and agents
- src/tools/harness.ts:485-535 — `BRIEF_TEMPLATES`: drafter, reviser, adjudicator, verifier, implementer
- src/tools/harness.ts:537-538 — `SERVER_BRIEF_KEYS` filled by the server
- harness/agents/sdd-implementer.md:1-38 — implementer frontmatter, tools and standing rules
- harness/agent-profiles.json:1-74 — generated profiles, twelve agents
- scripts/sync-plugin-assets.cjs:90-134 — `buildProfiles`: role from the description prefix `SDD <role>:`
- src/watch/ledger.ts:56-57 — profile file candidates the ledger view loads
- docs/SDD-HARNESS.md:21-23 — the eight worker agents list
- docs/SDD-HARNESS.md:313-320 — model policy table
- src/tools/harness.ts:641-659 — implementer task-block fill from the parser
- src/tools/harness.ts:661-675 — required-value check over remaining placeholders
- src/tools/__tests__/harness.test.ts:170-172 — implementer brief call with `title` only
- src/tools/__tests__/harness.test.ts:247-253 — per-template base values
- src/__tests__/agent-profiles.test.ts:1-53 — profile test: 12 keys, model line 4, effort line 5, cacheTtl split
- scripts/sync-plugin-assets.cjs:91 — count word in the `buildProfiles` comment

## Implementation loop
- harness/skills/sdd-implementation-phase/SKILL.md:55-68 — ledger rows the orchestrator writes, including the gate `note`
- harness/skills/sdd-implementation-phase/SKILL.md:93-104 — pick, `base=` capture, shared-repo single-commit `baseRef`
- harness/skills/sdd-implementation-phase/SKILL.md:105-110 — implementer brief through `harness brief`
- harness/skills/sdd-implementation-phase/SKILL.md:134-155 — gate call and routing on `gate`/`risk`
- harness/skills/sdd-implementation-phase/SKILL.md:156-163 — verifier step for high risk
- harness/skills/sdd-implementation-phase/SKILL.md:164-181 — fix rounds, cap 3, adjudication
- harness/skills/sdd-implementation-phase/SKILL.md:209-216 — design-defect stop
- harness/skills/sdd-implementation-phase/references/briefs.md:60-73 — implementer brief shape
- harness/skills/sdd-implementation-phase/references/briefs.md:75-101 — fix brief and gate-fail variant
- harness/skills/sdd-implementation-phase/references/briefs.md:127-159 — verifier brief with `## Gate results`
- harness/skills/sdd-implementation-phase/references/briefs.md:5-65 — implementer standing brief (current range)
- harness/skills/sdd-implementation-phase/references/briefs.md:67-80 — implementer brief (current range)
- harness/skills/sdd-implementation-phase/references/briefs.md:82-108 — fix brief and gate-fail variant (current range)
- harness/skills/sdd-implementation-phase/references/briefs.md:134-159 — verifier brief with `## Gate results` (current range)
- harness/skills/sdd-continue/SKILL.md:336-342 — worktree rule reading `worktree-per-change` and `worktree-setup`

## Review gate
- src/tools/review-gate.ts:47-55 — `GateArgs`
- src/tools/review-gate.ts:59-70 — `GateData` response shape
- src/tools/review-gate.ts:102-106 — `isDocPath`
- src/tools/review-gate.ts:192-209 — reads `agent-rules.md` for sensitive and generated paths
- src/tools/review-gate.ts:222-243 — range stats and the trivial-change probe
- src/tools/review-gate.ts:271-302 — checks run, `decideGate`, `scoreRisk`
- src/tools/review-gate.ts:303-324 — high-to-medium down-rank for docs-only, generated-only, no-product-code
- src/tools/review-gate.ts:328-344 — gate records a `reviewer: gate` review only on pass below high
- src/core/gate-rules.ts:34-40 — test word, test basename and test directory constants
- src/core/gate-rules.ts:192-198 — `isTestPath`
- src/core/gate-rules.ts:258-273 — `countedLines` drops test paths
- src/core/gate-rules.ts:280-359 — `scoreRisk`: trivial fast path, rules a to g
- src/core/gate-rules.ts:384-437 — `decideGate`, including `file-outside-list`
- src/core/check-runner.ts:5-7 — `CHECK_TIMEOUT_MS`, `CHECK_MAX_BUFFER`
- src/core/check-runner.ts:35-44 — `lastLine`: keeps one output line only
- src/core/check-runner.ts:92-104 — `runChecks(root, commands)`
- src/core/git-utils.ts:45-51 — `scrubbedGitEnv`
- src/tools/review-task.ts:249-271 — gate-only input schema fields
- src/tools/review-task.ts:281-312 — `reviewTaskHandler` dispatch to prepare, record, gate
- src/tools/review-gate.ts:127-186 — `handleGate` entry, root check, task or item mode
- src/tools/review-gate.ts:279-312 — checks run, `decideGate`, `scoreRisk` (current range)
- src/tools/review-gate.ts:313-336 — down-rank and reason join (current range)
- src/tools/review-gate.ts:338-354 — gate records a review only on a task pass below high (current range)
- src/tools/review-gate.ts:358-368 — `data` literal
- src/core/gate-rules.ts:1-12 — module header: pure, core never imports tools; type-only imports
- src/core/gate-rules.ts:79-99 — `parseHeadingBullets`, the agent-rules list parser
- src/core/gate-rules.ts:286-365 — `scoreRisk`, trivial fast path first (current range)
- src/core/gate-rules.ts:319-335 — rule c `tests-not-touched`
- src/core/gate-rules.ts:396-454 — `decideGate` (current range)
- src/core/gate-rules.ts:430-444 — `file-outside-list` skips
- src/core/check-runner.ts:46-86 — `runOne`: exec callback, timeout and buffer handling
- src/core/task-diff.ts:69-86 — `runGit`, private scrubbed git runner
- src/core/typecheck.ts:241-243 — spec-store `.cache` directory and gitignore entry
- .gitignore:147-148 — `.spec-workflow/.cache/` ignored
- .spec-workflow/agent-rules.md:5-6 — `key: value` lines, backtick value form

## Review record and display
- src/types.ts:253-263 — `TaskReview`
- src/core/task-review-manager.ts:108-131 — `saveReview`
- src/core/task-review-manager.ts:185-235 — `reviewToMarkdown`
- src/core/task-review-manager.ts:237-313 — `parseReviewMarkdown`
- src/tools/review-task.ts:858-864 — verifier `record` saves the review
- src/tools/spec-status.ts:179-193 — review coverage for completed tasks
- src/dashboard/multi-server.ts:1931-1962 — task review list and version routes
- src/dashboard_frontend/src/modules/api/api.tsx:444-449 — review fetchers
- src/dashboard_frontend/src/modules/pages/TasksPage.tsx:472-507 — `TaskReviewFindings`, renders nothing when findings are empty
- src/core/task-review-manager.ts:71-103 — prepare marker file per task
- src/core/task-review-manager.ts:155-177 — `loadAllReviews` reads only `review-*.md`
- src/tools/review-task.ts:792-864 — `handleRecord` validations and `saveReview`
- src/tools/spec-status.ts:207-225 — status `data` literal
- src/dashboard/multi-server.ts:1964-1988 — per-spec review summary route
- src/dashboard_frontend/src/modules/pages/TasksPage.tsx:520-524 — review summary state
- src/dashboard_frontend/src/modules/pages/TasksPage.tsx:1364-1406 — always-shown review fragment of the task row

## Ledger
- src/watch/ledger.ts:18-24 — `LedgerEvent` shape
- src/watch/ledger.ts:246-250 — view scoped to the last run id
- harness/hooks/sdd-activity.sh:29 — hook writes the spec's `harness-events.jsonl`

## Jev prerequisites
- .gitignore:164 — `.mcp.json` is ignored
- docs/jev-integration-research.md:32-54 — request and response shape
- docs/jev-integration-research.md:315-337 — judge module mechanics
- docs/tdd-implementation-research.md:348-356 — the four judge questions
