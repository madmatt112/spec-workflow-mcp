# Adversarial Review Memory — design
Last updated: 2026-09-19 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (MUST_FIX, v1)** — Skill edit spans stopped short of the token-write text.
  v2 extended `sdd-continue` to `:213-220` and retro to `:35-39`, corrected the closeout
  footer citation to `:170`, and re-scoped pre-flight to `:222-230`. Grep-clean claim now
  verified TRUE. (But the retro extension over-reached — see R2-1 unresolved.)
- **R1-2 (SHOULD_FIX, v1)** — Tier-line actual column overflowed 80 for a `+`-joined
  worker. v2 capped it with `fit(s.model, 30)`; worst case now exactly 80; render test at
  width 80 added. Verified: `fit` caps at 30, level-2 indent 5, math holds.
- **R1-3 (MINOR, v1)** — Tool `description` opening line listed four actions. v2 adds
  `usage` to the opening list and the default message. Verified against harness.ts:29,120.
- **R1-4 (MINOR, v1)** — Four `SpawnNode` kinds unread; bare Overview citation. v2 qualified
  `harness.ts:658-683` and added a Scope note ("held for spec 9"). Verified.

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R2-1 (SHOULD_FIX, Compounds R1-1)** — Retro edit span `:35-39` straddles the
  `phase.start` (L35) and `phase.end` (L39-40) instructions; Component 7's replacement text
  names neither, so a literal "replace the cited span" drops the retrospective phase's
  ledger boundaries. Narrow the citation or state the retained text.
- **R2-2 (SHOULD_FIX, Novel)** — Component 4's "never both [badge and tokens]" claim is
  pinned only to the `spawn.usage` fold (`:267-271`), but D9 makes `agent.stop` carry
  tokens and the activity join (`ledger.ts:305-311`, `to=+Infinity` for open nodes) fills a
  still-open node's tokens from `agent.stop`. In the interleaved double-`spawn.start` case
  the design documents, the open node renders running+tokens → head line 84 > 80, plus a
  transient `tokensTotal` double-count (vs "Req 4.4 unchanged"). Gate on `!running` or
  `s.endedAt`.

## Patterns & Themes
- **Edit-span precision (recurring).** R1-1 was too-narrow; the v2 fix for retro is now
  too-wide (straddles adjacent instructions). Always check both ends of a prose edit span
  against instruction boundaries, not just against the matched token.
- **Width claims proven only for the simple path (recurring).** R1-2 (tier line, single
  model) and R2-2 (head line, spawn.usage-only) both assert an 80-col property with a
  citation that omits a path the spec itself activates (`+`-joined actual; `agent.stop`
  tokens). Re-derive width claims against every token source the spec introduces.
- **New data paths not traced into old readers.** D9 (agent.stop carries tokens) changes
  the *behaviour* of the unchanged activity join; "code unchanged" is not "behaviour
  unchanged".

## Guidance for Next Review
- Confirm the retro edit is re-scoped so `phase.start`/`phase.end` survive; re-run the
  member-finding grep against the revised map (should stay 2 hits: closeout:170,
  briefs.md:233).
- Confirm a head-line guard (`!running`, or join gated on `s.endedAt`) is stated, and that
  the `tokensTotal`-unchanged claim survives `agent.stop` tokens.
- Well-covered, do not re-mine: the grep-clean claim, the tier-line 80-col math, the fold
  line-271 change vs `ledger.test.ts:169-218`, the fixture arithmetic, D2 role derivation,
  the 12-key profiles, vitest-4 expressibility, the error paths (transcript/ledger/ts).
- Closed rulings (do not re-open): Req 4.7 two-line entry; Req 5.4 / D6 any-non-digit;
  round 1's "harness.ts ranges correct" (incl. the `:673-683` off-by-one for safeJoin).
- The 77 `citation-identifier` warnings are all new/proposed symbols or cross-block
  attributions; do not re-discover.
