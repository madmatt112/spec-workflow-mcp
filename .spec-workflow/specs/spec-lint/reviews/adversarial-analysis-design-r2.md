# Adversarial Analysis — spec-lint/design (v2), round 2

Attack surface: feasibility, consistency, edge cases. Deltas attacked first (the v2
Revision History: R1-1 tool count, R1-2 Lint-step timing at four call sites, R1-3 L-n /
`LINT.open` on the info-only path, R1-4 `criteria` regex, R1-5 four-backtick limit).
Fresh lens: cold read for internal contradictions + a truth table of the Lint step's
branches against the three round-prompt sections (Machine-verified, Changes, Lint commit).

## Delta verification (both ends of every cited range)

I re-read the four call-site lines in `harness/skills/sdd-document-phase/SKILL.md` the v2
Component 8 now cites, and confirmed each is a `D` update, not a commit:
- `:98` = "6. D = 1. Go to Step 2." (Step 1)
- `:129` = "…SHOULD_FIX-only corrective pass`, D = D + 1; then Step 4b…" (Step 2 item 9)
- `:144` = "6. D = D + 1. Go to Step 2." (Step 3)
- `:228` = "3. D = D + 1. Go to Step 2." (Step R)

R1-2 traced end to end (v1 → round 1 → v2 lint → round 2 changes script):
- Step 1 commits `v1`, then `D = 1`, then Lint step → `v1 lint`, D unchanged. Round 1's
  `append-changes.sh 1` uses `pat='^docs\(sdd\): … v1$'` (anchored `$`), so the base is
  the pure `v1` checkpoint and the diff shows the v1 lint fixes. Correct.
- Step 3 commits `v2 after round 1`, then `D = 2`, then Lint step → `v2 lint`. Round 2's
  `append-changes.sh 2` uses `want=1`, `pat='… v1( |$)'`; `git log -1` returns the newest
  `v1`-holding commit = `v1 lint`, and the `D>1` branch greps `… v2 lint$` for the Lint
  commit section. Both match. This is exactly requirement 9.4 ("its prior lint commit,
  else checkpoint") — the v1→v2 label mismatch R1-2 warned of is gone. **R1-2 resolved.**
- Probe reconfirmed live: `git log -1 -E --grep='^docs\(sdd\): spec-lint requirements
  v4( |$)'` returns `69ff43f` (`… v4 SHOULD_FIX-only corrective pass`, `-s` trailer) and
  `v9( |$)` returns nothing, exit 0. The `( |$)` anchor rejects `v40`-style prefix
  collisions. Script anchoring holds.

R1-1: `src/tools/index.ts:16-31` holds 12 entries today (`specWorkflowGuideTool` …
`getTaskReviewTool`); +`spec-lint` = 13. Component 10 now states "13 tools". Correct.
R1-3: `L-n` numbering is in sub-step (2); the early-exit sets `LINT.open` = info findings;
sub-step (7) is guarded "if not ended at (2)". Info-only path resolved for numbering.
R1-4: `criteria` is `^(\d+)\.\s+(.*)$`, matching requirement 4.1's `^\d+\.\s`. Correct.
R1-5: D2 flags the four-backtick fence as a known limit. Correct.

**Trims did not drop a constraint.** The v1→v2 diff removed only two inline type comments
(`file` "always `<phase>.md`", `message` "at most 200 characters"); both survive as
behaviour in Component 2 (`finishLint` sets `file`; `truncateLine`/`MAX_LINE_CHARS = 200`).
Decisions D1–D13 and Testing Strategy were compressed, not weakened. No dropped constraint.

**Truth table (all six branches consistent).** For D∈{1,>1} × {skipped, zero
error+warning, error+warning>0}: Machine-verified is omitted only when skipped; the
"no lint pass ran" phrase and the absence of a `## Lint commit` section co-occur exactly
when no `v<D> lint` commit exists; the `D=1: ## Changes since` vs `D>1: ## Lint commit`
pointer matches the script's `if [ "$D" -gt 1 ]` guard. No branch is defined two ways.

---

## Findings

### R2-1 — `LINT.open` on the full path has no source for "partially accepted"; the lint brief drops the disposition report (SHOULD_FIX, Compounding on R1-3)

Component 8 sub-step (7): "if not ended at (2): `LINT.open` = every `L-n` **the report
marks `rejected` or `partially accepted`**, plus every `info` finding (D10)." D10 repeats
"every `L-n` the reviser reports `rejected` or `partially accepted`."

But the lint brief, as Component 8 defines it, gives the orchestrator no way to learn which
`L-n` were partially accepted, and arguably no disposition report at all:

1. **The Job is replaced whole.** Component 8 sets the lint brief Job to
   `Fix the lint findings below in v<D> of <document path> in place`. The general reviser
   Job it copies from (`briefs.md:156-158`) is "Produce v<D+1> … then report … **each
   finding as `<id>: accepted | partially accepted | rejected`** …". The replacement is a
   complete Fix-only sentence with no "then report" clause, so the lint reviser is not
   told to return per-finding dispositions. Sub-step (5) only spot-checks
   `grep -n 'Lint pass' <document>` (existence), not the dispositions.
2. **The one structured record has no partial slot.** Rule 4 becomes
   `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, …>`. It carries "fixed"
   (a count) and "rejected" (a list). A "partially accepted" finding lands in neither.

So on the full path (error+warning>0) the orchestrator can, at best, recover the
`rejected` `L-n` (by reading the Lint-pass bullet — which the design never says it reads)
plus `info`. The **partially-accepted members of `LINT.open` are unrecoverable**, so the
Machine-verified "Still open" list silently omits every partially-fixed finding and the
reviewer never sees the unresolved remainder. This is the R1-3 defect (LINT.open source
under-specified) reappearing on the branch R1-3 did not touch: R1-3 fixed the early-exit
path, this is the reviser-ran path.

This is grounded in the design's own text, not the codebase: D10 and sub-step (7) consume
a disposition (`partially accepted`) that neither the Job nor rule 4 produce.

Fix, net-neutral on words (the document is at 4,000/4,000, zero headroom): either
(a) drop "partially accepted" from D10 and sub-step (7) — lint fixes are mechanical (D12),
so a lint finding is fixed or rejected, matching rule 4's two-slot bullet; or (b) name the
source explicitly: keep a one-line disposition report in the lint brief Job and add a
`partially accepted:` slot to rule 4's bullet, and state that sub-step (7) reads
`LINT.open`'s non-info members from it.

---

## Top risks / gaps

1. **Partially-fixed lint findings vanish before the reviewer sees them** (R2-1). The most
   likely real-world case (a citation the reviser corrects one end of, a task block it
   trims but not under cap) is exactly "partially accepted", and the round prompt would
   not list it. SHOULD_FIX because it is a wrong reviewer hand-off, not a crash.

## Top 3 conclusions to challenge

1. **"R1-2 accepted; timing fixed."** True and verified — but the fix leans entirely on
   requirement 9.4's `v<D-1>( |$)` base semantics. If any future edit anchors that pattern
   with `$` (as the D=1 branch is), round-2+ diffs would jump to the wrong base. The
   asymmetry (D=1 anchored, D>1 not) is load-bearing and undocumented as such.
2. **D10's "rejected or partially accepted".** Reverse to "rejected" only, unless a
   recording slot is added; the design promises a disposition it cannot deliver (R2-1).
3. **"Nothing else … is cut or deferred; the four sites stay identical."** The SHOULD_FIX-
   only pass site (`:129`) now runs a Lint step whose `v<D> lint` commit no `## Changes`
   script ever consumes (Step 2 item 9 goes to Step 4b, not Step 2). Harmless — the fixes
   land in the approved document and the narrow check still verifies the SHOULD_FIX items —
   so this is *actually fine*, but "identical" overstates it: three sites feed a following
   Step 2, one does not.

## What's missing before acting

- One sentence naming where the orchestrator reads each `L-n`'s disposition for
  `LINT.open`, and a reconciliation of "partially accepted" with rule 4's bullet (R2-1).
- Because the document is exactly at the 4,000-word cap, the R2-1 edit must remove as many
  words as it adds; the cleanest form (option a) is a net cut.

Everything else in the v2 delta checks out: the four call-site line numbers are accurate
at both ends, the tool count is 13, the `criteria` regex matches 4.1, the trims dropped no
constraint, and the six Lint-step/round-prompt branches are each defined once.

ESCALATE: none.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 0
DESIGN_READY: no
ESCALATE: none
```
