# Codebase context — harness-evals

## Step runner (src/controller)
- src/controller/step.ts:92-134 — `StepSpec`, every input one model step takes (role, brief path, cwd, log, turns, schema, MCP config).
- src/controller/step.ts:146-150 — `harnessDir()`: `harness/` resolved from the running build's package root, so a staged build reads the staging tree's roles.
- src/controller/step.ts:229-242 — `loadRole`: body and tools from `harness/agents/<name>.md`, model and effort from `harness/agent-profiles.json`.
- src/controller/step.ts:343-516 — `runStep`: spawns one headless `claude -p`, scrubs API keys, returns a classified `StepResult`.
- src/controller/step.ts:303-327 — `classify`: ok, turn-cap, usage-limit, schema-invalid, error.
- src/controller/phases/implementation.ts:67-72 — `TURN_CAP` per role for implementation steps.
- src/controller/phases/implementation.ts:144-209 — report schemas: test author, implementer (exported), verifier, end-to-end, adjudicator.
- src/controller/phases/document.ts:199-234 — drafter and reviewer report schemas (module-private).
- src/controller/phases/closeout.ts:1-80 — close-out phase header, `TURN_CAP`, class order, `isTestPath`, context and outcome types.
- scripts/stub-claude.mjs:1-40 — stand-in `claude` for tests, canned stream runs from `STUB_CLAUDE_SCRIPT`.

## Brief templates (src/tools)
- src/tools/brief-templates.ts:1-60 — `BriefTemplate` type, the report-block sentence, per-phase word caps.
- src/tools/brief-templates.ts:96-145 — drafter brief rules; lines 129-133 still tell a tasks drafter to write `- Test (integration):`.
- src/tools/brief-templates.ts:1370-1397 — retro findings format and the analyst's proposal format (`Target:` line values).
- src/tools/brief-templates.ts:1399-1440 — `renderRetroCompile`.
- src/tools/brief-templates.ts:1501-1518 — `renderCloseoutBatch`; line 1509 pins every edit under the landing root.
- src/tools/brief-templates.ts:1584-1678 — `BRIEF_TEMPLATES`, the registry of every template, its mode and required keys.
- src/tools/harness.ts:541-561 — `classifyTarget`: a proposal's `Target:` line to store, harness, code, home or none.
- src/tools/harness.ts:1088-1123 — `gateAction`: gate payload put/get/delete under the spec dir.

## Role files (harness)
- harness/agents/sdd-drafter.md:25 — only `- Test: <path> — <call>` is a valid test-seam label.
- harness/agents/sdd-test-author.md:14-34 — test-author rules: pre-commit hook stop (line 29), no attribution trailer (line 31).
- harness/agents/sdd-implementer.md:24-27 — work only in the code root; no attribution trailer.
- harness/agents/sdd-retro-analyst.md:1-24 — retro analyst role: one proposal per finding, writes only the proposals file.

## Task labels and the merge rule
- src/core/task-parser.ts:14 — `TEST_BULLET_RE`, the canonical `- Test:` bullet.
- src/core/task-validator.ts:1-20 — `SEAM_LABEL_RE` near-miss label regex.
- src/core/task-validator.ts:138-150 — the near-miss label check in task validation.
- src/controller/merge.ts:252-256 — `ATTRIBUTION_PATTERNS` the merge rule rejects (module-private).
- src/controller/merge.ts:446-454 — a commit or PR body with a trailer becomes a `trailer` blocker.

## Deploy (self-update)
- scripts/sdd-self-update.sh:1-60 — usage, flags (`--dry-run`, `--no-restart`), `write_error_wait`.
- scripts/sdd-self-update.sh:62-102 — (a) refuse while a step is live.
- scripts/sdd-self-update.sh:104-174 — (b) move the live checkout to origin/main (fast-forward or store-only rebase).
- scripts/sdd-self-update.sh:176-197 — (c) build in the staging worktree `.claude/worktrees/self-update`.
- scripts/sdd-self-update.sh:199-215 — (d) smoke boot on a scratch port with a copied home.
- scripts/sdd-self-update.sh:217-240 — (e) re-check for a live step, swap `dist/`, restart.
- src/index.ts:428-445 — `--smoke` boot mode with an isolated session home and a 30 s timeout.
- docs/SDD-HARNESS.md:459-473 — the staged self-update as documented.
- src/dashboard/harness/run-setup.ts:98-102 — `post-merge:` line read from agent-rules.

## Deferrals
- src/core/deferral-storage.ts:1-30 — `DeferralStorage`, one markdown file per deferral under the store's `deferrals/`.
- src/core/deferral-storage.ts:229-270 — `create`, returns the new id.
- src/core/deferral-storage.ts:62-66 — `owner` written only when `matthew` or `harness`.

## Seed-failure evidence
- docs/foundation-handoff.md:25-45 — `shout` run: test author's `Co-Authored-By` trailer blocked the PR two hours.
- docs/foundation-review.md:660-676 — close-out implementer edited the main checkout through absolute paths (PR #133).
- docs/foundation-review.md:692-704 — `whisper` close-out: implementer refused P3, which reversed an earlier decision.
- docs/foundation-review.md:759-775 — spec 23 `- Test (integration):` escalation; jobscout pre-commit hook blocked the red commit.
- docs/foundation-review.md:790-802 — #154 test author stops on a test-running pre-commit hook; spec 27 added.
- docs/foundation-review.md:300 — `### Progress log` heading.
- docs/ai-resources-catalogue.md:165-185 — grill decisions 18-25 for harness evals.
- GLOSSARY.md:46-55 — Check and Eval case terms.

## Step env and callers (design phase)
- src/controller/step.ts:381-387 — step env: `process.env` spread, API keys scrubbed, `SDD_RUN_ID`/`SDD_STEP_ID`/workspace/shared-root set only when given.
- src/controller/phases/implementation.ts:435-474 — `runModelStep`: the `StepSpec` the implementation phase builds (cwd, turn cap, mcpConfig, roots).
- src/controller/phases/implementation.ts:501-502 — `brief` helper: renders through `harnessHandler({ action: 'brief', … })`.
- src/controller/phases/implementation.ts:638-652 — test-author brief values (`title`, `job`) and the author step with `AUTHOR_SCHEMA`.
- src/controller/phases/closeout.ts:82-104 — `BATCH_SCHEMA` (module-private), `items[].status|commit|reason`.
- src/controller/phases/closeout.ts:196-206 — `COMMIT_SCRIPT`, the close-out commit script text (module-private).
- src/controller/phases/closeout.ts:301-328 — close-out `runModelStep` (cwd per step) and `brief` helper.
- src/controller/phases/closeout.ts:346-353 — standing brief rendered with `commitScript`.
- src/controller/phases/closeout.ts:403-414 — `closeout-batch` values and the implementer step, cwd = landing root.
- src/controller/phases/document.ts:44 — `STEP_TURN_CAP = 80`.
- src/controller/phases/document.ts:900-917 — in-process `renderBrief`/`writeBrief` for document-phase briefs.
- src/controller/controller.ts:436-453 — default `mcpConfigFor`: the `spec-workflow` entry from the project's `.mcp.json`.
- src/controller/state.ts:238-243 — `controllerHome()`.

## Brief action (src/tools/harness.ts)
- src/tools/harness.ts:585 — `SERVER_BRIEF_KEYS`: `agentRules`, `taskBlock`, `spec`.
- src/tools/harness.ts:617-842 — `briefAction`: template lookup, `path` required, agent-rules line, task block, test-line check, missing-key report, write, returns `data.path`.
- src/tools/harness.ts:707-712 — a `test-author` brief needs a task with a `- Test:` line.
- src/tools/harness.ts:805-807 — an absolute output path is honoured as given.
- src/tools/brief-templates.ts:1472-1499 — `renderCloseoutStanding`; lines 1487-1489 the cannot-do-as-written rule.
- src/tools/brief-templates.ts:1381-1391 — the proposal format block, `Target:` and `Prerequisites:` lines.

## Graders' sources
- src/core/task-validator.ts:42 — `validateTasksMarkdown` (exported).
- src/core/task-validator.ts:146-162 — near-miss label error, message "is not canonical", field `test` or `file`.
- src/controller/merge.ts:258-260 — `hasAttribution` (module-private).

## CLI and config
- src/index.ts:156-169 — `CLI_FLAGS` registry of the server CLI.
- src/index.ts:239-241 — unknown `--` flags are rejected.
- src/core/git-utils.ts:214-221 — `SPEC_WORKFLOW_SHARED_ROOT` overrides the shared root.
- src/core/git-utils.ts:341-345 — `SPEC_WORKFLOW_WORKSPACE` read for the workspace.
- vitest.config.ts:8 — tests are `src/**/*.{test,spec}.{js,ts}`.
- tsconfig.json:7-8 — `outDir ./dist`, `rootDir ./src`.

## Self-update tests
- src/__tests__/service-scripts.test.ts:244-265 — `--dry-run` in a temp clone: exit 0, no dist, no staging worktree.
- src/__tests__/service-scripts.test.ts:267-317 — store-only rebase and autostash tests; expect `rebasing` and `building in staging`.
- src/__tests__/service-scripts.test.ts:319-364 — refusal tests; expect no `building in staging`.
- scripts/sdd-self-update.sh:19-32 — `set -euo pipefail`, flag loop.
- scripts/sdd-self-update.sh:116-174 — step (b): fetch, divergence check, rebase or fast-forward.

## Deferral type
- src/types.ts:310-333 — `DeferralOwner`, `Deferral` fields and `body` shape.

## Tasks phase additions
- src/controller/step.ts:62-76 — `StepUsage` (five token fields) and `StepClassification`.
- src/controller/phases/closeout.ts:242-248 — close-out `git` helper through `scrubbedGitEnv`.
- src/core/git-utils.ts:45 — `scrubbedGitEnv` (exported).
- src/core/path-utils.ts:208-210 — `getWorkflowRoot`: `<project>/.spec-workflow`, the deferral store's base.
- src/core/test-home-guard.ts:45-57 — `guardTestHome`: a test resolving the real home throws.
- vitest.setup.ts:19-30 — per-worker temp `SDD_HOME`, `SPEC_WORKFLOW_HOME`, `XDG_STATE_HOME`.
- src/tools/brief-templates.ts:1584-1590 — `closeout-standing` and `closeout-batch` required keys.
- src/tools/__tests__/harness.test.ts:368 — `drafterValues`, the drafter brief test values.
- src/tools/__tests__/harness.test.ts:387 — drafter brief `toContain('Write v1 of')` assertion.
- src/controller/phases/__tests__/retrospective.test.ts:150 — retro-compile brief holds the proposal format heading.
- src/__tests__/service-scripts.test.ts:49-70 — `makeDivergedCheckout`, the toy origin and checkout.
- package.json:25-40 — scripts: build, test (`vitest`); no plugin-asset sync script at base.
