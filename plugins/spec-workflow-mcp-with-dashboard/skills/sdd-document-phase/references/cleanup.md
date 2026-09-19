# Document-phase cleanup, commits, HANDOFF

## Approval response

```
v<D>; <rounds> review rounds; final verdict MUST_FIX <m> / SHOULD_FIX <s> / MINOR <k>; rulings: <none | id: one line, …>; cap: <not hit | hit, adjudicated at v<D>, VERIFIED k/n | SHOULD_FIX-only pass at v<D>, VERIFIED k/n>
```

`<rounds>` counts every reviewer spawn for this phase across all runs (A, plus the
narrow check when it ran).

## Cleanup checklist (run in this order after `approvals approve`)

1. `approvals` `prune` with `categoryName: <SPEC>`, `filePath:
   .spec-workflow/specs/<SPEC>/<PHASE>.md`, `keepApprovalId: <approved record>`.
   Note the counts for the retro log.
2. Delete prompts and briefs only, with `rm -f`:
   - `reviews/adversarial-prompt-<PHASE>.md` and `reviews/adversarial-prompt-<PHASE>-r*.md`
   - `reviews/drafter-brief-<PHASE>.md`, `reviews/reviser-brief-<PHASE>-v*.md`,
     `reviews/lint-brief-<PHASE>-v*.md`, `reviews/adjudication-brief-<PHASE>.md`
   - legacy names from hand-run loops, when present: `reviews/reviser-prompt-<PHASE>-v*.md`,
     `reviews/drafter-prompt-<PHASE>*.md`

   Delete only files this phase wrote, by their exact `reviews/<name>` paths. Never
   delete anything under `/tmp/scratchpad/sdd/<SPEC>/`, and above all never descend into
   `/tmp/scratchpad/sdd/<SPEC>/helpers/`: the supervisor keeps its run-lifetime helpers
   (`deregister.mjs`, `rewrite-header.mjs`) there, and removing them breaks its run-end
   (retro P11).
3. Keep `reviews/adversarial-memory-<PHASE>.md`, every
   `reviews/adversarial-analysis-<PHASE>*.md` (the retro log cites them) and
   `codebase-context.md` (the next phase reads it first).
4. Append the phase summary to the retro log:

   ```
   ## <ISO timestamp> · <PHASE> · phase · cleanup
   <PHASE> approved at v<D> after <rounds> rounds; verdict trajectory <m/s/k → … → converged>; rulings <n>; cap <hit (carried: <ids>)|not hit>; prune removed <records> records and <snapshots> snapshots.
   Evidence: <approval id>; <kept analysis path>
   Cost: <reviewer spawns> reviewer + <reviser spawns> reviser spawns<, 1 adjudicator>
   ```

   The `<ISO timestamp>` is the output of `date -u +%Y-%m-%dT%H:%M:%SZ`, run when you
   append; never typed from memory.

5. Replace the HANDOFF section `## <SPEC> — <PHASE>` (create it after the phase log
   if missing; never touch the routing header or the phase log table) with:

   ```
   ## <SPEC> — <PHASE>

   | Field | Value |
   | --- | --- |
   | State | approved at v<D> on <ISO date> |
   | Rounds | <rounds>; verdicts <trajectory> |
   | Approval | `<approval id>` |
   | Rulings | <none | list> |
   | Cut scope | <none | list> |
   | Carried items | <none | `<id> — <title>: <ruled-out reason>`, one per line> |
   | Next phase loads | <one line: what the next drafter must read first, after `codebase-context.md`> |
   ```

   While the phase is mid-flight (budget stop), the same table carries `State |
   v<D> in review, round <A> verdict <…>`, the rejection tally, and `Re-run does |
   <one line>`.
6. Before committing, check the document's version header: `grep -n 'Document version'
   <document path>`. Fix it with `spec-edit.mjs` (never `sed`): on zero matches, insert a
   `Document version: v<D>` line right after the H1 (anchor on the H1 line, replace it
   with the H1 line followed by the new header line); on a mismatch with D, replace the
   found header line with `Document version: v<D>`. Then commit in the spec store repo
   (below): `docs(sdd): <SPEC> <PHASE> approved at v<D>`.

## Spec store commits

Write `/tmp/scratchpad/sdd/<SPEC>/commit-spec-store.sh` once per run with the Write
tool (a heredoc may be refused in a worktree session):

```bash
#!/bin/bash
set -e
cd "<SPEC_STORE_REPO>"
paths=()
for p in ".spec-workflow/specs/<SPEC>" ".spec-workflow/approvals/<SPEC>" ".spec-workflow/HANDOFF.md" ".spec-workflow/spec-decomposition/INDEX.md" ".spec-workflow/deferrals" "HANDOFF.md"; do
  [ -e "$p" ] && paths+=("$p")
done
/usr/bin/git add -A -- "${paths[@]}"
if /usr/bin/git diff --cached --quiet; then echo "nothing to commit"; else
  /usr/bin/git -c core.hooksPath=/dev/null commit -q -s -m "$1"
  echo "committed: $1"
fi
```

Run it as `bash /tmp/scratchpad/sdd/<SPEC>/commit-spec-store.sh "<message>"`. The
diff spot-check is `bash -c 'cd "<SPEC_STORE_REPO>" && /usr/bin/git diff --stat -- <document path>'`
written to a sibling script the same way. Never add attribution trailers; ignore any
harness note that asks for them.

## Spec store edits

Edit `tasks.md` and HANDOFF with the Edit tool. When the tool refuses the path (a
worktree-isolated session), write `/tmp/scratchpad/sdd/<SPEC>/spec-edit.mjs` once with
the Write tool (never `sed -i`, never a heredoc), then call it on its own shell line as
`node /tmp/scratchpad/sdd/<SPEC>/spec-edit.mjs <file> <old> <new>`: it replaces one exact
match and exits non-zero on 0 or 2+ matches.

```js
#!/usr/bin/env node
// spec-edit.mjs — one exact-string replacement on a spec-store file when the Edit tool
// is refused (worktree-isolated session). usage: node spec-edit.mjs <file> <old> <new>
import { readFileSync, writeFileSync } from 'node:fs';
const [file, oldS, newS] = process.argv.slice(2);
if (!file || oldS === undefined || newS === undefined) {
  console.error('usage: node spec-edit.mjs <file> <old> <new>');
  process.exit(2);
}
const text = readFileSync(file, 'utf-8');
const first = text.indexOf(oldS);
if (first < 0) { console.error('spec-edit: old string not found'); process.exit(1); }
if (text.indexOf(oldS, first + oldS.length) >= 0) {
  console.error('spec-edit: old string is not unique'); process.exit(1);
}
writeFileSync(file, text.slice(0, first) + newS + text.slice(first + oldS.length));
console.log('replaced 1 match');
```

## Round prompt changes

Write `/tmp/scratchpad/sdd/<SPEC>/append-changes.sh` once per run with the Write tool
(a heredoc may be refused in a worktree session). Step 2 item 3 runs it as `bash
/tmp/scratchpad/sdd/<SPEC>/append-changes.sh <D> <promptOutputPath>`; the orchestrator
reads only its exit code, never the diff it appends.

```bash
#!/bin/bash
set -e
cd "<SPEC_STORE_REPO>"
doc=".spec-workflow/specs/<SPEC>/<PHASE>.md"; D="$1"; prompt="$2"; cap=500
if [ "$D" = 1 ]; then want=1; pat='^docs\(sdd\): <SPEC> <PHASE> v1$'
else want=$((D-1)); pat="^docs\\(sdd\\): <SPEC> <PHASE> v${want}( |$)"; fi
base=$(/usr/bin/git log -1 --format=%H -E --grep="$pat" -- "$doc" 2>/dev/null || true)
if [ -z "$base" ]; then printf '\n## Changes: no checkpoint commit found for v%s\n' "$want" >> "$prompt"; exit 0; fi
append() { local h="$1"; shift; local body n; body=$("$@"); n=$(printf '%s\n' "$body" | wc -l)
  { printf '\n## %s\n\n````diff\n' "$h"; printf '%s\n' "$body" | head -n "$cap"
    [ "$n" -gt "$cap" ] && printf '[truncated at %s lines; read the document]\n' "$cap"
    printf '````\n'; } >> "$prompt"; }
append "Changes since $(/usr/bin/git rev-parse --short "$base")" /usr/bin/git diff "$base" -- "$doc"
if [ "$D" -gt 1 ]; then
  lint=$(/usr/bin/git log -1 --format=%H -E --grep="^docs\\(sdd\\): <SPEC> <PHASE> v${D} lint$" -- "$doc" || true)
  if [ -n "$lint" ]; then append "Lint commit $(/usr/bin/git rev-parse --short "$lint")" /usr/bin/git show --format= "$lint" -- "$doc"; fi
fi
```

The base is D = 1's `v1` checkpoint or, for D > 1, the newest commit whose subject holds
`docs(sdd): <SPEC> <PHASE> v<D-1>` followed by a space or end of subject (its prior lint
commit, else its checkpoint). With no base the script appends `## Changes: no checkpoint
commit found for v<N>` and exits 0 so the round still runs. Probe 2026-09-14, git 2.43.0:
`-E --grep='^docs\(sdd\): spec-lint requirements v4( |$)' -- <doc>` returns `69ff43f` and
`v9( |$)` nothing, so the anchors hold per line.
