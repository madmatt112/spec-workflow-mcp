# Codebase context — graph-orientation

## harness tool (server)
- src/tools/harness.ts:17-27 — tool doc comment: five actions, reads only the spec store through `PathUtils.safeJoin`, spawns no child process.
- src/tools/harness.ts:28-43 — tool description text the MCP client sees; repeats "reads only the spec store; never spawns a process".
- src/tools/harness.ts:110-130 — `harnessHandler` switch over `orient`, `brief`, `phase-log`, `gate`, `usage`.
- src/tools/harness.ts:485-535 — `BRIEF_TEMPLATES`: five templates `drafter`, `reviser`, `adjudicator`, `verifier`, `implementer`; no reviewer or checker template.
- src/tools/harness.ts:537-538 — `SERVER_BRIEF_KEYS` (`agentRules`, `taskBlock`), placeholders the server fills itself.
- src/tools/harness.ts:547-655 — `briefAction`: fills `{{key}}` from `values`, drops the read-and-obey line when `agent-rules.md` is absent, writes the file, returns its path.
- src/tools/harness.ts:617-631 — every remaining `{{key}}` without a caller value fails the call and writes no file.
- src/tools/harness.ts:1029-1064 — `readSpecLedger`: reads `harness-events.jsonl` in the spec dir; missing file is an empty ledger.
- src/tools/harness.ts:1072-1093 — `usageAction`: one spec or two (`compareSpecName`), returns `formatUsageTable` text and `data.report`.
- src/tools/__tests__/harness.test.ts:165 — brief test: implementer task block byte for byte.
- src/tools/__tests__/harness.test.ts:203 — brief test: read-and-obey line dropped without `agent-rules.md`.
- src/tools/__tests__/harness.test.ts:523 — usage test: one spec folded, phase row in the message.
- src/tools/__tests__/harness.test.ts:540 — usage test: two specs with a per-phase delta.

## usage fold (server)
- src/watch/usage.ts:13-34 — `UsageCell`, `UsagePhase`, `UsageReport` shapes (spawns, tokens, cache columns; no graph field).
- src/watch/usage.ts:113-218 — `buildUsageReport`: pure fold of ledger events into phase and agent cells; no file reads.
- src/watch/usage.ts:277-294 — phase attribution: the spawn's phase key, else the live-phase window at its start time, else `unknown`.
- src/watch/usage.ts:356-359 — `formatUsageTable`: one report or a side-by-side compare.
- src/watch/usage.ts:361-373 — `formatOne`: header `phase | agent | spawns | tokens | cw5m | cw1h | gapRewrites`.
- src/watch/usage.ts:375-410 — `formatCompare`: the same columns twice plus a per-phase delta.
- src/watch/__tests__/usage.test.ts:1-494 — unit tests of the usage fold.

## activity hook (harness)
- harness/hooks/hooks.json:1-39 — registers `sdd-activity.sh` on `PreToolUse` (matcher `*`), `SubagentStart`, `SubagentStop`.
- harness/hooks/sdd-activity.sh:28-29 — writes `harness-activity.jsonl` and `harness-events.jsonl` in the spec dir.
- harness/hooks/sdd-activity.sh:126-128 — records only agents whose type matches `sdd-`; the main session is not recorded.
- harness/hooks/sdd-activity.sh:138-151 — `tool` row: `tool` name and `summary` (the Bash command, whitespace collapsed, cut at 160 characters).
- harness/hooks/sdd-activity.sh:179 — appends the row to the activity file.

## supervisor skill (harness)
- harness/skills/sdd-continue/SKILL.md:33-64 — step 0 preflight (model, server, agents, harness source, cache lifetime).
- harness/skills/sdd-continue/SKILL.md:66-94 — step 1 roots: spec store, code root = cwd, worktree check, main checkout = common dir without `/.git`.
- harness/skills/sdd-continue/SKILL.md:96-116 — run ledger: `event.sh`, pointer line, `run.start` keys.
- harness/skills/sdd-continue/SKILL.md:224-247 — the orchestrator launch prompt, one `KEY: value` line each.
- harness/skills/sdd-continue/SKILL.md:320-327 — worktree rule: enter a worktree before the first implementation spawn.
- harness/skills/sdd-continue/SKILL.md:354-397 — gate A reads `{header, question, options}` items from slot a.

## document phase skill (harness)
- harness/skills/sdd-document-phase/SKILL.md:8-12 — launch prompt keys the document orchestrator receives.
- harness/skills/sdd-document-phase/SKILL.md:75-101 — step 1: drafter brief through `harness` `brief` `template: drafter`, spawn, spot-check the context file.
- harness/skills/sdd-document-phase/references/briefs.md:6-113 — drafter brief text (passed as the `job` value).
- harness/skills/sdd-document-phase/references/briefs.md:18-34 — drafter load order; item 0 tells design and tasks drafters to start from the context file.
- harness/skills/sdd-document-phase/references/briefs.md:50-59 — the `## Codebase context` section: shape of `codebase-context.md`.
- harness/skills/sdd-document-phase/references/briefs.md:136-208 — reviewer round section appended to the adversarial-review scaffold (not a `brief` template).
- harness/skills/sdd-document-phase/references/briefs.md:210-292 — reviser brief.
- harness/skills/sdd-document-phase/references/briefs.md:294-348 — lint brief.
- harness/skills/sdd-document-phase/references/briefs.md:349-384 — adjudication brief.
- harness/skills/sdd-document-phase/references/briefs.md:386-409 — narrow-check prompt for `sdd-checker` (not a `brief` template).

## implementation and close-out skills (harness)
- harness/skills/sdd-implementation-phase/SKILL.md:14-19 — launch prompt keys; the orchestrator routes only.
- harness/skills/sdd-implementation-phase/SKILL.md:84-99 — per-task pick and implementer brief (`template: implementer`).
- harness/skills/sdd-implementation-phase/SKILL.md:136-159 — verifier, fix and adjudicator briefs per task.
- harness/skills/sdd-implementation-phase/SKILL.md:160-172 — step 6 complete: mark `[x]`, retro entry, HANDOFF, spec-store commit.
- harness/skills/sdd-implementation-phase/SKILL.md:209-216 — end-to-end verifier brief.
- harness/skills/sdd-closeout-phase/SKILL.md:108-119 — landing: `harness` and `code` batches land in a `chore/<SPEC>-retro` worktree.
- harness/skills/sdd-closeout-phase/SKILL.md:120-138 — batch brief (`template: reviser`), implementer spawn, per-item gate.
- harness/skills/sdd-closeout-phase/SKILL.md:139-159 — verifier, fix and adjudicator briefs per batch.

## graph artifacts and graphify CLI (outside the harness)
- .graphifyignore:1-15 — graph scope: excludes `.spec-workflow/`, `plugins/`, `graphify-out/`, `dist/`, media.
- .gitignore:166-167 — `graphify-out/` untracked.
- /home/mcf/.claude/scripts/graphify-hook-guard.sh:20-31 — global nudge wrapper: a worktree falls back to the main checkout's `graphify-out/graph.json`.
- /home/mcf/.pyenv/versions/3.14.0/lib/python3.14/site-packages/graphify/cli.py:1942-1996 — `graphify update`: exit 0 on success or no change, exit 1 on failure; blocks on the per-repo lock.
- /home/mcf/.pyenv/versions/3.14.0/lib/python3.14/site-packages/graphify/export.py:343-345 — `built_at_commit` is written from git HEAD when `graph.json` is written.
- /home/mcf/.pyenv/versions/3.14.0/lib/python3.14/site-packages/graphify/watch.py:756-772 — graph compare drops `built_at_commit` before comparing.
- /home/mcf/.pyenv/versions/3.14.0/lib/python3.14/site-packages/graphify/watch.py:1476-1500 — same topology: outputs left untouched, `built_at_commit` not advanced.
- /home/mcf/.pyenv/versions/3.14.0/lib/python3.14/site-packages/graphify/watch.py:1600-1610 — same graph and report: `graph.json` left untouched.

## docs
- docs/TOOLS-REFERENCE.md:547-579 — `harness` tool reference: `brief` and `usage` actions.
- docs/SDD-HARNESS.md:253-264 — workspace contract: spec store root, code root, worktree rule.

## Probes
- `graphify --version` prints `graphify 0.9.35`; `graphify --help` lists `explain`, `path`, `query --budget N` (default 2000), `update` with `--graph` on the read calls.
- `graphify explain "noSuchSymbolXyz"` prints "No node matching" and exits 0.
- `graphify-out/graph.json` here: 2,713 nodes, 8 of them under `harness/` (only `.sh` files); `built_at_commit` 9d3896c, 201 commits behind HEAD on 2026-09-25.
- `grep -rl graphify harness/ src/` finds nothing.
- `harness-activity.jsonl` of `agent-cache-ttl` holds 0 rows naming `graphify`.
- `graphify update` names communities with `label_communities_by_hub` (watch.py:1556-1557 in the installed package), no LLM call; `cli.py:1976` prints "no LLM needed".

## graph script precedents (design)
- harness/skills/sdd-continue/references/sdd-cache-ttl.sh:1-22 — shipped probe script: one stdout line, exits 0, `set -u` plus single-quoted `node -e` body.
- harness/skills/sdd-continue/SKILL.md:81-86 — `bash <base dir>/references/sdd-providers.sh` call shape in the roots step.
- harness/skills/sdd-continue/SKILL.md:262-269 — scratch-wipe recovery recreates the per-run scripts under the same run id.
- harness/skills/sdd-continue/references/formats.md:170-183 — `event.sh` text: `<type> key=value ...`, one confirmation line.
- harness/skills/sdd-continue/references/formats.md:192-204 — ledger event table; `run.start` keys on line 194.
- src/__tests__/providers-map.test.ts:17-34 — drives a references script with `execFileSync('bash', ...)`, asserts status, stdout, stderr.
- /home/mcf/.pyenv/versions/3.14.0/lib/python3.14/site-packages/graphify/cli.py:1942-1996 — `update` also reads `GRAPHIFY_FORCE` from the environment as `--force` (line 1943); `ok` false exits 1.
- /home/mcf/.pyenv/versions/3.14.0/lib/python3.14/site-packages/graphify/watch.py:158-164 — rebuild lock is `fcntl.flock`, released when the process is killed.
- /home/mcf/.pyenv/versions/3.14.0/lib/python3.14/site-packages/graphify/watch.py:985 — output dir is the path argument's `graphify-out/`.

## usage fold details (design)
- src/watch/ledger.ts:26-36 — `ActivityEvent`: `ts`, `agent`, `event`, `tool`, `summary`.
- src/watch/ledger.ts:176-189 — `parseJsonl`: skips blank and torn lines.
- src/watch/usage.ts:75-92 — `emptyCell` and `addCell`.
- src/watch/usage.ts:283-292 — live-phase window loop inside `reduceSpawn`.
- src/watch/__tests__/usage.test.ts:8-11 — `ce` helper fills the cache fields of a cell.
- src/watch/__tests__/usage.test.ts:320-355 — compare-table expectations: header, five-dash absent side, total lines.
- src/tools/__tests__/harness.test.ts:523-538 — usage test with a full-cell `toEqual` literal.
- src/tools/__tests__/harness.test.ts:587-598 — provider-less usage test with two full-cell `toEqual` literals.
- src/tools/harness.ts:76 — `values` property description of the tool schema.
- src/tools/harness.ts:568 — `brief` output-path check.
- src/tools/harness.ts:633-635 — `{{key}}` fill of the template body.

## orchestrator skill anchors (design)
- harness/skills/sdd-document-phase/SKILL.md:18-58 — standing rules; read-and-obey rule on 43-44.
- harness/skills/sdd-document-phase/SKILL.md:155-170 — Step 2 review round; round section written on 161-163.
- harness/skills/sdd-document-phase/SKILL.md:281-288 — Step 4b narrow check; prompt written on 283-286.
- harness/skills/sdd-document-phase/references/briefs.md:1-4 — fill rule for `<…>` conditionals.
- harness/skills/sdd-implementation-phase/SKILL.md:23-38 — standing rules; read-and-obey rule on 37-38.
- harness/skills/sdd-closeout-phase/SKILL.md:14-20 — launch keys the close-out orchestrator receives.
- harness/skills/sdd-closeout-phase/SKILL.md:25-34 — standing rules; read-and-obey rule on 33-34.
- .spec-workflow/specs/agent-cache-ttl/verification-evidence.md:1-10 — tracked live-evidence record shape.

## Probes (design)
- `graphify update` on a scratch copy of this repo (201 commits behind): 13.36 s, exit 0, `built_at_commit` equal to HEAD afterwards.
- `graphify explain "briefAction" --graph <abs path>` from `/tmp` works with the trailing `--graph` flag and prints `file:Lnnn` edges.
- node 24 `spawnSync` with `timeout`: `status` null, `signal` SIGTERM, `error.code` ETIMEDOUT; a missing binary: `error.code` ENOENT.
