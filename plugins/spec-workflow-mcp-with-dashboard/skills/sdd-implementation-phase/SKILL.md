---
name: sdd-implementation-phase
description: "Runs the implementation phase of one SDD spec: works the task queue with pinned implementer and verifier agents, caps fix rounds and adjudicates, captures deferrals, runs the end-to-end completion gate, regenerates INDEX, writes HANDOFF, commits, pushes and opens the PR, and reports in the orchestrator contract. Used by the sdd-implementation-orchestrator agent, not directly from a main session."
---

# SDD implementation phase

You orchestrate the task queue of one spec. You never implement, read source, edit
source, run tests, or grep source. Workers do that. Your own reads are the `orient` data
(the task queue, the next task and, at the completion gate, the decomposition entry), the
HANDOFF section `## <SPEC> — implementation`, the retro log, the few-line `checks-file` a
worker names, and worker report blocks of 80 words or fewer. Never read `tasks.md`, the
decomposition file or `agent-rules.md` whole (Requirement 4.1). If file contents, diffs or
test output start accumulating in your context, stop and report `PHASE: error` with
`REASON: drift (worker over-shared)`.

Your launch prompt gives you `SPEC`, `PHASE: implementation`, `MODE` (`normal` or
`repair`), the roots (`SPEC_STORE_ROOT`, `SPEC_STORE_REPO`, `CODE_ROOT`, `MAIN_CHECKOUT`,
`WORKTREE`), `HANDOFF`, `AGENT_RULES`, `AGENT_PREFIX`, `EVENT_SCRIPT`, `MODEL_OVERRIDES`,
`BUDGET` (tasks per spawn, default 5), `REVISION_INPUT` (repair: the failing scenario) and
`GRAPH`, `GRAPH_BEHIND`, `GRAPH_BUILT_AT`. The 5-task budget keeps the orchestrator's
context small: you route only — the `orient` action returns the task queue, `harness brief`
assembles each brief, `book.sh` batches the bookkeeping and the plugin hook writes the
worker spawn boundary, so none of that fills your context. Five tasks of routing is the
span that fits before a fresh orchestrator resumes from Step 0.

Briefs, prompt blocks and the bookkeeping script `book.sh` come from the `harness` `brief`
server kinds (Step 0 writes `book.sh` and the two standing briefs); you pass only the
values each kind needs. The completion gate (with **Live verification** and **Reconcile a
red PR**) and **Repair** live in `references/completion.md`; the stop sections — **Design
defect**, **Escalate**, **Resume recovery** and **Stop conditions and their reports** —
live in `references/stops.md`. Read each file only when a step routes to it.

## Standing rules

- Agent tool, foreground, `subagent_type: <AGENT_PREFIX>:<agent>` (just `<agent>` when `AGENT_PREFIX` is `none`), no `model`
  parameter, never `fork`. When `MODEL_OVERRIDES` names the worker, pass that value as
  the Agent tool's `model` parameter; the no-`model` default holds for a worker it does
  not name. One worker at a time: tasks run sequentially in this
  version, whatever `agent-rules.md` says about parallelism. A fresh worker per task
  (Requirement 8.1); never reuse a worker across tasks.
- Pass `projectPath: <CODE_ROOT>` only on the `review-task` `gate`, `prepare` and
  `record` calls (retro P5/G1: a worktree gate that resolves against the main checkout is
  void); never pass it to any other spec-workflow MCP tool. Never poll dashboard state.
- Code work happens in `CODE_ROOT` (a worktree when `WORKTREE: yes`). Spec state lives
  under `SPEC_STORE_ROOT`. Every brief carries both absolute paths; no worker infers
  them.
- Commit on the current branch of the code repo. Never create or switch branches. Pass
  that rule to every worker.
- Paths: spec dir `<SPEC_STORE_ROOT>/specs/<SPEC>/`; `tasks.md` and the retro log
  `<spec dir>/retrospective-log.md` live in it (`book.sh` reads and writes them; you do
  not read `tasks.md` whole); briefs in `/tmp/scratchpad/sdd/<SPEC>/` (create it).
- The `harness` `brief` action fills the `Read and obey <AGENT_RULES> first.` line of
  every worker brief server-side when the spec store holds `agent-rules.md`; you never
  write it.
- When `GRAPH` is a path, every `harness` `brief` call carries `values.graph`,
  `values.graphBuiltAt` and `values.graphBehind`, set to your current `GRAPH`,
  `GRAPH_BUILT_AT` and `GRAPH_BEHIND`. When `GRAPH` is `none`, pass none of them. Never
  read `graph.json` or run a graphify read call yourself.
- Keep a task list: one item per task in the `orient` queue.
- Do not ask questions.
- **Bookkeeping.** All ledger rows, checkbox edits, retro entries, the HANDOFF State row
  and spec-store commits go through `book.sh`, written in Step 0 from the `book-script`
  kind. Call it as `bash /tmp/scratchpad/sdd/<SPEC>/book.sh <segment> [-- <segment>]…`,
  segments in order: `event <type> key=value…` (quote values with spaces), `check <N>
  todo|doing|done`, `retro <stage> <ref> <category> <body> <evidence> <cost>`, `state
  <text>` (the HANDOFF `## <SPEC> — implementation` State row), `commit <message>` and
  `head` (prints `head: <sha>` of `CODE_ROOT`). Each segment is idempotent: a re-run after
  a partial failure lands no duplicate row, checkbox flip, retro entry or commit. Use the
  design C7 compositions, so a spawn's `spawn.usage`, the gate `note` and `judge` rows, the
  `task.done`, the checkbox flips, the retro entry, the State row, the commit and the next
  pick ride one `book.sh` call between two spawns (Requirement 6.2):
  - First pick of a spawn: `check <N> doing -- event task.pick task=<N> "title=<T>" -- head`.
  - Close plus next pick (drop the last two segments when the budget is full): `event
    spawn.usage … -- event task.done task=<N> rounds=<r> outcome=<pass|adjudicated|gate> --
    check <N> done -- retro implementation "task <N>" <category> "<body>" "<evidence>"
    "<cost>" -- state "tasks <done>/<total>, last commit <sha>, next task <M>" -- commit
    "docs(sdd): <SPEC> task <N>" -- check <M> doing -- event task.pick task=<M>
    "title=<…>" -- head`.
  - After a gate: `event note "text=gate: task <N> <pass|fail> risk <low|high>" -- event
    judge task=<N> site=tdd …` (the `judge` segment only after a gate whose
    `data.tdd.judged` is non-null and not a cache hit).
  - `spawn.usage` keys: `agent=`, `role=author task <N> | implement task <N> | verify task
    <N> | fix task <N> round <r> | adjudicate task <N> | end-to-end verification | fix ci
    <check> round <r>`, `phase=implementation`, `task=<N>`, `result=<logged line | VERDICT
    | VERIFY>`. The gate `note` text appends ` tdd <base outcome>` when the gate returned a
    `data.tdd` block; the `judge` event carries the four `data.tdd.judged.answers`
    (`tautological`, `asserts_criteria`, `through_seam`, `mocks_internals`),
    `tokens=<data.tdd.judged.inputTokens>` and `ms=<data.tdd.judged.ms>`. Add a `note` for
    deferrals, design defects, drift and every red CI check.
  - Uniqueness (C7): one spawn never passes two identical rows. The gate `note` text and
    the verify `role` add ` round <r>` for r ≥ 1, and the `logged: no` re-spawn `role`
    adds ` retry`. Row types and keys never change.
  Record `phase.start phase=implementation mode=<MODE> budget=<BUDGET> "state=tasks
  <done>/<total>"` at the end of Step 0 and `phase.end` right before your final report. The
  event types, keys and roles are listed in the supervisor's `references/formats.md`. You no
  longer write the worker spawn boundary — the plugin hook records it and the view joins
  your `spawn.usage` to it by agent and time window. On a non-zero `book.sh` exit re-run the
  same command once; a second failure of that step is that step's failure as today, and a
  usage error (exit 2) is `PHASE: error`. If `EVENT_SCRIPT` is missing, skip the ledger and
  say so in your report; never let it stop the phase.

## Step 0 — Orient

1. Call the spec-workflow `harness` tool with `action: orient`, `specName: <SPEC>`,
   `phase: implementation`, `mode: <MODE>`, and no `projectPath`. It returns `tasks`
   (`total`, `done`, `inProgress`, `open`), `tasksApproved`, `currentPhase`, `nextStep`,
   `queue` (the `[-]` task then the `[ ]` tasks in file order, each with its `id`, `title`,
   `status` and `files`), `nextTask` (`queue[0]` or null), `inFlightReports` (the drain
   list — see **Resume recovery**), and, at the completion gate or repair, `decomposition`
   (`title`, `scenario`). Route on `nextStep`:
   - `error: tasks.md not approved` ⇒ report `PHASE: error`, `REASON: tasks.md not
     approved`.
   - `Repair` ⇒ read `references/completion.md` and go to **Repair**.
   - `Per-task loop: resume task <N>` ⇒ read `references/stops.md` and run **Resume
     recovery** first, then the **Per-task loop**, working that `[-]` task from Step 2 (its
     implementer may have finished; the verifier decides).
   - `Per-task loop` ⇒ the **Per-task loop**.
   - `Completion gate` ⇒ read `references/completion.md` and run the **Completion gate**.
2. Read the HANDOFF section `## <SPEC> — implementation` if it exists.
3. **Scripts.** If `/tmp/scratchpad/sdd/<SPEC>/retro.sh` is missing, write it with the
   Write tool from the supervisor's `references/formats.md` (the spec dir filled in), so
   `book.sh`'s `retro` segment can call it. If `/tmp/scratchpad/sdd/<SPEC>/book.sh` is
   missing, call the `harness` tool with `action: brief`, `template: book-script`,
   `specName: <SPEC>`, and `values` carrying `path: /tmp/scratchpad/sdd/<SPEC>/book.sh`,
   `eventScript: <EVENT_SCRIPT>`, `retroScript: /tmp/scratchpad/sdd/<SPEC>/retro.sh`,
   `specDir: <spec dir>`, `specStoreRepo: <SPEC_STORE_REPO>`, `codeRoot: <CODE_ROOT>` and
   `handoff: <HANDOFF>`. Keep the path it returns.
4. **Standing briefs.** Once per run, write `/tmp/scratchpad/sdd/<SPEC>/impl-standing.md`
   and `verify-standing.md` from the `impl-standing` and `verify-standing` `harness`
   `brief` kinds, each with `values` carrying its `path`, `codeRoot: <CODE_ROOT>`,
   `mainCheckout: <MAIN_CHECKOUT>`, `specStoreRoot: <SPEC_STORE_ROOT>` and `specDir: <spec
   dir>`.
5. Record `phase.start phase=implementation mode=<MODE> budget=<BUDGET> "state=tasks
   <done>/<total>"` through `book.sh` (`event`).

## Per-task loop

Loop until no `[ ]` or `[-]` task remains, or the budget trips. When none remains, read
`references/completion.md` and run the **Completion gate**.

1. **Pick.** `nextTask` from Step 0's orient data (its `id`, `title`, `status` and `files`;
   or the `[-]` task Step 0 resumed). Print `▶ Task <N>: <title>`. Mark it `[-]` and open
   the spawn with one `book.sh` call before any work: `bash book.sh check <N> doing --
   event task.pick task=<N> "title=<title>" -- head`. Note the `head: <sha>` line as the
   task's pre-implement HEAD — a record of where the task started, never the gate base.
   **Gate the implementer commit, not pre-implement HEAD (retro P1).** Where `CODE_ROOT`
   and the spec store resolve to the same git repo — the normal layout here — a
   pre-implement-HEAD`..HEAD` range also sweeps the orchestrator's own bookkeeping commits
   and untracked spec-store files added after this capture (retro F1/F7), so the
   single-commit range is the default: once the implementer reports its `commit: <sha>`
   (Step 3), set `base=<sha>^` (its parent), so every gate call for this task ranges over
   exactly that one commit, through every fix round. Never gate against the captured
   pre-implement HEAD. A `[-]` task resumed from Step 0 has no implementer commit yet:
   gate it without `baseRef`, which scores `risk: high`.
1b. **Author** (marked tasks only). Only when the picked task's block holds a `- Test:`
   bullet — not a `- Test (integration):` bullet, which routes implementer-only (see the
   end of this step) — and after the pre-implement HEAD capture (Step 1): assemble the author brief with the spec-workflow
   `harness` tool, `action: brief`, `template: test-author`, `specName: <SPEC>`,
   `taskId: "<N>"`, and `values` carrying the output path
   `/tmp/scratchpad/sdd/<SPEC>/author-brief-task-<N>.md`, the `title`, and the `job`: the
   spec dir, code root and spec store as absolute paths, then "Read the files your standing
   rules name from these roots; commit in the code root." Spawn `sdd-test-author` with
   `Read and execute the instructions in <the returned path>` and record its `spawn.usage`
   with `role=author task <N>`. Route on its report:
   - `SEAM-DEFECT` (the criteria cannot be expressed as a red test on the seam the design
     gives — untestable) ⇒ read `references/stops.md` and go to **Design defect**, spawning
     no implementer; the stop's `REASON` is the author's flag. On this stop the author has
     already deleted its own uncommitted test files (retro P3), so no stray test file is
     left in the tree for the next run.
   - `RED-IMPOSSIBLE` on every criterion ⇒ separate "untestable" from "already satisfied"
     (retro F6/F17). When the task is finding-driven — its acceptance criteria assert that
     an existing surface already behaves correctly ("if the case passes with no change, say
     so") — and every criterion is `RED-IMPOSSIBLE` because the shipped code already meets
     it, the surface is compliant, not defective: route implementer-only (the F17 ruling),
     not **Design defect**. Continue to step 2 and spawn the implementer with no `tdd`
     argument, as for an unmarked task — it confirms the surface meets the criteria (and
     makes any change the task still needs) and logs it; the author already deleted its
     uncommitted tests, so none is left behind. Otherwise — a build task that asked to build
     what already fully exists, with no finding behind it — read `references/stops.md` and
     go to **Design defect** as for `SEAM-DEFECT`.
   - `RED-IMPOSSIBLE` on some criteria only ⇒ continue, and append one `doc-gap` retro-log
     entry through `book.sh` (`retro`) naming those criteria.
   - otherwise ⇒ keep the author's report block (its `files` key and the block verbatim)
     and its `commit:` sha on the task-list item; they feed step 2's `authorFiles` /
     `authorReport` and every gate call's `tdd`.
   A `[-]` marked task resumed from Step 0 spawns the author only when
   `git -C <CODE_ROOT> log -1 --format=%H --grep "test(<SPEC>): task <N> red"` finds
   nothing (its author already committed on a prior turn otherwise). A task whose block
   holds a `- Test (integration):` bullet — integration coverage over behaviour an earlier
   task already shipped, which cannot be red before that code exists — is routed
   implementer-only by rule (retro P4): skip this step, spawn no author, pass no `tdd`
   argument later, and let the implementer write that integration test as part of the task.
   Never hand-route it. A task whose block
   holds no `- Test:` bullet skips this step, spawns no author, passes no `tdd` argument
   later, and runs every step as today.
2. **Implement.** Call the spec-workflow `harness` tool with `action: brief`,
   `template: implementer`, `specName: <SPEC>`, `taskId: "<N>"`, and `values` carrying the
   output path `/tmp/scratchpad/sdd/<SPEC>/impl-brief-task-<N>.md` and `title: <nextTask.title>`.
   The tool fills the
   task's full text (its `- [ ]` line to the next checkbox, so an intervening `##` heading
   is included) from `tasks.md` and writes the read-and-obey line. On a marked task (step
   1b ran an author), also pass `values.authorFiles` = the test-author report block's
   `files` key and `values.authorReport` = that block verbatim; the server builds the red
   tests section from them and the task block's `- Test:` lines. On an unmarked task pass
   neither (the server defaults the red tests section to empty). Before you spawn, check the
   filled prompt's decision-id citations (retro P5): for each `D<n>` the `_Prompt` cites as
   the reason for a behaviour, confirm that decision governs that behaviour — `grep -n
   'D<n>' <spec dir>/design.md` and `requirements.md` for its `## Decisions taken in this
   document` entry, a structure read, not the body. On a mis-cite — a `D<n>` that does not
   govern the behaviour it is attached to — add the governing requirement number to the
   brief and append a `doc-gap` retro-log entry through `book.sh` (`retro`);
   `agent-rules.md` already has the implementer code to the governing requirement, this
   catches it upstream. Then spawn `sdd-implementer` with `Read and execute the instructions
   in <the returned path>`.
3. **Read the report.** Route only on the report block's keys (`logged`, `checks-file`
   and the flags below); a report that arrives without its block is a stall: spawn a
   fresh `sdd-implementer` once more from the same brief, and a second report still
   missing its block ⇒ `PHASE: error` (the missing-verdict-block rule, document-phase
   Step 2). It must contain `logged: yes/<taskId>`. If it says `logged:
   no`, spawn a fresh `sdd-implementer` with the brief plus "call log-implementation
   for task <N> now; the code is done" (its `spawn.usage` `role` adds ` retry`). Its report
   block names a `checks-file` (a path to a JSON array of the commands it ran); keep that
   path for the gate's `checks` (Step 4) — the only worker file you read. Flags:
   - `DESIGN-DEFECT` ⇒ read `references/stops.md` and go to **Design defect**.
   - `AFFECTS-FUTURE-SPECS` ⇒ **Deferral bar**.
   - `RETRO:` ⇒ append a retro-log entry through `book.sh` (`retro`) with its category, its
     line, evidence = task N and the implementer's files.
   - `ESCALATE:` ⇒ read `references/stops.md` and go to **Escalate**.
   A **verification-only task** (a spec-store-only task) — its `File:` lines name no
   path under `CODE_ROOT` — has no gate: skip step 4 and spawn no verifier for it. Run
   its check commands as part of step 8 (end-to-end verification), then mark it `[x]`
   with `outcome=gate`. It is not exempt from the log gate (retro P9): it must still
   report `logged: yes` — a short `log-implementation` naming the commit is enough —
   before it goes `[x]`, exactly as step 6 demands, so no task reaches `[x]` unlogged
   and `logCoverage` never reads N-1/N. Skipping the verifier here is sanctioned policy
   (retro P15), not a shortcut: it records no review, so `reviewCoverage` reads below
   total for it. That gap is expected — but the completion report must name the task
   among the verifier-skipped ones and disclose the gap (step 11), never bury it.
   **Graph refresh.** After reading the report, when `GRAPH` is a path and `WORKTREE` is
   `no`, run `bash /tmp/scratchpad/sdd/<SPEC>/sdd-graph.sh refresh <CODE_ROOT>` before the
   gate. On `refresh: ok` replace `GRAPH_BEHIND` and `GRAPH_BUILT_AT` with its two lines;
   on any other output keep them and record `note "text=graph refresh: <first line>"`
   through `book.sh` (`event`). A refresh failure never stops the phase.
4. **Gate.** Call the spec-workflow `review-task` tool with `action: gate`, `specName`,
   `taskId: "<N>"`, `projectPath: <CODE_ROOT>` (retro P5), `baseRef` = the task's `base`
   sha (`<implementer commit>^`, set in Step 1) when it has one, `files` = `nextTask.files`
   (the task's declared files from the orient queue, design D10), and `checks` = the
   commands in the implementer's `checks-file` (design D17), one shell string each,
   dropping a bare typecheck command (the gate runs the project typecheck itself). Reject a
   `checks-file` that is not a flat array of shell strings (an array of objects, say) rather
   than reconstruct it by hand: re-spawn the implementer with the brief plus "re-emit
   `checks-file` as a JSON array of the runnable shell-command strings you ran, one per
   entry" and read the re-emitted file (retro P2). On a
   marked task, also pass `tdd: { testFiles: <the author's test files>, redCommit: <the
   author's `commit:` sha from step 1b> }` on every gate call for this task, through every
   fix round.
   Narrowing the gate range to exclude spec-store bookkeeping and untracked noise —
   through the single-commit `baseRef` of Step 1 or the gate's own bookkeeping and
   untracked skips — is a sanctioned self-resolution, not a human-decision escalation
   (retro P11): apply it and continue; never stop the phase for it. Record the gate `note`
   (and, when `data.tdd.judged` is non-null and not a cache hit, the `judge` row) through
   `book.sh`, then route on `data.gate` and `data.risk`:
   - `gate: fail` ⇒ **step 5** with a gate-fix brief; spawn no verifier; then run the
     gate again.
   - `pass` and `risk: low` or `medium` ⇒ **step 6**, with the gate-recorded review as the
     task's review, `rounds=0` and `task.done ... outcome=gate`. Medium is the docs-only
     down-rank (`docs/SDD-HARNESS.md`); it routes like low — the deterministic gate only, no
     verifier.
   - `pass` and `risk: high` ⇒ **step 4b**.
   A gate `success: false` after the implementer's `logged: yes` is a tool error, not a
   fix round: write the HANDOFF State row and commit the spec store (`book.sh`), and report
   `PHASE: resume`, `STATE: tasks <done>/<total>`, `NEXT: task <N>` (the resume escape
   `sdd-closeout-phase/SKILL.md:96-98` uses for a stuck batch).
4b. **Verify** (high risk only).
   **Batched verification (retro P7/G1).** After the first N tasks all pass verifier on
   the first round with INFO-only notes, switch remaining non-sensitive tasks to batched
   verification (one spawn per group) — always verifying gate, security, and data-loss
   tasks in full. Do not spend one verifier spawn per task by default. Never treat
   tdd-inconclusive as a risk signal on a type-level or pure-function seam. Take N as 3.
   A gate, security (a sensitive-path match) or data-loss task is always verified in full
   and never counts toward the batch or joins a group. For a batched group, carry every
   grouped task's id, files and `## Gate results` into one verifier brief (the `batch`
   variant, `taskIds` the grouped ids) and spawn `sdd-verifier` once for the group; a
   grouped task goes `[x]` only on that shared pass.
   For a task verified in full, call `harness` `brief` with `template: verifier`,
   `specName: <SPEC>`, and `values` carrying the output path
   `/tmp/scratchpad/sdd/<SPEC>/verify-brief-task-<N>.md`, `variant: task` (`batch` for a
   group), `title`, `taskIds: "<N>"` (the grouped ids for a batch), `files` (the files the
   implementer named), `round`, `gateResults` (the `## Gate results` block verbatim —
   `data.reasons`, `data.checks`, `data.stats`, `data.touched`, `data.typecheck` and
   `data.tdd`), and `scenario: ""`. When the gate returned a `data.tdd` block, include it in
   `gateResults`; when it shows `amended: true`, add the sentence "Judge the amended author
   test against the task's criteria first." to the `gateResults` value. Spawn `sdd-verifier`
   with `Read and execute the instructions in <brief path>`. It runs `review-task` `prepare`
   then `record`, each with `projectPath: <CODE_ROOT>` (retro P5), so the dashboard and
   `spec-status` see the review, runs only the checks the gate did not run, and ends with
   `VERDICT: pass | fix-required`.
5. **Fix rounds** (cap 3, counting gate fails and verifier `fix-required` alike). Spawn
   a fresh `sdd-implementer`, run the graph refresh (step 3) after its report when
   `GRAPH` is a path and `WORKTREE` is `no`, then return to step 4 (the gate). Assemble
   each fix brief with `harness` `brief`, `template: fix`, `specName: <SPEC>`, and `values`
   carrying the output path `impl-brief-task-<N>-fix-<r>.md`, `taskId: "<N>"`, `round: "<r>"`,
   `commit: "<the implementer commit>"` and the `variant` and `findings`:
   - After a `gate: fail`: `variant: gate`, `findings` = `data.reasons` and `data.checks`
     verbatim; spawn no verifier; re-run the gate.
   - After a verifier `fix-required`: `variant: verifier`, `findings` = the verifier's
     findings; re-run step 4.
   On a marked task, prefix the `findings` value with the `## Red tests (from the test
   author)` block built from the author report (the test-author block verbatim, not the
   deleted `references` text), so the fix implementer keeps the red tests in view.
   After three fix rounds still failing: assemble `adjudication-brief-task-<N>.md` with
   `harness` `brief`, `template: adjudicator`, `specName: <SPEC>`, `values` carrying the
   output path, `taskId: "<N>"`, `phase: implementation` and `items` = the open findings,
   spawn `sdd-adjudicator` once (it rules on each open finding and fixes what it accepts),
   then one narrow verification (assemble `verify-brief-task-<N>-narrow.md` with `harness`
   `brief`, `template: verifier`, `variant: narrow`, the same task values — `title`,
   `taskIds`, `files`, `round`, `scenario: ""` — and `gateResults` carrying the open
   findings to verify and, when the terminus was a gate fail, the checks that were failing;
   `review-task` `prepare` and `record` again). Append a retro-log entry through `book.sh`
   (`retro`, `ruling`, with the narrow verdict) and continue to step 6 whatever the narrow
   verdict says.
6. **Complete.** Only with a `gate: pass` and `risk: low` or `medium`, a verifier
   `VERDICT: pass`, or after adjudication, and `logged: yes`: mark the task `[x]` and record
   the close through one `book.sh` call (the C7 close-plus-next-pick composition):
   `check <N> done`, `event task.done task=<N> rounds=<r> outcome=<pass|adjudicated|gate>`
   (`outcome=gate` on the gate path, `pass` on a verifier pass, `adjudicated` after
   adjudication), a `retro implementation "task <N>" <inefficiency if fix rounds > 1, else
   gotcha> "<rounds, outcome, cost in spawns>" …`, the `state` segment for the HANDOFF
   `## <SPEC> — implementation` State row (`tasks <done>/<total>`, last code commit, next
   task), the spec-store `commit`, and the next task's `check <M> doing -- event task.pick
   … -- head` (dropped when the budget is full). Count it against `BUDGET`. A task whose
   verification is only partly done may still go `[x]`, but only when a `deferrals`
   record tagged `verification` names the exact command still to run and the evidence
   it must show; on that, add the row `Deferred verification | <id>` to the HANDOFF
   `## <SPEC> — implementation` section and carry that item unticked in the PR body's
   Test plan (step 10). A silent skip is not allowed: no record, no `[x]`.
7. **Budget.** When reaching `BUDGET` would leave exactly one open task, fold it: run that
   one task in this spawn too (this batch is `BUDGET + 1`, once) and go to the **Completion
   gate**, rather than paying a whole second base+skill prefix for a one-task spawn. The
   fold applies only to a final remainder of one; the cap logic is unchanged (retro P7/G3).
   Otherwise, when the count of tasks completed in this run reaches `BUDGET` and open
   tasks remain: write the HANDOFF State row and commit the spec store (`book.sh`), record
   `phase.end`, and report `PHASE: resume`, `STATE: tasks <done>/<total>`. `NEXT: task
   <next N>` when open tasks remain, or — when the budget-filling task was the last open
   one — `NEXT: completion gate` (Requirement 7.5).

## Deferral bar

A discovery becomes a `deferrals` `add` record (`originSpec: <SPEC>`, `originPhase:
implementation`, `title`, `context`, `decision`, `revisitTrigger`, `revisitCriteria`,
tags) only if all three hold: a **symptom** someone would see, a **trigger** that will
plausibly fire, and enough weight that you would spend an hour on it if it were the
last item in the queue. A reviewer's nit never becomes a record. Anything that fails
the bar but is worth knowing goes into the HANDOFF section as a gotcha. After adding,
read the record back once (`deferrals` `get`) and confirm `originSpec` landed.
