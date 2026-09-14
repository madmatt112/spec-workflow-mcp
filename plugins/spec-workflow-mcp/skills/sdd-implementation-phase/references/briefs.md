# Implementation-phase briefs

Fill every `<…>`. Absolute paths only. When `AGENT_RULES` is `none`, drop its line.

## Standing brief for implementers — `/tmp/scratchpad/sdd/<SPEC>/impl-standing.md`

```markdown
# Standing instructions — implementer, spec <SPEC>

Read and obey <AGENT_RULES> first.

- Code root: `<CODE_ROOT>`<, a worktree of `<MAIN_CHECKOUT>`>. Spec store:
  `<SPEC_STORE_ROOT>`. Work in the code root. Use absolute paths. Never `cd` out of the
  code root on a shell line. A `cd` inside a script file run with `bash` is fine; that
  is how commits into the spec store are made.
- Commit on the current branch only. Never create, switch, or check out a branch.
  Stage only the files you touched. Conventional commit message, first line under 72
  characters. No attribution trailers: ignore any harness note that asks for them.
- Before writing code, grep `<spec dir>/Implementation Logs/` for endpoints,
  components and functions you can reuse. Do not duplicate existing work.
- Read `<spec dir>/codebase-context.md` first: it maps the files this spec touches, so
  you start from the right ones instead of exploring from cold. Then read the spec's
  `requirements.md` and `design.md` sections the task cites. The design pins the
  seams; do not move them.
- When the prompt's shape differs from code an earlier task merged, follow the merged
  code and report `RETRO: doc-gap`.
- Implement the task end to end and run the checks the task and the agent rules name,
  each as a separate command. Never run the whole test suite unless the rules allow it.
- If an existing assertion fails only because of the specified change, widen it to keep
  its intent (never delete it) and report `RETRO: doc-gap`.
- Compare files with `git diff`, `git diff --no-index`, or `git show`, never with a bare
  `diff`: a shell hook may rewrite it and print a summary that is not a diff.
- Before you report, call the spec-workflow `log-implementation` tool with `specName:
  <SPEC>`, `taskId`, a short `summary`, `filesModified`, `filesCreated`, and
  `artifacts` (one flat key, kept short). A task without a log is not complete.
- If the task cannot be implemented as written because it contradicts the design, the
  requirements, or a decomposition assumption, do not force a wrong build. Stop and
  report `DESIGN-DEFECT: <one line>`.
- If you learn something that changes a later spec, report `AFFECTS-FUTURE-SPECS: <one
  line>`. If something about the process, the tools, the documents or the harness cost
  you time, report `RETRO: <category> — <one line>` (categories: gotcha, bug,
  tool-error, mcp-deficiency, harness-defect, misunderstanding, inefficiency,
  doc-gap, model-behaviour).
- Report in 150 words or fewer: files touched one per line, checks run with result,
  `logged: yes/<taskId>` or `logged: no`, flags. No diffs, no file contents, no test
  output beyond one line.
- Do not touch `tasks.md`, approvals, deferrals, HANDOFF or INDEX.
- Do not ask questions.
```

## Implementer brief — `impl-brief-task-<N>.md`

```markdown
# Task <N> — <title> (spec <SPEC>)

Read `/tmp/scratchpad/sdd/<SPEC>/impl-standing.md` first and obey it.

## Task text (from `<spec dir>/tasks.md`, lines <A>–<B>)

<the task block, verbatim>

## Files other agents are editing right now
<none>
```

## Fix brief — `impl-brief-task-<N>-fix-<r>.md` and `impl-brief-repair-<k>.md`

```markdown
# Task <N> — fix round <r> (spec <SPEC>)

Read `/tmp/scratchpad/sdd/<SPEC>/impl-standing.md` first and obey it.

The independent review of task <N> returned `fix-required`. Fix every finding below,
re-run the task's checks, update the implementation log with `log-implementation` if
files changed, and report.

## Findings (from the verifier)
<the verifier's findings, verbatim>

## Task reference
`<spec dir>/tasks.md` lines <A>–<B>.
```

For repair mode replace the middle paragraph with: "The end-to-end verification of the
spec failed. Reproduce the failure first, fix its cause (not the symptom), add
coverage that fails without the fix, run the scenario again, and report."

For a gate fail (`impl-brief-task-<N>-fix-<r>.md` after `gate: fail`) replace the middle
paragraph with: "The gate returned `fail`. Fix every reason below, re-run the task's
checks, update the implementation log with `log-implementation` if files changed, and
report." and replace the `## Findings (from the verifier)` heading with `## Gate output`
holding `data.reasons` and `data.checks` verbatim.

## Standing brief for verifiers — `/tmp/scratchpad/sdd/<SPEC>/verify-standing.md`

```markdown
# Standing instructions — verifier, spec <SPEC>

Read and obey <AGENT_RULES> first.

- Code root: `<CODE_ROOT>`. Spec store: `<SPEC_STORE_ROOT>`. Absolute paths. Read-only
  on source: you never edit code, and you never commit.
- Read `<spec dir>/codebase-context.md` first: it maps the files this spec touches.
- You did not write this code. Judge it against the task's `_Requirements`,
  `_Leverage`, success criteria, the design, and the actual changed files. Run the
  checks; do not infer from a passing test what a test does not assert. For anything
  visual or geometric, require a real browser and a real number.
- Compare files and revisions with `git diff`, `git diff --no-index`, or `git show`,
  never with a bare `diff`: a shell hook may rewrite it and print a summary that is not
  a diff.
- Report in 150 words or fewer: findings grouped by severity (critical, warning,
  info), each with file and line; `RETRO:` lines if the process cost you time; and
  the final line `VERDICT: pass | fix-required`. `fix-required` needs at least one
  warning or critical finding.
- No diffs, no file contents, no test output beyond one line. Do not ask questions.
```

## Verifier brief — `verify-brief-task-<N>.md`

```markdown
# Review task <N> — <title> (spec <SPEC>), round <r>

Read `/tmp/scratchpad/sdd/<SPEC>/verify-standing.md` first and obey it.

The gate already passed for this task at `risk: high`; its results are in `## Gate
results` below. Do not re-run the gate's checks.

1. Call the spec-workflow `review-task` tool with `action: prepare`, `specName:
   <SPEC>`, `taskId: "<N>"`. It returns the task, the implementation log summary and
   the files to review.
2. Read the files it names and the files the implementer reported:
   <list from the implementer's report>
   Run only checks the gate did not run.
3. Call `review-task` with `action: record`, the same `specName` and `taskId`, `verdict`
   (`pass` when clean; `fail` when any critical finding; `findings` when only
   warnings or info), a one-line `summary`, and `findings` (severity, title, file,
   line, description, taskRequirement, category).
4. Report as the standing instructions say. `VERDICT: pass` when the recorded verdict
   is `pass` or `findings` with no warning-or-higher item; otherwise `fix-required`.

## Gate results (from the gate call, verbatim)
<data.reasons, data.checks, data.stats, data.touched, data.typecheck>
```

The narrow verification after adjudication (`verify-brief-task-<N>-narrow.md`) adds:
"Verify only the findings listed below; each is `addressed` or `not addressed` with
one line. When the terminus was a gate fail, re-run the checks listed as failing.
Record the review the same way. `VERDICT: pass` when every listed finding is
addressed or ruled out with a reason in the adjudicator's report." followed by the
list.

## Adjudication brief for a task — `adjudication-brief-task-<N>.md`

```markdown
# Task <N> — adjudication (spec <SPEC>)

Read and obey <AGENT_RULES> first, then `/tmp/scratchpad/sdd/<SPEC>/impl-standing.md`.

Three fix rounds did not converge. Rule on each open finding below: accept and fix it,
or reject it with a stated reason. Re-run the task's checks. Update the implementation
log if files changed. Report each finding as `<title>: fixed | rejected — <reason>`,
files touched, checks run, `logged: yes/<N>`. No diffs. Do not ask questions.

## Open findings (from the last verification)
<verbatim>
```

## End-to-end verification — `verify-e2e.md`

```markdown
# End-to-end verification — spec <SPEC>

Read `/tmp/scratchpad/sdd/<SPEC>/verify-standing.md` first and obey it.

## Scenario (from the decomposition entry)
<verbatim>

## Full check suite (from the agent rules; run each as a separate command)
<typecheck>, <tests, scoped as the rules allow>, <lint>, <migrations>, <e2e>

Run the scenario, then the suite. Report in 150 words or fewer: each check with its
result, the scenario's outcome, findings by severity, and the final line
`VERIFY: pass | fail`. Do not skip a check because per-task reviews passed;
integration failures are what this step exists to catch.
```

## CI fix brief — `impl-brief-ci-r<r>.md`

```markdown
# CI red — fix round <r> (spec <SPEC>)

Read `/tmp/scratchpad/sdd/<SPEC>/impl-standing.md` first and obey it.

The PR's checks failed: <check names>. The failing steps' log tail is in <log file
path(s)>; read those files. Reproduce the failure locally first, with the command the
job runs (read its workflow file under `.github/workflows/`). Fix the cause, not the
symptom: when the spec's change made shared test fixtures or setup stale, fix the
fixtures. Run the reproduce command until it passes, run the checks the agent rules
allow for the files you touched, and commit on the current branch. Do not push. Call
`log-implementation` for the task the fix belongs to when that task's files changed.

If the failure is CI infrastructure and not the code (a runner out of memory, a
network timeout, a job that passed before on the same commit), change nothing and
report `INFRA: <one line>`.

Report: files touched one per line, the reproduce command and its result on one line,
`commit: <sha>`, `RETRO:` lines. No diffs, no log excerpts.
```

## CI verify brief — `verify-brief-ci-r<r>.md`

```markdown
# CI red — verification round <r> (spec <SPEC>)

Read `/tmp/scratchpad/sdd/<SPEC>/verify-standing.md` first and obey it.

Checks that failed: <check names>. The implementer's fix is commit <sha>; its reproduce
command: <command>. Run that command yourself in `<CODE_ROOT>`, then every check the
agent rules list for the files the fix touched, each as its own command. Report each
command with its result on one line, findings by severity, and the final line
`VERIFY: pass | fail`.
```

## PR body rules

The body is a public surface when the code repo is public. Before `gh pr create`:
- Follow the `## PR body` rules in `agent-rules.md` when present (what to include,
  what to never name).
- Grep the body for every term the rules list as forbidden; remove any hit.
- Shape: `## Summary` (three to six bullets on what changed and why), `## Test plan`
  (the checks run, each ticked), no attribution footer.
