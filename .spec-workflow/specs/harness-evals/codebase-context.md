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
