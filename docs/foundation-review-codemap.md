# Foundation review: load-bearing code map (2026-10-09)

Fact-finding report produced by a read-only subagent for `docs/foundation-review.md`. Paths
are relative to the repo root. Line numbers are as of commit 1f76bb3.

## 1. Harness -> server dependency

14 MCP tools (`src/tools/index.ts:18-35`). The harness uses 11. `spec-workflow-guide`,
`steering-guide`, `decomposition-guide` are unused by any skill or agent.

| Tool | Prose call sites | Notes |
| --- | --- | --- |
| harness | ~51 | actions orient, brief, phase-log, gate used; `usage` only run by hand |
| deferrals | ~30 | add, list, get, resolve, merge used; update, delete, reindex unused |
| spec-status | 10 | |
| review-task | 8 (+ briefs) | gate, prepare, record |
| approvals | 7 (+11 "never touch" guardrails) | request, list, approve, prune, status used; delete, reject unused |
| log-implementation | 7 (+ briefs) | |
| spec-index | 7 | generate only; defer, undefer unused |
| adversarial-review | 4 | |
| spec-lint | 2 | |
| get-task-review | 1 | |
| adversarial-response | 0 in .md | only the server brief tells reviser/adjudicator to call it |

Drift: `harness/agents/sdd-adjudicator.md:26` tells it to call `log-implementation`; its grant
list (`:7-16`) lacks the tool.

## 2. Legacy-only code

Frontend after spec 15: routes Now, Runs, Run, Specs, Deferrals, Usage (placeholder). It
calls 10 HTTP endpoints and subscribes to 6 WebSocket topics. About 1,400 of 6,109 lines are
upstream residue (i18n + 11 locales ~881, notifications 343, ChangelogModal 181).

VS Code extension (13,168 lines): imports nothing from `src/`, calls no API, reads
`.spec-workflow` directly. It is the only remaining UI that can set an approval to
needs-revision (the supervisor's revision path, `sdd-continue/SKILL.md:253-256`).

Backend for removed pages is still live: ~1,650 of 2,543 lines of `multi-server.ts` are
routes nothing calls (specs/archive/approvals 586-753; approvals content/actions/adversarial
/batch/snapshots/diff 764-1369; steering 1370-1431; task progress/status/impl log 1432-1631;
adversarial reviews/settings 1659-1859; task-review runner 1860-2023; jobs 2088-2198). Eight
WebSocket broadcast types have no subscriber.

Legacy-only modules (1,794 lines): adversarial-runner 255, task-review-runner 694,
job-scheduler 395, settings-manager 201, execution-history-manager 180,
adversarial-display-state 69 (dead). `JobScheduler` starts on every dashboard start
(`multi-server.ts:198`) and its cleanup jobs can `fs.rm` spec directories
(`job-scheduler.ts:243-291`); `automationJobs: []` today, no UI left to change it.
Also: `core/archive-service` 105, `dashboard/parser.ts` 276 (duplicates core/parser),
`core/implementation-log-migrator` 287 (runs on every MCP connect; has grown
`~/.spec-workflow-mcp/migration.log` to 2.1 MB), `src/config.ts` 247 (dead).
Guide tools 834 lines, all of `src/prompts` 996, steering templates 380: unused.

Rough split of ~34,000 non-test server lines: harness path ~22,900 (67%), shared plumbing
~4,800 (14%), legacy-only ~6,300 (19%). Plus ~2,550 test lines that cover only legacy code.

## 3. State inventory (who writes what)

Written by an LLM by hand, per skill text: the documents (by design), `codebase-context.md`,
the adversarial analyses (by design), `retrospective*.md`, `questions.md`,
`verification-evidence.md`, the HANDOFF routing header and gate rows, the
`~/.local/state/sdd/active-run` pointer append (`SKILL.md:132-135`), and four scripts
transcribed from prose each run: `event.sh` (`SKILL.md:130`), `retro.sh`, `deregister.mjs`
(`formats.md:253-285`), the `-retro` worktree script.

Written by tools or scripts: approvals JSON (decides phase routing), review records, impl
logs, `task-state.json`, `gate-a.json`/`gate-b.json`, `harness-activity.jsonl` (hook),
deferrals, `INDEX.md`, templates, `harness-run.json`, launch records and logs,
`activeProjects.json` (needed for launch), `spawn-ends/` markers (1,168 files, never pruned).

Written by a human: `agent-rules.md`, `decomposition.md`.

State that decides routing: approvals JSON, `tasks.md`, `harness-events.jsonl`, the HANDOFF
routing header, `decomposition.md`, `agent-rules.md`, `retrospective-plan.md` Status.

## 4. Run lifecycle today

Launch: POST `harness/launch` forces `gates: 'record'` (`multi-server.ts:2244`); admission
refuses on a pointer line or live record; `spawnRun` runs a detached
`claude -p "continue the sdd process" --model <supervisor> --effort high --permission-mode auto`.

Headless detection (`SKILL.md:152-157`): `headless=yes` when AskUserQuestion is not available;
gates mode falls back to `block` when it is available (`SKILL.md:443-448`). A denied call
falls back to record but never changes the ledger flag (`:449-452`).

Gates in record mode (every dashboard launch): gate A fills "no answer" and continues; gate B
writes rows and continues. Nothing writes `phase.end result=gate-b`, so the dashboard's
gate-B wait (`waits.ts:69`) can never fire. Retro-ready: plan written as DRAFT, run ends.

Liveness: a pointer line under the project's specs dir (`now-model.ts:102-122`). No PID
check except at admission, restore and stop. A crashed supervisor leaves the line forever.

## 5. Sizes

| Dir | Source | Tests |
| --- | --- | --- |
| src/core | 10,442 | 12,573 (38 files) |
| src/tools | 8,810 | 8,805 (17) |
| src/dashboard | 9,800 | 9,993 (23) |
| src/dashboard_frontend/src | 6,109 | 0 |
| src/watch | 1,855 | 1,840 (6) |
| src/prompts | 996 | 32 |
| src/markdown | 549 | 0 |
| vscode-extension/src | 13,168 | 513 |
| harness (skills, agents, hooks) | 4,655 | 0 |
| plugins/ (3 mirrors) | 14,011 | |
| docs/ | 14,653 (85 files) | |

## 6. Upstream residue

`SPEC_WORKFLOW_HOME`: the default dir holds launch records, logs and the registry; keep the
dir, the override is portability only. Locales: unused by the shell. README client matrix,
Docker, containers/: unused here. VS Code extension: no code dependency; only annotator left.
Steering documents: soft dependency (drafter briefs read `steering/*.md` without checking;
this repo's is empty). Three plugins: not at runtime here, but every agent grant names two
plugin-prefixed tool ids and close-out resyncs `plugins/`. npm publish: for other users only.

## Summary

What the harness truly stands on: ~22,900 server lines (most of `src/core`, `watch/`,
`brief-templates`, approval and impl-log storage, dashboard `harness/` and `shell/`) and the
state files above. Deletable without the harness noticing: ~6,300 server lines, ~1,650 lines
of legacy routes (one e2e test uses the PUT task-status route), ~1,400 frontend lines, the
VS Code extension, Docker, the README client matrix. Keep but simplify: the plugin
references in agent grants and the drift check.
