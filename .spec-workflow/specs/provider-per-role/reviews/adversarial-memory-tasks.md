# Adversarial Review Memory — tasks
Last updated: 2026-09-22 (after v3 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — "halts the spec" was false this run; restated as a
  human-mediated stop (no automatic halt; task 3's branch not loaded). Fixed in v2.
- **R1-3 (MINOR, v1)** — Req 3.5/4.1/4.5 map to no `_Requirements:` line; Scope note names
  them as restriction-carried negative constraints. Fixed in v2.
- **R1-4 (MINOR, v1)** — task 1 named only 4 of 9 `SDD_*` exports; now names all nine
  (`design.md:113-121`). Fixed in v2.
- **R2-1 (MUST_FIX, v2)** — v2 mechanism told the implementer to `deferrals add` itself, but
  the implementer is barred (`sdd-implementer.md:35`, `briefs.md:49`). v3 fix: task 10
  reports `AFFECTS-FUTURE-SPECS:` and the orchestrator files the record. **Core resolved** —
  verified the orchestrator DOES hold `deferrals` at
  `sdd-implementation-orchestrator.md:31-33` (r2's "no fallback writer" claim was wrong; it
  read only `:9-17`). Success line is now implementer-self-checkable. BUT residual R3-2.
- **R2-2 (SHOULD_FIX, v2)** — `RETRO: escalation` not in the implementer brief list; v3
  switched task 1 to `RETRO: gotcha`. Verified `gotcha` is in BOTH `briefs.md:43-45` and
  `retro.sh` (`formats.md:119-121`). **Fully sound.**
- **R2-3 (MINOR, v2)** — Scope note overstated the verifier's read set; v3 narrowed to the
  End-to-end verification section (`decomposition.md:377-387`), 344/346 a different bullet.
  Substance correct; citation left a defect (R3-1).

### Partially Accepted
- **R1-2 (SHOULD_FIX, v1)** — verifier-brief premise removed, decomposition-grep concession
  recorded (closed by ruling). Substitute writer chain fixed via R2-1, but the deferral-tag
  determinism is still open (R3-2).

### Rejected
- Wiring task 10's scenarios into the step-8 completion-gate grep slot (R1-2 sub-part) —
  would edit the decomposition entry; requirements Scope notes ruled record-not-re-decide.
  Closed.
- Lint citation-identifier / bridge-missing class (new artifacts / correctly-cited-
  elsewhere) — rejected v1/v2/v3. Closed.

### Unresolved (raised v3, awaiting reviser)
- **R3-1 (MUST_FIX, fix-induced, Compounds R2-3)** — `tasks.md:119` bare line-refs
  `:383-384` and `:344,346` bind to the preceding `SKILL.md:190-191` → out-of-bounds
  (SKILL.md is 320 lines); both intend `decomposition.md`. Lint L-1 caught the range one.
  Fix: explicit `decomposition.md` prefixes, or reorder so decomposition.md is nearest.
- **R3-2 (SHOULD_FIX, fix-induced, Compounds R2-1)** — task 10 / D5 / Scope note assert the
  orchestrator routes `AFFECTS-FUTURE-SPECS` "through the Deferral bar into one record
  tagged `verification`." The Deferral bar (`SKILL.md:167-175`) is a discretionary three-
  part gate, names no `verification` tag, and may file to HANDOFF-as-gotcha. The only
  deterministic `verification`-tagged path is step-8 `VERIFY: pass (deferred: <id>)`
  (`SKILL.md:207`), which task 10 bypasses. Risk: `deferrals list tag=verification`
  (CLAUDE.md) misses the halves → never re-run.
- **R3-3 (MINOR, fix-induced, Novel)** — task 10 Prompt body says one `AFFECTS-FUTURE-SPECS`
  line / one record; Success line says "one per deferred half" (three halves named). Count
  is ambiguous.

## Patterns & Themes
- **Drafter keeps mis-modelling which agent executes a step and what it may do / produce.**
  R1-1/R1-2 (which loaded skill), R2-1 (which tool/permission), now R3-2 (what a routed
  flag deterministically produces). The axis has narrowed from "who can" to "what the cited
  mechanism guarantees." Every "the orchestrator files/routes/tags X" claim must be checked
  against the exact contract of the cited section, not just tool availability.
- **Verify the FULL tool list, not the first slice.** r2 wrongly concluded the orchestrator
  lacked `deferrals` from `:9-17`; the list runs to `:42` and holds it at `:31-33`. Read to
  the closing `---` of frontmatter.
- **Fix-induced citation drift.** Each round's fix rewrites a sentence and the lint pass
  then leaves a bare ref bound to the wrong preceding path (R2-3→R3-1). Bare `:N-M` after a
  multi-path parenthetical is the recurring trap.
- Cross-task signature pins (launcher call, SDD_* set, @deepseek/anthropic totals, alias
  map) are consistent — the fresh "prompt-only implementer" lens found no contradiction
  there. Tasks 7/8 regression safety (r2 lens) and component/requirement coverage remain
  clean; do not re-examine.

## Guidance for Next Review
- Re-check R3-2 hardest: a fix is real only if the deferred halves land as a
  `verification`-tagged `deferrals` record deterministically. Accept only (a) routing
  through the step-8 `VERIFY: pass (deferred: <id>)` path, or (b) task 10/D5 naming the
  `verification` tag on the Deferral-bar record explicitly. Reject a reword that still
  leans on the bar producing the tag on its own.
- R3-1 is a one-token-per-ref citation fix (add `decomposition.md` prefix to both bare
  refs); confirm both, not just the lint-flagged range.
- R3-3 is a wording pick; MINOR, will not keep the loop alive alone.
- Well-covered, do not re-open: R2-1 permitted-writer (orchestrator holds `deferrals`,
  verified `:31-33`); R2-2 (`gotcha` in both lists); R2-3 substance; tasks 7/8 regression;
  cross-task signatures; component/requirement coverage; Req 2 crit 5/7 rulings; compare-
  mode pair placement (task 7/D3); the step-8-grep-slot wiring sub-part of R1-2.
