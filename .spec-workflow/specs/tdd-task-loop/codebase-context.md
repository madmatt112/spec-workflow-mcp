# Codebase context — tdd-task-loop

## Task parser and tasks template
- src/core/task-parser.ts:108-128 — `ParsedTask` shape; no test field today
- src/core/task-parser.ts:279-297 — unanchored `Files?:` branch, then the bullet fallthrough into `implementationDetails`
- src/core/task-parser.ts:318-331 — the parsed task literal with its optional metadata spreads
- src/markdown/templates/tasks-template.md:1-36 — shipped tasks template: shape rules line and example tasks
- src/core/workspace-initializer.ts:54-85 — copies the shipped templates into the spec store, overwriting

## Tasks lint
- src/core/lint-tasks.ts:1-19 — module header: pure tasks rules, findings leave `file` empty
- src/core/lint-tasks.ts:276-298 — `checkBridges`, the last tasks rule, the shape a new rule follows
- src/core/lint-types.ts:9-15 — `LintRule` union of rule ids
- src/core/lint-types.ts:50-63 — `CHECKS_BY_PHASE`, the per-phase rule list
- src/tools/spec-lint.ts:158-187 — tasks-phase wiring; `checkBridges` call at the end
- src/core/lint-ears.ts:13-18 — EARS shape: `SHALL`, and `THEN` after `WHEN`/`IF`

## Tasks reviewer lens
- src/tools/adversarial-review.ts:282-285 — tasks-phase attack angles
- harness/skills/sdd-document-phase/references/briefs.md:184-209 — reviewer brief lens list and the tasks gate-B tags

## Brief templates and agents
- src/tools/harness.ts:485-535 — `BRIEF_TEMPLATES`: drafter, reviser, adjudicator, verifier, implementer
- src/tools/harness.ts:537-538 — `SERVER_BRIEF_KEYS` filled by the server
- harness/agents/sdd-implementer.md:1-38 — implementer frontmatter, tools and standing rules
- harness/agent-profiles.json:1-74 — generated profiles, twelve agents
- scripts/sync-plugin-assets.cjs:90-134 — `buildProfiles`: role from the description prefix `SDD <role>:`
- src/watch/ledger.ts:56-57 — profile file candidates the ledger view loads
- docs/SDD-HARNESS.md:21-23 — the eight worker agents list
- docs/SDD-HARNESS.md:313-320 — model policy table

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

## Ledger
- src/watch/ledger.ts:18-24 — `LedgerEvent` shape
- src/watch/ledger.ts:246-250 — view scoped to the last run id
- harness/hooks/sdd-activity.sh:29 — hook writes the spec's `harness-events.jsonl`

## Jev prerequisites
- .gitignore:164 — `.mcp.json` is ignored
