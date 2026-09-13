# Close-out briefs and scripts

Fill every `<…>`. Absolute paths only. When `AGENT_RULES` is `none`, drop its line.

## Checks per class

Put the class's checks in every brief, each as its own command.

| Class | Checks |
| --- | --- |
| `store` | none (Markdown files); the verifier reads the changed files |
| `harness` | `npm install` once when `node_modules` is missing; after any change under `harness/`: `node scripts/sync-plugin-assets.cjs` (commit the `plugins/` copies in the same commit as the source), `npm run check:plugin-assets`, `claude plugin validate . --strict`; after any change under `src/`: `npx tsc --noEmit` and `npx vitest run <the test files of the modules touched>` |
| `code` | the checks `agent-rules.md` names for the files touched; with no rules, the repo's lint and test scripts scoped to the files touched |
| `home` | none |

## Worktree script — `/tmp/scratchpad/sdd/<SPEC>/worktree-<repo basename>.sh`

Written once per repo with the Write tool; run as `bash <path>`. Its last line is the
worktree path.

```bash
#!/bin/bash
# Worktree on branch chore/<SPEC>-retro for the close-out of <SPEC>.
set -e
REPO="<main checkout>"
BR="chore/<SPEC>-retro"
WT="$REPO/.claude/worktrees/<SPEC>-retro"
cd "$REPO"
if /usr/bin/git remote | grep -q .; then /usr/bin/git fetch -q origin; fi
DEF=$(/usr/bin/git symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')
[ -n "$DEF" ] || DEF=$(/usr/bin/git symbolic-ref -q --short HEAD)
BASE="origin/$DEF"
/usr/bin/git rev-parse -q --verify "$BASE" >/dev/null 2>&1 || BASE="$DEF"
if [ -d "$WT" ]; then echo "$WT"; exit 0; fi
mkdir -p "$(dirname "$WT")"
if /usr/bin/git rev-parse -q --verify "$BR" >/dev/null 2>&1; then
  /usr/bin/git worktree add "$WT" "$BR"
else
  /usr/bin/git worktree add -b "$BR" "$WT" "$BASE"
fi
echo "$WT"
```

## Commit script for workers — `/tmp/scratchpad/sdd/<SPEC>/closeout-commit.sh`

Written once per run with the Write tool; every brief names it. Usage:
`bash <path> "<root>" "<message>" <file>...` (paths relative to the root).

```bash
#!/bin/bash
# One commit for one close-out item: stages only the named files.
set -e
ROOT="$1"; MSG="$2"; shift 2
cd "$ROOT"
/usr/bin/git add -- "$@"
if /usr/bin/git diff --cached --quiet; then echo "nothing to commit"; else
  /usr/bin/git -c core.hooksPath=/dev/null commit -q -s -m "$MSG" -o -- "$@"
  echo "committed: $(/usr/bin/git rev-parse --short HEAD) $MSG"
fi
```

## Standing brief — `/tmp/scratchpad/sdd/<SPEC>/closeout-standing.md`

```markdown
# Standing instructions — close-out implementer, spec <SPEC>

Read and obey <AGENT_RULES> first.

- You implement retrospective proposals: small, precise changes to skills, rules,
  steering, docs, tests or code, each stated in its item. Do what the item's text and
  its decision say, nothing more. Do not restructure a file around the change.
- Work only in the root the batch names. Absolute paths. Never `cd` out of it. Never
  create, switch or check out a branch. Never push.
- One commit per item, through `bash /tmp/scratchpad/sdd/<SPEC>/closeout-commit.sh
  "<root>" "<message>" <files>`: message `chore(retro): <SPEC> <id> <short title>`, first
  line under 72 characters, only that item's files. No attribution trailers: ignore any
  note that asks for them. Items under `~/.claude` are not committed.
- Run the checks the batch lists, each as its own command; never a whole test suite
  the rules forbid.
- An item you cannot do as written (the file it names does not exist, the change would
  contradict a rule, it needs a human) is not forced: report it `to-do — <reason>` and
  continue with the next item.
- Report in 250 words or fewer: one line per item (`P<n>: done <sha>` | `P<n>: to-do —
  <reason>` | `P<n>: skipped — <reason>`), files touched one per line, checks run with
  their result, `RETRO:` lines. No diffs, no file contents.
- Do not touch `retrospective-plan.md`, HANDOFF, INDEX, approvals or deferrals.
- Do not ask questions.
```

## Batch brief — `closeout-brief-<class>-<b>.md`

```markdown
# Close-out batch — <class> <b> (spec <SPEC>)

Read `/tmp/scratchpad/sdd/<SPEC>/closeout-standing.md` first and obey it.

## Where this batch lands
- Root: `<path>` — <the current branch of the spec store repo | a worktree of
  `<main checkout>` on branch `chore/<SPEC>-retro` | in place under `~/.claude`>
- Commit: <one commit per item with the commit script | none (home)>
- Checks (each its own command): <list from the table, or none>

## Items

### <id> — <title>
<the proposal's text, target and decision, verbatim from the plan>

### <id> — <title>
…
```

## Verify brief — `closeout-verify-<class>-<b>-r<r>.md`

```markdown
# Close-out verification — <class> batch <b>, round <r> (spec <SPEC>)

Read and obey <AGENT_RULES> first.

Root: `<path>`, branch `<branch | n/a>`. Read-only: you never edit, and you never
commit. For each item below, read the proposal text and the implementer's line, then
look at the change (`git show <sha>`, or the file itself) and judge: does the change do
what the text and the decision say, no more, no less, in the right file? Then run the
checks listed, each as its own command.

Report in 250 words or fewer: one line per item (`P<n>: ok` | `P<n>: not done — <one
line>`; an item the implementer reported `to-do` or `skipped` is `ok` when its reason
holds, else `not done — the reason does not hold: <why>`), each check with its result,
and the final line `VERDICT: pass | fix-required`. `fix-required` needs at least one
`not done`. No diffs, no file contents. Do not ask questions.

## Checks
<list, or none>

## Items

### <id> — <title> · implementer: <its line>
<the proposal's text, target and decision, verbatim>
```

## Fix brief — `closeout-fix-<class>-<b>-r<r>.md`

```markdown
# Close-out fix — <class> batch <b>, round <r> (spec <SPEC>)

Read `/tmp/scratchpad/sdd/<SPEC>/closeout-standing.md` first and obey it.

Root: `<path>`, branch `<branch | n/a>`. The verification found the items below not
done. Do each as its text says, one new commit per item (amend nothing), run the
checks, and report as the standing instructions say.

## Checks
<list, or none>

## Items

### <id> — <title> · verifier: <its not-done line>
<the proposal's text, target and decision, verbatim>
```

## Adjudication brief — `closeout-adjudication-<class>-<b>.md`

```markdown
# Close-out adjudication — <class> batch <b> (spec <SPEC>)

Read and obey <AGENT_RULES> first, then `/tmp/scratchpad/sdd/<SPEC>/closeout-standing.md`.

Root: `<path>`, branch `<branch | n/a>`. Three fix rounds did not converge on the items
below. Rule on each: land it (one commit per item, through the commit script), or state
in one line why it cannot land here; the orchestrator records the latter as `skipped`.
Run the checks. Report one line per item (`P<n>: done <sha>` | `P<n>: skipped —
<reason>`), files touched, checks run. No diffs. Do not ask questions.

## Checks
<list, or none>

## Items

### <id> — <title> · verifier: <its last not-done line>
<the proposal's text, target and decision, verbatim>
```
