# Adversarial Analysis — project-bootstrap/design (v2), Round 2

Primary surface: feasibility, consistency, edge cases. Fresh lens: none (per prompt).
I attacked the four v2 deltas first (the R1 fixes), then swept the surrounding seams.

## Deltas attacked (Revision History v2 — R1-1..R1-4)

### R1-1 — token-check `child_process` classification (C4 check 7, Error Handling §4)
The v2 text now pins: `error.killed === true` → `gh timed out`; else `gh exited <error.code>`
(numeric exit, or the string `ENOENT` for a missing binary); exit 0 + non-JSON →
`unreadable gh output`; JSON without `permissions.push === true` → `no push permission`.

- **Verified against the cited code.** `runCommand` (`src/controller/merge.ts:150-172`) reads
  exactly these fields: `code = e && typeof e.code === 'number' ? e.code : e ? null : 0`
  (line 162) and `timedOut: !!e && e.killed === true` (line 167). The design's claim that the
  "number filter would drop a spawn error's string code" is literally true — `typeof e.code
  === 'number'` turns `'ENOENT'` into `null`. Reading the callback error directly (not through
  `runCommand`) is the correct fix for the `gh exited ENOENT` promise. The field reads are
  grounded in in-tree code, so the library-capability directive is satisfied.
- **Ordering is correct.** On a timeout node kills with SIGTERM, setting `killed=true` and
  `code=null`; checking `killed` before `code` yields `gh timed out`, not `gh exited null`.
- Sound. No MUST_FIX / SHOULD_FIX. One residual edge → R2-1 (MINOR) below.

### R1-2 — 500 response of a failed durable write (Data Models, C7, Error Handling §3)
- **Verified end to end.** The route catch returns `reply.code(500).send({ error: error.message })`
  (`src/dashboard/multi-server.ts:461-463`), so `500: { error: string }` is the right shape.
  `rememberProject` (`src/controller/state.ts:434-441`) `await`s `writeProjects` →
  `writeJsonAtomic`; a write failure rejects, propagates through `addProjectByPath` (which the
  design makes `await rememberProject`) into the route's `try/catch` → 500. The trigger is real
  and wired. Data Models and the §3 exit-2 mapping now name it. Correct.
- **The §3 "start the controller" suffix on a 400/500 is required, not a defect.** Req 5 AC 7
  mandates that *any* non-2xx prints "one line naming the failure and the command that starts
  the controller … exit 2." So routing a 500 (controller up, disk write failed) through the
  same start-controller message is faithful to the requirement, not a design inconsistency.
  Checked and dismissed.

### R1-3 — doctor default `timeoutMs = 10000` (C4 interface)
- Stated (`design.md:102`), matches the Performance NFR (10 s/call, 30 s total) and init's
  default. Fine.

### R1-4 — `agent-rules.md` path named (C3 phase 2 step 3, C4 check 3)
- **Verified.** `readAgentRules(workflowRoot)` reads `join(workflowRoot, 'agent-rules.md')`
  (`src/dashboard/harness/run-setup.ts:69`). The v2 text now passes
  `join(storeRoot, '.spec-workflow')` and writes to `storeRoot/.spec-workflow/agent-rules.md`,
  so writer and reader agree on the same path. The R1 terminology ambiguity is closed.

## Directive sweeps (this round's required lenses)

- **Data Models completeness.** The one response object a requirement references,
  `POST /api/projects/add`, now enumerates full shapes for 200 / 400 / 500 — no union-only arms.
- **Error-branch shape.** 400 and 500 each pin status code + `{ error: string }`. The token
  check's branches pin their discriminants (`error.killed`, `error.code`) and reason strings;
  a doctor check has no HTTP status (exit 1 on any fail), so nothing is left unpinned.

## Findings (MINOR only — do not keep the loop alive)

### R2-1 (MINOR, Compounding: R1-1) — signal-kill that is not a timeout → `gh exited null`
The enumeration branches on `error.killed` then `error.code`. If `gh` is killed by an external
signal (e.g. OOM SIGKILL), node sets `killed=false`, `signal` set, `code=null`; the design then
reports `gh exited null`. Rare (gh does not normally die by signal), and it is still a `fail
token` line, not a crash — so §4 holds. Not worth a round; leave to the implementer.

### R2-2 (MINOR, Novel) — no named test for the `timeout`/`ENOENT` token reasons
R1-1 made the four token reasons binding, but the doctor test plan (`design.md:175`) names only
the stub (`scripts/stub-gh.mjs`) pass/fail and the `timeoutMs 200` case against the *health*
server, not the `gh`-timeout or missing-binary classifications. The behaviour is pinned in the
design, so an implementer can cover it; a task-phase test note would lock the two most
distinctive reasons against regression. Nice-to-have.

## Closing deliverables

### Top risks/gaps (3, short doc)
1. Signal-kill-not-timeout edge in the token classifier (R2-1, MINOR) — rare, non-crashing.
2. Token timeout/ENOENT reasons have no named test (R2-2, MINOR) — behaviour is pinned.
3. Nothing else: all four v2 deltas verify against the tree.

### Top 3 conclusions to challenge or reverse
1. "500 is misleading advice" — **reversed:** Req 5 AC 7 requires the start-controller line on
   any non-2xx, so the design is correct.
2. "ENOENT promise is still unproven" — **reversed:** the field reads match `runCommand`'s
   in-tree usage; reading the callback directly is exactly what makes `gh exited ENOENT` hold.
3. "Data Models still incomplete" — **reversed:** 200/400/500 all pinned with full shapes.

### What's missing before acting
Nothing blocking. Optionally add a task-phase test note for the `gh`-timeout and missing-binary
token reasons (R2-2). The design is implementable as written.

---

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 2
DESIGN_READY: yes
ESCALATE: none
```
