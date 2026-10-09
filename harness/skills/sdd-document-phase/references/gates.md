# Document-phase gates

The gate steps the core skill routes to: **Gate A** from Step 1 item 6 (requirements,
`MODE: normal`), the **Design scope-cut gate** from Step 5 (design, `MODE: normal`), and
**Gate B** from Step 6 (tasks, `MODE: normal`). All bookkeeping — ledger rows, retro
entries, commits — goes through `book.sh` as the core skill's **Bookkeeping** rule
describes.

## Gate A — emit after the v1 lint (requirements, `MODE: normal` only)

Reached from Step 1 item 6, right after the Lint step, only in the `requirements` phase
and only in `MODE: normal`. A resume never reaches it: once v1 is checkpointed Step 0's
`nextStep` is `Step 2`, `Step 3` or `Step R`, never `Step 1`, so a review round or a
revision pass never re-emits gate A (Req 2 AC 3). The drafter already wrote the ranked
gate-A triples to the server surface when it drafted v1 (`sdd-drafter` gate-A step); you
never read them and never read the document body.

1. **Reword trigger.** This pass's fixed findings are `LINT.findings` minus `LINT.open`
   (both on your task list from the Lint step; when `LINT = skipped` there are none).
   From `grep -n '^#' <document>` take the line range of the `## Decisions taken in this
   document` section — its heading line through the line before the next `^#` heading (or
   end of file). Structure read only; never read the section body.
2. **Re-spawn the drafter if a fix landed there.** If any fixed finding's `line` falls
   inside that range, a lint fix may have reworded a ranked decision and the surface is
   stale. Write the gate-A re-spawn brief with `harness` `brief` (`template: gate-a`,
   `specName: <SPEC>`, `values` carrying `path: reviews/gate-a-brief-requirements.md`,
   `docPath: <document path>`, and the graph values when `GRAPH` is a path) and spawn
   `sdd-drafter` with `Read and execute the instructions in <brief path>`; it re-reads the
   lint-corrected section, re-extracts and re-ranks the full set, and re-`put`s the
   complete list (`gate put` overwrites the whole file). Record one `spawn.usage` with
   `role="gate-a v1"` from its report through `book.sh` (`event`). If no fixed finding
   falls in the range, skip this — the v1 surface still holds.
3. Record `phase.end phase=requirements result=gate-a state=v1` through `book.sh`
   (`event`), then report `PHASE: gate-a`, `STATE: v1`,
   `NEXT: run gate A, then re-spawn requirements`. Do not run Step 2; the supervisor
   resolves gate A and re-spawns the phase.

## Scope added after Gate A approval (requirements, `MODE: normal`)

Once the human has approved Gate A, the approved requirements are frozen. A later revision
that introduces a new requirement (a `### Requirement` heading absent at Gate-A approval)
is new scope, not a reopening of an approved one. Do not reopen the approved requirement in
place and do not let the late addition blow the round cap (retro P13).

Option (a): open a fresh scoped round for the added requirements only. Reset the round
counter (Step 2 item 1) for them and review and revise only the added requirements; leave
the Gate-A-approved requirements frozen and untouched. When the addition is large enough to
need its own convergence, carve it into a new spec rather than carrying it in this one.

## Design scope-cut gate — before Step 5 in the design phase (`MODE: normal`)

Reached from Step 5, once per spec, before the first design approval, so the design never
finalizes a majority scope cut the human has not seen (retro P12). The human set the scope
bar at requirements Gate A without seeing how far the design would narrow it.

1. **Already surfaced?** If the HANDOFF section `## <SPEC> — design` holds a
   `Scope-cut surfaced | yes` row (Step 0 read it on this resume), the human has already
   seen the cut: skip this gate and go to Step 5 item 1.
2. **Measure the cut.** The planned scope is the decomposition entry's deliverables and
   the approved requirements (`grep -n '^### Requirement' <spec dir>/requirements.md` for
   the planned set — a structure read, never the body). The cut scope is what this design
   does not build: the cut-and-deferred scope you already track from the drafter's
   `re-decided` report path, the revisers' cut-scope reports and the Step 6 surfacing. A
   **majority scope cut** is more than half of the planned requirements, or of the
   decomposition's planned deliverables, dropped or deferred by the design.
3. **No majority cut ⇒** go to Step 5 item 1.
4. **Majority cut ⇒ surface it once.** Write the HANDOFF section with a
   `Scope-cut surfaced | yes` row and, under it, one line per requirement or deliverable
   the design will not build. Append a retro-log entry through `book.sh` (`retro`,
   `escalation`). Commit the spec store through `book.sh` (`commit`). Report
   `PHASE: escalate`, `STATE: v<D>`,
   `REASON: majority scope cut — <what will not be built, one line>`. The supervisor stops
   and prints it for the human, who confirms before the phase finalizes. On the re-run the
   human then starts, Step 0 routes back here, item 1 sees the row, and the phase approves.
   The gate fires at most once per spec.

## Gate B — assemble the veto list (tasks, `MODE: normal`, first approval)

Reached from Step 6, before the report, only in the `tasks` phase and only in
`MODE: normal` — the first time this spec's tasks phase reaches `approved`. In
`MODE: revision` (an annotation's advisory round or a design-defect revalidation) write
no list and skip this step (Req 5 AC 6); the supervisor already holds gate B's result.
You never read the document body.

1. **Class (a).** Call the `harness` tool with `action: gate`, `op: class-a`,
   `specName: <SPEC>`. It reads `tasks.md` and the `## Sensitive paths` list server-side
   and returns `data.items: ClassAItem[]` (`{taskId, title, kind, reason, score}`;
   `score` 2 for a sensitive-path item, 1 for a keyword item). You compute none of it.
2. **Classes (b)/(c).** Collect the kept tags the reviser recorded:
   `grep -n -E '\[gate-(b|c):' <document>` over the Revision History lines (a permitted
   read, the tracking Step 3 item 4 already does for the standoff tally). For each
   distinct `[gate-b:T<id>]`/`[gate-c:T<id>]` tag take its most recent bullet; keep it as
   a VetoCandidateItem `{taskId, class: 'b'|'c', reason}` only when that bullet is marked
   **Rejected** (the task was intentionally kept) — `taskId` and `class` from the tag,
   `reason` from the bullet's one line. Drop a tag whose latest bullet is **Accepted**
   (the task was removed).
3. **Fold into one ranked list.** Map each `ClassAItem` to a `VetoItem`
   (`taskId`→`taskId`, `reason`→`summary`, `kind`→`class: 'a'`) and each
   VetoCandidateItem to a `VetoItem` (`taskId`, `reason`→`summary`, `class`). Order all
   three classes into one list, most consequential first — class (a) items pre-ordered by
   `score` descending — and assign each `rank` last (1 = most consequential). One list,
   not three (Req 4 AC 4).
4. **Compact plan.** Build `tasks: [{id, title}]` for presentation from the task headers:
   `grep -n -E '^- \[[ xX-]\] [0-9]' <document>` gives each task's number and title (a
   structure read like `grep -n '^#'`, never the body); strip any `[gate-b:*]`/
   `[gate-c:*]` tag from a title.
5. **Put.** Call the `harness` tool with `action: gate`, `op: put`, `slot: b`,
   `specName: <SPEC>`, and top-level `payload = { tasks: [...], veto: VetoItem[] }`
   (`gate put` overwrites the whole file). Then finish the Step 6 report as normal
   (`PHASE: approved`); the supervisor reads slot b before the first implementation spawn.
