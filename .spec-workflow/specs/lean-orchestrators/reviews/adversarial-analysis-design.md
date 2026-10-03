# Adversarial Analysis — lean-orchestrators/design (v1), round 1

Primary surface: feasibility, consistency, edge cases. Fresh lens: wire contracts across
boundaries (ledger rows C7 writes / C1-C4 fold; worker report blocks C9 emits / orchestrator
consumes; brief-template values C6 renders / skills pass).

## What I checked and how

**Delta since `a170e61` (the whole `## Changes since`), re-verified first.**
- `harness/hooks/sdd-activity.sh:68-87` (was `70-87`): line 68 is `function readUsage`, and
  70-87 is the dedup loop whose comment says "Keep the last usage/model seen for each id"
  (line 86 overwrites `byId` per id, last line wins). The C2 claim "its usage is its **last**
  line's, as `readUsage` keeps it" is anchored. Tightening to line 68 is correct.
- C5 scenario-form note: dropping the cross-repo absolute path and restating "the parser also
  accepts the `**:` form" leaves a design-defined behaviour (what the new parser will accept),
  not a code claim, so it needs no code citation; the in-repo `.**` anchor
  (`.spec-workflow/spec-decomposition/decomposition.md:771`) still reads `**End-to-end
  verification.**`. I confirmed `/home/mcf/repo/tradr-hosted/.spec-workflow/spec-decomposition/decomposition.md:72`
  is the `**:` form (`**End-to-end verification**:`), used by the `trading-rules` baseline, so
  the two-form parser targets a real format. Change is sound.

**Probes re-run (context file is drafter-written; re-probed C3, C4, C11).**
- C3 filesystem probe (`design-probe-fs.mjs`, node 24): a symlinked dir entry reports
  `isDirectory false` and its realpath escapes the root (`inside false`). Confirms the
  `withFileTypes` + realpath-containment design in C3. `readdir({withFileTypes})` and
  `realpath` both exist back to node 20, so the node-20 CI assertion is safe.
- C4 base probe (`design-probe-base.js`) on the real baseline implementation transcript
  (`agent-a46fec387251fb6c6`): `calls 127, peak 229,380, W 2,682,602, baseW 662,322, 24.7%`.
  Matches the C4 block exactly.
- D1 probe (`design-probe-w.js`) on all 5 baseline doc/impl spawns: last-line W == ledger W
  at **0.000%** on every spawn; first-line W is 0.256%–6.336% low. Confirms D1 (first line
  fails the 1% check; last line matches) and the Testing-Strategy e2e claim.
- C11 baseline resolution: all 5 `tdd-task-loop` and all 3 `trading-rules` doc/impl
  orchestrator transcripts resolve via the `agentId`→activity-`session`→projects-scan path.
- Ledger row shapes: `round` rows carry a `phase` key; `task.done` rows do **not**. This is
  exactly why C1's `unitCount` matches document rounds by `phase` key but implementation
  `task.done` by the time window (`src/watch/usage.ts:116-124`). Correct, non-obvious, and
  the citation is right.

**Spot-checked code citations** (`spawnW`/`cacheFields` fields on `spawn.end:220-229`,
`briefAction:595-765`, `BRIEF_TEMPLATES:493-557`, `orientImplementation:311-364` returning
`tasks.total`, `review-task.ts:263-267` gate `files`, `overview-watch.ts:51-54` `mentionsGate`,
`SKILL.md:224-273` "no check fires on round 1", `SKILL.md:379-380` runaway guard,
`formats.md:164-183` `SDD_RUN`/`SDD_LEDGER`, all eight C9 report-bullet lines). Every one
anchors its adjacent claim; the flagged citation-identifier warnings are all design-introduced
identifiers or tool/action/phase names, as the lint pass ruled. No misstated artifact found.

**Wire contracts traced end to end:** ledger `spawn.end` keys → `spawnW`/fold (agree);
`spawn.usage` fallback → wUnknown rule (agree); `book.sh event` → `EVENT_SCRIPT` → fold
(agree, keys unchanged); implementer `checks-file` (JSON array of commands) → gate `checks`
(array of command strings, agree); `nextTask.files` → gate `files` (agree); Req 3.3 blocks all
have a C6 home (gate-A→`gate-a`, round section→`reviewer` append, narrow-check→`checker` write-over,
code-graph→`codeGraphSection`, lint→inline per D11). One producer dangles — see R1-1.

## Rulings on the re-decided requirement literals (all refinement, closed)

- **Req 1.5 (last-line vs probe's first line) — refinement.** Req 1.5 itself cites *both*
  `readUsage` (last line) and `source-probe.js` (first line) as normative; they disagree.
  Only last-line satisfies the governing acceptance criterion Req 1.6 (1% match): I measured
  first-line at up to 6.336% low, last-line at 0.000%. The design resolves an internal
  contradiction toward the arm the requirement's own check demands. Within intent.
- **Req 3.3 (lint inline, not a template) — refinement.** The lint rules are the
  orchestrator's own step text, consumed by itself, in the *kept* Lint step (Req 3.1 keeps the
  Lint step in the preloaded skill). Inlining them in `SKILL.md` keeps `briefs.md` unread and
  the Lint step unbroken — Req 3.3's stated end. A worker-less block needs no worker template.
- **Req 4.2 (whole queue with files/testFiles) — refinement.** Returning the full open-task
  queue plus `files` is more than the literal "next task's id/title/status" but serves the same
  intent (Pick needs no `tasks.md` read) and feeds the gate (D10). It reverses nothing.
  (The extra `testFiles`/`integration` fields are a separate gap — R1-1.)
- **Req 6.4 (one generic `book.sh` via a brief template) — refinement.** `book.sh` sits at
  `/tmp/scratchpad/sdd/<SPEC>/book.sh`, beside `event.sh` (agent-rules:86), appends only
  through `EVENT_SCRIPT` (Req 6.4 intent), and is written via `harness brief` — the same
  server-template mechanism Req 3.4 already mandates for standing briefs. One generic script
  (D4) over N verb scripts keeps one writer per row. Within intent.
- **Req 7.3 (runaway guard on `tasks.total`) — refinement.** The literal said "open tasks at
  phase start, held fixed." `data.tasks.total` (confirmed on `orientImplementation`) is
  monotonic and identical across restarts, so it serves Req 7.3's intent (non-shrinking
  allowance, no spurious mid-phase trip, from R2-4) more robustly than a phase-start open-count
  the stateless supervisor cannot persist. The bound only loosens (total ≥ open). D14 cites R2-4.

## Findings

### R1-1 — `QueuedTask.testFiles` and `integration` are produced with no named consumer (SHOULD_FIX)
C5/Data Models add `testFiles: string[]` and `integration: boolean` to the `orient` queue
(design.md:212, 215), but no component in the design consumes either. The gate takes
`nextTask.files` only (C8, design.md:167; D10). The `verifier` kind's values are
`variant, taskIds, files, round, gateResults, scenario` (design.md:114) — no `testFiles`, no
`integration`. The Testing Strategy (design.md:235) tests `queue`, `nextTask`, `decomposition`
but not these two fields. Worse, `integration` is defined as "true when the block holds
`- Test (integration):`" — a convention that appears in **zero** of the 14 current `tasks.md`
files, and the existing parser `TEST_BULLET_RE` (`src/core/task-parser.ts:14`) matches only
`- Test:`, so building `integration` requires new parsing for a format nothing writes and
nothing reads. Failure mode: the tasks phase either decomposes dead fields (build + test code
no path exercises) or the implementer drops them and a verifier later flags a design/code
mismatch. Resolve before implementation: name the consumer (e.g. verifier-variant or
verify-scope selection) or cut both fields and the `- Test (integration):` claim.

### R1-2 — `compareSources` shape is unstated (MINOR)
C4 says `data` adds `sources` and `compareSources` (design.md:81). `sources` is pinned as
`SourcesReport` (design.md:211); `compareSources` has no type anywhere. It is almost certainly
the compare spec's `SourcesReport | null`, so an implementer is unlikely to get it wrong, but
Data Models should pin it like every other response field.

### R1-3 — C1 "W from the row that sets tokens" vs `listSpawns` "the latest spawn.end row's W" (MINOR)
C1 says W comes from "the row that sets tokens (`src/watch/usage.ts:259-275`)" — i.e.
`reduceSpawn`'s last *digit-string* `spawn.end`. `listSpawns` says it takes "the latest
`spawn.end` row's `agentId` and W" (design.md:41). These diverge only when a later re-fired
`spawn.end` carries non-digit (`unknown`) tokens while an earlier one set digits: the fold then
counts tokens but `listSpawns`/`spawnW` would report W undefined, so the spawn shows "sources
unknown" despite known tokens. Rare, but state that both come from the token-setting row.

## Top risks/gaps
1. Dangling producer fields `testFiles`/`integration` with a non-existent trigger convention (R1-1).
2. `compareSources` response shape unstated (R1-2).
3. `listSpawns` W-source wording can diverge from the fold on an `unknown` re-fire (R1-3).
4. (Checked, fine) The `base`-sizing heuristic (first-call residual at 3.5 chars/token) is an
   estimate; the design labels shares estimates and W a floor (NFR Reliability), and the 1%
   e2e check is the guard. No action.
5. (Checked, fine) Transcript read reaches outside the repo but is bounded (validated ids,
   realpath containment, read-only, never follows row content); probe confirms the symlink
   guards. No security hole.

## Top 3 conclusions to challenge
1. **"last-line usage is normative" (D1).** Challenged and upheld — re-measured: last-line
   0.000%, first-line up to 6.336% low. Keep.
2. **"runaway guard on `tasks.total`" (D14).** Challenged as a reversal of Req 7.3; upheld as a
   refinement that better serves R2-4's intent and is the only restart-stable option for a
   stateless supervisor. Keep.
3. **"orient returns the whole queue with files and test files" (D9/Req 4.2).** The `queue`
   and `files` parts are justified; the `testFiles`/`integration` parts are not — reverse the
   decision to carry them until a consumer exists (R1-1).

## What's missing before acting
- A named consumer for `testFiles`/`integration`, or their removal (R1-1).
- `compareSources` pinned in Data Models (R1-2).
- One-line tightening of the `listSpawns` W-source wording (R1-3).

VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 2
DESIGN_READY: no
ESCALATE: none
