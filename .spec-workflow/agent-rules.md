# Agent rules — spec-workflow-mcp

Read this before you touch the repository. It is short; obey all of it.

worktree-per-change: required
worktree-setup: `npm ci`; a task that runs a worktree Playwright e2e suite also runs `npx playwright install chromium` before it

## Layout

- Server source is `src/`. Tests sit in `__tests__/` directories next to the code
  (`vitest`). Templates the server ships are `src/markdown/templates/`.
- The SDD harness source of truth is `harness/` (agents, skills, hooks). `plugins/*` are
  generated copies; never edit them by hand and never read or review them:
  `npm run check:plugin-assets` proves they match `harness/`.
- Docs are `docs/`. `docs/SDD-HARNESS.md` describes the harness; `docs/TOOLS-REFERENCE.md`
  describes the MCP tools.
- Scratch files go under `/tmp/scratchpad/sdd/<spec>/`, never in the repository.

## Checks

Run each as its own command. Never run the Playwright e2e suites unless the task names them.

- Any change under `src/`: `npx tsc --noEmit`, then `npx vitest run <the test files of the
  modules you touched>`. Add or extend a test next to the module for every behaviour change.
- Any change under `harness/`: `node scripts/sync-plugin-assets.cjs` (commit the `plugins/`
  copies in the same commit), `npm run check:plugin-assets`, `claude plugin validate . --strict`.
- Any change to `package.json` version or plugin manifests: `npm run check:plugin-version`.
- Full suite, only at the end-to-end verification gate: `npm run build`, `npm test`.

CI runs node 20 (`.github/workflows/ci.yml:20`); local node is 24. A test that asserts on
`child_process`, `fs` or stream behaviour asserts only on fields the node 20 docs
guarantee, and the design says which.

## Git

- Use `/usr/bin/git` in scripts. A shell hook may rewrite a bare `git` or `diff`
  command and print a summary instead of the real output.
- Conventional commit messages, first line under 72 characters, no attribution trailers.
- Commit on the current branch only. Never create, switch or check out a branch; the
  supervisor enters a worktree for the spec before implementation.
- Never push except where the phase skill says to (the implementation orchestrator pushes
  once to open the PR). Never merge a pull request.
- In a worktree-isolated session the Edit and Write tools refuse paths under
  `.spec-workflow`, and the shell guard refuses `git` with `-C`, a glob or a compound line.
  Write files to `/tmp/scratchpad/sdd/<spec>/` and `cp` them into place on their own line,
  and run git as one plain `/usr/bin/git <verb> <args>` line or from a script written with
  the Write tool.

## PR body

- `## Summary` with three to six bullets, `## Test plan` with the checks run, no footer.
- The `## Summary` may add a `Not in this PR: …` bullet, built from the `Cut scope` rows
  of the document-phase HANDOFF sections.
- Forbidden terms in a PR body: none.

## Documents

- A task that edits a list, or text that states a count or a length, gives the command
  that finds every member (`grep -n …`) and says to update the count word.

## Run ledger

Only the supervisor creates or writes `/tmp/scratchpad/sdd/<spec>/event.sh`, its
`.runid` and the run's `harness-events.jsonl`. A spawned worker calls `EVENT_SCRIPT`
only to append rows; it never rewrites, re-initializes or repoints it. A task that
stages a scratch store with its own event script gives that script an explicit path
under the scratch store (`<scratch-store>/event.sh`) and must not reuse the
supervisor's `EVENT_SCRIPT` path.

## Sensitive paths

Machine-read by the review gate. A task that touches any of these is high risk.

- `src/core/approval-records.ts`
- `src/core/path-utils.ts`
- `src/tools/approvals.ts`
- `src/tools/review-task.ts`
- `harness/hooks/`
- `.github/workflows/`

## Generated paths

Machine-read by the review gate: changed lines under these paths do not count toward the
line rule.

- `plugins/`

## Prose paths

Machine-read by the review gate: changed `*.md` lines under these paths are prose, not
source; they do not count toward the line-count rule. A verifier still runs when a
sensitive path or a real source file exceeds the threshold.

- harness/skills/
- harness/agents/
- references/
