# Adversarial Analysis — question-gates/design (v2), round 2

Scope: design v2. The v2 delta is the round-1 adversarial response (six findings, all
accepted). Delta attacked first; fresh lens applied second: **the cost of touching an
existing component** — the `harness` schema/handler, `parseTasksFromMarkdown`/
`parseSensitivePaths` consumption, the `sdd-drafter` agent, and the `sdd-continue` /
`sdd-document-phase` skills, against the tests, fixtures and standing rules that already
pin their shape.

## What I checked, and how

- **Delta citations, both ends.** Re-verified every path the v2/lint commits added or
  changed: `src/core/task-parser.ts:108-128` (`ParsedTask`, `description`/`files?`, no
  `title`/`block`), `:365-385` (`taskBlock(content, taskId)` — a full-file signature, and
  it re-calls `parseTasksFromMarkdown` internally, line 366); `src/core/gate-rules.ts:101-104`
  (`parseSensitivePaths` → `string[] | null`); `src/tools/harness.ts:537-544` (the
  `values.path` missing-value guard) and `:517-544` (`briefAction` head), `:36-77` (schema,
  `action` enum `['orient','brief','phase-log']`, `additionalProperties: false` at 76);
  `harness/agents/sdd-drafter.md:16-26`, `sdd-reviser.md:14-16`;
  `harness/skills/sdd-document-phase/SKILL.md:69-120` (Step 1 + Lint step),
  `harness/skills/sdd-continue/SKILL.md:146-210, 185-210, 215-230, 232-261`. All resolve,
  all ranges correct. `requirements D9` resolves to requirements.md:103 (gate B after the
  approved tasks report, before the first implementation spawn/worktree) — correct.
  **No misstated-artifact MUST_FIX in the delta.**
- **New code the fresh lens needed:** `src/tools/harness.ts` handler switch (84-100:
  `default` returns "Unknown action…", so a new `case 'gate'` is required — noted in
  codebase-context, not called out in the design body but harmless); `briefAction` write
  path (600-611: `writeFile`, an overwrite, no merge); `src/tools/index.ts` (registration
  only, no per-op wiring); `src/tools/__tests__/harness.test.ts` (asserts handler
  behaviour, never the schema shape or the action enum — a `gate` case breaks no existing
  test).
- **Standing rules that bound the mutated components:** `sdd-document-phase/SKILL.md:20`
  — the orchestrator may read "Revision History lines (grep), the verdict block of an
  analysis (tail), `grep -n '^#'` for structure, and worker reports. **Nothing else**,"
  and "never the whole document." Requirements D2 leans on exactly this rule to justify
  delegating gate-A extraction to the drafter. This rule is the crux of two findings below.

The delta closed R1-2 (payload pinned top-level everywhere), R1-5 (types + `score`), and
R1-6 (parser field mapping) cleanly; I found no new defect in those. R1-1's `gate delete`
holds up on trace (annotate → one `MODE: revision` round writes no list → re-entry finds
`present: false`; design-defect and fresh-resume likewise). R1-3 and R1-4's fixes each
introduced a new gap, below.

---

## Topics attacked

### 1. The R1-3 narrow drafter re-spawn (Component 3 last sentence, Component 4 gate-A bullet)

- **Challenge the claim that the orchestrator can know a lint fix "rewords a decision's
  `question` or its 'options were' clause."** The document orchestrator's standing rule
  (`SKILL.md:20`) lets it read only Revision-History grep, an analysis verdict `tail`,
  `grep -n '^#'` structure, and worker reports — "Nothing else," "never the whole
  document." The `## Decisions taken in this document` section is document body. The
  reviser (the Lint-step worker) reports only "files touched / findings accepted-rejected /
  citations / flags" (`sdd-reviser.md:32`) and is not modified by this design, so it emits
  no "reworded decision" signal. Stress-test whether the conditional trigger can ever be
  evaluated.
- **Challenge "the drafter rewrites only that triple with `harness gate put slot=a`."**
  `gate put` writes the whole `payload` to `gate-a.json` (Component 2; `briefAction` reuse
  = `writeFile`, an overwrite). A drafter re-spawned "narrowly, naming just that decision"
  writes `{ items: [oneTriple] }` and clobbers the other four decisions' triples. Trace
  what the supervisor's `gate get slot=a` then returns.
- **Stress-test the spawn mechanism.** The normal drafter spawn is `harness brief
  template: drafter` → brief file → `Read and execute the instructions in <brief>`
  (`SKILL.md:74-80`). No brief template or brief-authoring path is named for the narrow
  re-spawn.

### 2. Gate-B classes (b)/(c) judgment (Component 4 gate-B bullet, D5, requirements D6)

- **Challenge "judge classes (b) … and (c) … from `tasks.md`/`requirements.md`."** That
  is the orchestrator reading two document bodies — forbidden by `SKILL.md:20`. Gate A
  avoided this exact problem by delegating body-reading to the drafter (requirements D2);
  gate B's (b)/(c) path was not given the same delegation.
- **Stress-test Component 4's own Purpose line** ("assemble gate B without ever reading the
  document body") against its gate-B bullet, which names reading both documents.
- **Contrast with class (a):** class (a) is safe because `gate class-a` reads `tasks.md`
  server-side; (b)/(c) have no server or worker surface and fall back on the one actor that
  may not read the body.

### 3. Fresh lens — what the schema/agent edits break or leave untested

- **Stress-test the `additionalProperties: false` schema (`harness.ts:76`).** Adding the
  `gate` action requires adding `op`/`slot`/`payload` to the same schema in the same
  commit, or every well-formed `gate` call is rejected by validation. The design says the
  schema gains them; confirm no existing test pins the enum (it does not).
- **Challenge the Testing-Strategy check list.** For a change under `harness/`,
  `agent-rules.md:24-26` mandates `node scripts/sync-plugin-assets.cjs` + `npm run
  check:plugin-assets` + `claude plugin validate . --strict`. The design's Testing Strategy
  names only `claude plugin validate . --strict`.
- **Trace `ParsedTask.files?` → `TaskVetoInput.files: string[]`.** `files` is optional on
  the parser type and required on the veto input; a task with no `- File:` line yields
  `undefined`, needing a `?? []` the design never states. And `class-a` iterates every
  `ParsedTask` including `isHeader: true` header rows, whose title/block can carry a keyword.

---

## Findings

**R2-1 — SHOULD_FIX — `gate put slot=a` overwrites; the R1-3 narrow re-spawn drops the
other decisions.** *(Compounds: R1-3.)* Component 2's `op: 'put'` "writes the top-level
`payload` argument as JSON to `gate-<slot>.json`" — a full-file overwrite (it reuses
`briefAction`'s `writeFile`, `harness.ts:600-611`; no merge). Component 3's R1-3 fix says
the re-spawned drafter, "naming just that decision," "rewrites only that triple with
`harness gate put slot=a`." A single `put` carrying one item replaces the entire
`gate-a.json`, so the other (up to four) decisions vanish; the supervisor's `gate get
slot=a` then returns one decision and gate A asks one of five. The fix must either have the
re-spawned drafter read the current `gate-a.json` (a `gate get slot=a`) and re-`put` all
items with the one triple changed, or re-extract and re-`put` the full set — neither is
stated, and both contradict "naming just that decision."

**R2-2 — SHOULD_FIX — the R1-3 re-spawn has no trigger the orchestrator is allowed to
observe, so the staleness R1-3 closed can persist.** *(Compounds: R1-3.)* Component 3/4
make the re-spawn conditional on "the Lint step lands a fix that must reword a decision's
`question` or its 'options were' clause." Evaluating that condition needs the content of
the `## Decisions taken in this document` section, which is document body the orchestrator
is barred from reading (`SKILL.md:20`: "Nothing else," "never the whole document" — the
very rule requirements D2 relies on for gate A). The reviser emits no "reworded decision"
signal in its report (`sdd-reviser.md:32`) and is not modified here. As written, the
orchestrator cannot tell whether to re-spawn, so it either never fires (and the pre-lint
triples ship — the R1-3 defect) or fires blindly. A workable trigger exists within the
rules (compare each held lint finding's line number against the Decisions-section range
from the `grep -n '^#'` structure), but the design specifies none. Pin the signal (a
reviser report flag, or the lint-finding-in-section line check) and state it.

**R2-3 — SHOULD_FIX — gate-B classes (b)/(c) require the orchestrator to read document
bodies its standing rule forbids.** *(Novel.)* Component 4 has the tasks orchestrator
"judge classes (b) new external dependencies and (c) work beyond the approved requirements
from `tasks.md`/`requirements.md`." Reading those two documents violates `SKILL.md:20`
("worker reports. Nothing else"; "never the whole document"), and contradicts Component
4's own Purpose ("assemble gate B without ever reading the document body"). Gate A solved
the identical constraint by delegating extraction to the drafter (requirements D2); gate B
class (a) solved it by reading `tasks.md` server-side in `gate class-a`; but (b)/(c) were
left on the one actor that may not read the body, with no worker or server surface. Route
the (b)/(c) inputs through a worker (as gate A does) or a server op, or reword the source
to the worker reports and the `class-a` data the orchestrator already holds, and reconcile
the Purpose line.

**R2-4 — MINOR — Testing Strategy omits the plugin-asset checks a `harness/` change
requires.** *(Novel.)* The design edits `sdd-drafter.md`, two `SKILL.md`s and `formats.md`
under `harness/`; `agent-rules.md:24-26` requires `node scripts/sync-plugin-assets.cjs`
(commit the `plugins/` copies) + `npm run check:plugin-assets` for any such change. The
Testing Strategy lists only `claude plugin validate . --strict`, so an implementer who
follows the design alone leaves `plugins/` stale and CI's `check:plugin-assets` red.

**R2-5 — MINOR — `class-a` input hygiene: optional `files` and header rows unstated.**
*(Novel.)* `ParsedTask.files` is optional (`task-parser.ts:119`) but `TaskVetoInput.files`
is `string[]` (Component 1); the `undefined → []` coalesce is unstated. And `op: 'class-a'`
takes "each `ParsedTask`" without excluding `isHeader: true` rows, whose title/`taskBlock`
prose can trip a keyword (e.g. a "Auth" section header) and emit a spurious class-(a) item.
State the coalesce and whether header rows are filtered.

---

## Closing deliverables

### Top 5 risks/gaps

1. **The R1-3 fix is inert or destructive (R2-1 + R2-2):** the re-spawn cannot be triggered
   from anything the orchestrator may read, and if it does fire it overwrites `gate-a.json`
   down to the single reworded decision. Either way gate A ships wrong content after a
   decision-touching lint fix — the precise staleness R1-3 was written to close.
2. **Gate-B (b)/(c) is unimplementable by its assigned actor (R2-3):** the orchestrator is
   told to read two documents it is forbidden to read, with no delegate, so the two
   judgment-based veto classes have no feasible producer.
3. **`plugins/` drift (R2-4):** the design's check list misses the sync/`check:plugin-assets`
   step the repo mandates for every `harness/` edit.
4. **Silent over-matching in class (a) (R2-5):** header rows and empty-`files` tasks are
   unhandled, producing spurious or crashing veto items on real task lists.
5. **Schema atomicity (topic 3):** `additionalProperties: false` means the `gate` action
   and its three new props must land together; the design says so, but it is the one place
   a partial implementation silently rejects every gate call.

### Top 3 conclusions to challenge or reverse

1. **"the drafter rewrites only that triple with `harness gate put slot=a`" (Component 3).**
   Reverse: a single `put` overwrites the whole file, so "only that triple" deletes the
   rest. The re-spawn must round-trip the full item set.
2. **"assemble gate B without ever reading the document body" (Component 4 Purpose).**
   Challenge: the same component reads `tasks.md`/`requirements.md` for (b)/(c). One of the
   two statements is false as written; the standing rule (`SKILL.md:20`) makes the Purpose
   the true one and the (b)/(c) method the broken one.
3. **The R1-3 re-spawn "before the orchestrator returns `PHASE: gate-a`" always corrects
   staleness.** Challenge: it corrects nothing unless the orchestrator can detect the
   rewording, which its read budget forbids. The claim that gate A always shows post-lint
   text is still unsupported after the v2 fix.

### What's missing — do before acting on this document

- A trigger the document orchestrator may actually observe for the R1-3 re-spawn (a reviser
  report flag, or a lint-finding-line vs Decisions-section-range check), stated explicitly.
- The re-spawned drafter's read-back-and-merge (or full re-extract) so `gate put slot=a`
  does not drop the untouched decisions; and the brief/template it is spawned with.
- A body-reading delegate for gate-B classes (b)/(c) (a worker or a server op), matching how
  gate A and gate-B class (a) already avoid `SKILL.md:20`.
- The `harness/` plugin-sync + `check:plugin-assets` step in the Testing Strategy.
- The `files ?? []` coalesce and the header-row policy for `gate class-a`.

---

VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 3
MINOR: 2
DESIGN_READY: no
ESCALATE: none
