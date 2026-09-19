# Adversarial Analysis — harness-usage-and-tiers/design (v2), Round 2

Scope this round: the v2 delta (the four accepted R1 fixes, re-read end to end), then the
named fresh lens — **every prescribed test and safety mechanism verified against the real
vitest and the real shapes under the checkout**. Code read at both ends of every range
cited below.

## Deltas re-verified (the four v2 fixes attacked first)

- **R1-1 (skill edit spans + grep claim) — mostly lands, one straddle (see R2-1).** I ran
  the design's own member-finding grep `grep -rn "footer\|tokens=\|subagent_tokens"
  harness/skills`. The pre-edit hits are `formats.md:194`, `sdd-continue:215/217/220`,
  `sdd-retrospective:36/37`, `sdd-closeout-phase:48`, `sdd-document-phase:47`,
  `sdd-implementation-phase:57`, plus the two `attribution footer` lines
  `sdd-closeout-phase:170` and `briefs.md:233`. Every `tokens=`/`subagent_tokens` hit is
  inside a design edit span (continue `:213-220`, retro `:35-39`, document `:46-48`,
  implementation `:57-58`, closeout `:48-49`, formats `:193-194`), so after the edits only
  `closeout:170` and `briefs.md:233` remain. **The grep-clean claim (design line 114) is now
  TRUE and the closeout citation `:170` is correct.** The `sdd-continue` span `:213-220` is a
  clean paragraph (line 213 opens `Before each spawn:`, line 220 ends `...write
  tokens=unknown.`, line 221 blank, line 222 `**Model pre-flight.**`), and the pre-flight
  scope note `:222-230` is exact. Good.
- **R1-2 (tier line width) — lands.** `fit(s, 30)` returns at most 30 visible chars
  (`s.slice(0, 29) + '~'`, `src/watch/render.ts:66-69`); level-2 indent is `'     '` = 5
  (`src/watch/render.ts:180`). Worst case `declared claude-fable-5-1 xhigh` (22, padRight to
  23) with a `+`-joined actual (fit to 30) and `!=`: 5+3+8+1+23+6+1+30+3 = **80**, at the
  boundary and non-wrapping. The new render case (design line 177, "a level-2 `+`-joined
  model renders truncated") exercises exactly this. Correct.
- **R1-3 (tool description action list) — lands.** `src/tools/harness.ts:29` opens
  `SDD harness bookkeeping: orient, brief, phase-log and gate for the orchestrator skills.`
  — four actions. The default message at `:120` also lists four. The design (line 103) now
  says both the description's opening action list and the default message gain `usage`.
  Correct.
- **R1-4 (dead kinds note + Overview citation) — lands.** The Overview `:658-683` now reads
  `src/tools/harness.ts:658-683`; the Scope note adds "`SpawnNode`'s four kind fields go
  unread; held for spec 9." Correct.

## Findings

### R2-1 — SHOULD_FIX — Compounds: R1-1 — The retrospective edit span `:35-39` straddles the `phase.start` and `phase.end` instructions it must not remove

R1-1's fix extended the retrospective edit from `:35-38` to `:35-39` to catch the trailing
`unknown` clause. But unlike the clean `sdd-continue` paragraph, the retro span is not
self-contained. The **Ledger** bullet (`harness/skills/sdd-retrospective/SKILL.md:33-41`)
packs three instructions into lines 35-40:

- L35: `` `phase.start phase=retrospective` after the preconditions, `spawn.start` / `spawn.end` ``
- L36-39: the spawn write with `tokens=<n>` / `<usage><subagent_tokens>` (the part to edit)
- L39-40: `` ...without it), `phase.end phase=retrospective `` / `` result=retro-ready` before the report. ``

The cited span `:35-39` therefore opens on the `phase.start phase=retrospective`
instruction (line 35) and closes on the first half of the `phase.end phase=retrospective`
instruction (line 39, continuing to line 40). Component 7's replacement text for this span
describes only the spawn write ("the orchestrator writes `spawn.start` before and
`spawn.usage` ... after the analyst; the hook writes the analyst's `spawn.end`") and names
neither `phase.start` nor `phase.end`. Under the section's own rule — "each edit replaces
the cited span" — a literal application deletes `phase.start phase=retrospective` and the
`phase.end phase=retrospective` prefix, stranding `result=retro-ready` before the report.`
on line 40. That drops the retrospective phase's ledger boundaries — the very `phase.start`
/ `phase.end` rows every reader in this spec (buildModel live-phase, usage.ts rule (e)'s
phase resolution, `phase-log`) depends on.

Every other skill edit is either a clean paragraph (`sdd-continue :213-220`) or an explicit
surgical drop ("Drop the `tokens=<n>` clause ... at `:46-48`/`:57-58`/`:48-49`"); only the
retro edit is stated as a full restatement over a span that encloses instructions it must
preserve. Fix: narrow the retro citation to the `spawn.start` / `spawn.end` clause inside
the bullet, or state that the replacement retains `phase.start phase=retrospective` (line
35) and `phase.end phase=retrospective result=retro-ready` (lines 39-40).

### R2-2 — SHOULD_FIX — Novel — The "never both [badge and tokens]" head-line width claim is pinned to a path the spec bypasses; D9 opens a new path the citation does not cover

Component 4 (design line 85) budgets the head line at 9 columns for "the badge ... on a
running node **or** the tokens ... on an ended one, **never both** (a running node folded
with `spawn.usage` tokens, `src/watch/ledger.ts:267-271`, shows them once it ends)." The
cited justification is the `spawn.usage` fold only. But this spec's D9 (Req 1.7, Component
1) makes the hook write **numeric `tokens` on `agent.stop`**, and the activity join at
`src/watch/ledger.ts:305-311` fills a node's tokens from an `agent.stop` whenever
`s.tokens === undefined` and the event falls in the node's window — and for a still-open
node `to = Number.POSITIVE_INFINITY` (`src/watch/ledger.ts:299`). The cited range
`:267-271` says nothing about this path.

This is reachable through the interleaved double-`spawn.start` case the design itself
documents ("two `spawn.start` rows of one agent before either closes ... `sdd-reviser`",
Component 5 known-limit; confirmed on this store, codebase-context line 123). When the first
`sdd-reviser` subagent completes (its `spawn.end` closes node A via the `find`-first pairing
at `:241`, and its `agent.stop` now carries tokens) while the second node B is still open,
the join drops A's `agent.stop` tokens onto the open node B (`t2 <= t3`, B.tokens undefined).
B is then **running (badge) with tokens** — the head line shows both. For a level-2 worker
at width 80: 5 + 2 + 18 + 31 (roleW clamps to 30) + 8 + 1 + 9 + 1 + 9 = **84 > 80**. It
also double-counts A's tokens into `tokensTotal` (`:313`) for that transient, which the
design's "`tokensTotal` (:316) unchanged (Req 4.4)" framing does not flag.

The overflow is transient (it self-corrects once B closes) and cosmetic, but it defeats the
exact 80-column guarantee R1-2 just secured, and the "never both" property is asserted as
proven when it is a hope for the `agent.stop` path. Cheap fixes exist: gate the head-line
`tokens` on `!running`, or gate the join's `agent.stop` fill on `s.endedAt` being defined.
State whichever, so "never both" is pinned to a mechanism.

## Fresh lens — every prescribed test/mechanism against the real vitest and real shapes

- **vitest is `^4.0.15`.** Every prescribed assertion uses only `toBe`, `toContain`,
  `toEqual`, `toMatch`, `toHaveLength` — all expressible in vitest 4. No exotic matcher.
- **`render.test.ts:53` and `:56` assert the values the design claims to change.** Verified:
  L53 matches `sdd-implementation-orchestrator ... fable-5-1 xhigh`, L56 matches
  `sdd-implementer ... opus-4-8 xhigh`. Splitting them into a head line (model columns
  removed) plus a tier line `declared claude-opus-4-8 high` / `declared claude-opus-4-8
  xhigh` is consistent with the new full-id profiles (frontmatter: orchestrator opus-4-8
  `high`, implementer opus-4-8 `xhigh`).
- **Req 7.2 test is expressible and the "unchanged" claim holds.** The line-271 change
  `if (tokens !== undefined && match.tokens === undefined)` keeps `spawn.end tokens=84000`
  ahead of a later `spawn.usage tokens=1` (match.tokens already 84000 → not overwritten),
  and none of `ledger.test.ts:169-218` (fold, synthesized node, old ledger) carries both a
  digit `spawn.end` and a digit `spawn.usage` on one spawn, so those keep passing.
- **The fixture arithmetic is internally consistent.** 5 spawns; 1209120 + 1736029 + 604010
  + 1005030 = 4,554,189; reviewer `unknown` (1 mark); orchestrator share
  (1736029+1005030)/4554189 = 60.2%. `question-gates` replay (44 spawns, 1,963,320, 14
  marks) and `review-gate` (59 spawns, 6,324,447 == tokensTotal) match the codebase-context
  probe.
- **D2 role derivation is correct.** `sdd-document-orchestrator` description begins `SDD
  document-phase orchestrator:` → `/^SDD ([^:]+):/` captures `document-phase orchestrator`,
  exactly the Data Models value; `sdd-checker` is `claude-sonnet-5` `high` and is the 12th
  key absent from the old 11-entry literal (`src/watch/ledger.ts:41-53`).
- **Error paths trace to real mechanisms:** unreadable/absent transcript → `readUsage`
  returns null → `tokens:"unknown"` (Component 1); torn line → per-line `try/catch`;
  missing spec dir → `phaseLogAction`'s `stat` catch returns `{success:false, "Failed to
  read <dir>"}` (`:664-669`); missing ledger → ENOENT-as-empty (`:674-682`); bad `ts` →
  `ms` returns 0 (`:183-186`). All pinned. Only R2-2's `agent.stop` path is a stated
  property without a matching pinned mechanism.

## Rulings honoured as closed

Req 4.7 (two-line entry), Req 5.4 / D6 (any non-digit `tokens`), and round 1's "harness.ts
ranges — all correct" are recorded closed and not re-opened. (Note only, not a finding: the
narrow Component 6 citation `:673-683` for `safeJoin` starts one line after the call at
`:672`; round 1 blessed the harness.ts ranges and lint passed citation-range, so it stays
closed.)

## Closing deliverables

### Top risks/gaps
1. Applying the retrospective edit literally drops the retro phase's `phase.start` /
   `phase.end` ledger rows (R2-1).
2. The head line can render both a badge and a token count — overflowing 80 columns and
   double-counting `tokensTotal` — in the interleaved double-spawn case the design itself
   documents, because D9 feeds `agent.stop` tokens into the activity join (R2-2).

### Top conclusions to challenge
1. **"never both ... shows them once it ends" (Component 4).** Reverse: D9's `agent.stop`
   tokens reach a still-open node via `ledger.ts:305-311`; the `:267-271` citation does not
   prove the property.
2. **The retro edit "replaces the cited span" cleanly.** It does not: `:35-39` straddles
   `phase.start` (L35) and `phase.end` (L39-40).

### What's missing before acting
- A narrowed retro edit citation (or explicit retain text) for `phase.start` / `phase.end`.
- A stated guard (head-line `!running`, or join gated on `s.endedAt`) so "never both" and
  the `tokensTotal`-unchanged claim hold once `agent.stop` carries tokens.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 2
MINOR: 0
DESIGN_READY: no
ESCALATE: none
```
