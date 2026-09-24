# Adversarial Analysis — agent-cache-ttl/requirements (v2), round 1

First adversarial review of this spec's requirements. Primary surface: completeness,
ambiguity, scope. Fresh lens applied: wire contracts across the hook → event-row →
usage-reader → run.start boundary. The Gate A delta (RI-1 / D10) was attacked first.

## What I checked and how

- Read the target v2 in full, the drafter-written `codebase-context.md`, and decomposition
  entry 13 (`.spec-workflow/spec-decomposition/decomposition.md:394-464`); the six Delivers /
  Decided / verification items match the six requirements, so scope is aligned.
- Read both ends of every code range the document leans on: the hook body
  (`harness/hooks/sdd-activity.sh:36-165`), `scripts/sync-plugin-assets.cjs:76-128`,
  `src/watch/ledger.ts:18-42,51-78,283-296`, `src/watch/usage.ts` (whole file),
  `src/watch/render.ts:44-58,192-234`, `src/tools/harness.ts:1063-1084`,
  `harness/skills/sdd-continue/SKILL.md:33-107`,
  `harness/skills/sdd-continue/references/formats.md:160-208`,
  `harness/skills/sdd-continue/references/sdd-providers.sh`, the three orchestrator
  frontmatters, `harness/agent-profiles.json`, and `src/watch/__tests__/render.test.ts:1-60`.
- Verified the Gate A change: `grep` confirms no normative "defer/deferral" clause survives
  (only historical mentions in D10 line 130 and RI-1 line 148); both D10 cross-references
  (Req 6 crit 7, the D10 entry) name block-until-restart; scenarios (4) and (6) text is
  byte-unchanged from v1.
- Confirmed `padRight` pads but never truncates (`render.ts:55-58`) and that the three
  orchestrators are all `claude-opus-4-8 high`, so the document's `claude-opus-4-8 high 1h`
  example is exactly 23 characters.

The pre-fix lint warnings L-1..L-29 are addition-point identifier citations already ruled at
v1; no new evidence, not re-raised.

## Topics attacked

### 1. Req 6 criterion 7 — the Gate A replacement gate (the RI-1 delta)
- Challenge the claim that the PR can "stay not marked ready for review until a session
  restarted on the rebuilt harness has run scenarios (1),(2),(3),(5)": the same sentence
  states worktree changes are live "only after merge and a session restart", and "ready for
  review" is a pre-merge state.
- Stress-test the ordering against this machine's build model (CLAUDE.md: harness runs from
  the main checkout; symlinks and the hook path point at the main checkout, not a worktree).
- Force the failure: trace how any operator reaches a legitimately-ready PR when the evidence
  it gates on cannot exist until after the merge that "ready" precedes.

### 2. buildProfiles — deriving `cacheTtl` from the one-line frontmatter (Req 1 crit 4)
- Challenge "the same generic per-line split that already captures model and effort": that
  split yields the whole value `{ cacheTtl: 1h }`, not `1h`.
- Stress-test the literal method against crit 5's required `cacheTtl: "1h"`.
- Show that `check:plugin-assets` cannot catch a wrong extraction (it compares the file to a
  re-run of the same buildProfiles).

### 3. Usage report — "its Anthropic spawn count" on total rows (Req 4 crit 6)
- Challenge the term "Anthropic spawn count" for phase-total and grand-total cells, which mix
  Anthropic and DeepSeek spawns.
- Stress-test crit 6 against a phase holding some DeepSeek spawns: `cacheUnknown` can never
  equal `ph.total.spawns`, so an all-unknown Anthropic total never prints `unknown`.
- Probe the new `UsageCell` fields (crit 1) for a per-cell Anthropic count — there is none.

### 4. Watch tier line — appending `1h` at the fixed pad width (Req 2 crit 2/3/4)
- Stress-test the interaction of crit 2 (append `<cacheTtl>`), crit 3 (default unchanged) and
  crit 4 (fit at existing render-test widths) against `render.ts:226` `padRight(declared, 23)`.

### 5. Override probe — version compare and settings-file test coverage (Req 5 crit 2/6)
- Challenge "below 2.1.248" with no stated numeric/semver compare, and the single warning text
  over `unknown` against D7.
- Probe the crit 6 test recipe (stub `claude`, point `HOME`) for the code-root settings tiers.

## Findings

### R1-1 — MUST_FIX — Req 6 criterion 7 is unsatisfiable on the machine it describes
The rewritten criterion 7 says the live scenarios (1),(2),(3),(5) "SHALL NOT be recorded as
passed" from the gate session, and the PR "SHALL stay unopened, or if already opened SHALL
stay not marked ready for review, until a session restarted on the rebuilt harness has run
[them]". Its own parenthetical states the premise: "this machine runs the harness from the
main checkout, so worktree changes are live only after merge and a session restart". CLAUDE.md
confirms it — the server is `node /home/mcf/repo/spec-workflow-mcp/dist/index.js`, the agents
and skills are symlinks into the **main checkout's** `harness/`, and the hook is registered
with the main-checkout absolute path; a worktree is a different directory that no restart
points at. Therefore the changed hook/agents/skill become live only after the PR is merged to
main and a session restarts.

But "marked ready for review" is a pre-merge state. So the gate requires post-merge evidence
before a pre-merge transition: to mark the PR ready you need (1),(2),(3),(5); to record them you
need the rebuilt (post-merge) harness; to reach that you must merge; to merge you go through
"ready for review". The gate can never be legitimately satisfied — the PR either blocks forever
or is merged in a draft state, at which point "stay not marked ready until [evidence]" is moot
and contradicted. v1 resolved exactly this with the deferral (run the live half post-restart,
do **not** block the PR). The Gate A choice to block is a closed ruling, but the criterion as
written contradicts the merge/build reality it cites. It must be reworded so the live half is a
**post-merge** verification obligation, not a pre-ready blocker (or the gate must target a
post-merge artifact such as a tracked verification record, not "ready for review").

### R1-2 — SHOULD_FIX — `cacheTtl` extraction method (Req 1 crit 4) yields `1h }`, not `1h`
The frontmatter is one line, `experimental: { cacheTtl: 1h }`. buildProfiles' generic parse
splits each frontmatter line on its first `:` (`scripts/sync-plugin-assets.cjs:94-98`), so
`experimental` maps to the string `{ cacheTtl: 1h }` (codebase-context line 27 says exactly
this). Crit 4 then says to read `cacheTtl` "from the agent's `experimental` frontmatter value
the same generic per-line split that already captures model and effort". Applying that same
first-`:` split to `{ cacheTtl: 1h }` produces key `{ cacheTtl` and value `1h }` — the trailing
brace and spaces are not stripped. That value fails crit 5's required `cacheTtl: "1h"` and would
surface in the watch view as `claude-opus-4-8 high 1h }`. Worse, `npm run check:plugin-assets`
cannot catch it: `syncProfiles` compares the file against a re-run of the same buildProfiles
(`sync-plugin-assets.cjs:112-128`), so a `1h }` bug is self-consistent and green. The criterion
must specify the actual extraction (e.g. match `cacheTtl:` inside the value and trim to the
bare token), and an acceptance test must pin the literal `"1h"` independently of the
self-referential check.

### R1-3 — SHOULD_FIX — "its Anthropic spawn count" is undefined for total rows (Req 4 crit 6)
Crit 6 applies to "every agent line, every phase total line and the grand total line" and keys
the `unknown` decision on `cacheUnknown` equalling "its Anthropic spawn count". Per-agent cells
are single-provider (`usage.ts:131-133` keys DeepSeek spawns as `agent@deepseek`), so for an
Anthropic agent cell the count is `cell.spawns`. But phase-total (`ph.total`) and grand-total
cells mix providers, and DeepSeek spawns add nothing to `cacheUnknown` (crit 4). A phase with 2
all-unknown Anthropic spawns and 3 DeepSeek spawns has `cacheUnknown = 2` and
`ph.total.spawns = 5`; crit 6 wants `unknown` printed, which needs the Anthropic-only count (2),
i.e. `ph.providers.anthropic.spawns` — not `cell.spawns`. The new `UsageCell` fields in crit 1
(`cacheWrite5m`, `cacheWrite1h`, `gapRewrites`, `cacheUnknown`) include no per-cell Anthropic
count, and `providers` is tracked only at phase/report level (`usage.ts:16-24`). An implementer
adding only the four listed fields cannot evaluate crit 6 on total rows and will compare against
`cell.spawns`, printing `sums (+N unknown)` where the intent is `unknown`. State the count
source per cell type.

### R1-4 — MINOR — tier-line pad tension (Req 2 crit 2 vs crit 3 vs crit 4)
`render.ts:226` pads the declared column with `padRight(declared, 23)`, which pads but never
truncates (`render.ts:55-58`). The three 1h agents are `claude-opus-4-8 high` (20) + ` 1h` = 23
characters exactly, so `padRight` adds no space and the tier line renders `...high 1hactual`
with no separator; the existing render test asserts a space (`render.test.ts:55`,
`high +actual`). Restoring a separator means widening the pad, which shifts the `actual` column
for the nine default agents too — grazing crit 3's "unchanged from today". Crit 2/3/4 cannot all
hold cleanly at pad-23; call out the width so design picks one (e.g. pad to the 23-char max plus
a guaranteed separating space) instead of shipping `1hactual`.

### R1-5 — MINOR — version compare unspecified; warning over-claims on `unknown` (Req 5 crit 2/4)
Crit 2.2 marks `unsupported` "when the version is below 2.1.248" but names no numeric/semver
compare; `claude --version` prints `2.1.281 (Claude Code)`, and a lexical compare mis-orders
(e.g. `2.1.9` sorts above `2.1.248`). State that the three components compare numerically.
Separately, crit 4's single warning text asserts "orchestrators will not get the one-hour cache
from frontmatter" for **every** non-`per-agent` value, including `unknown` — but D7 chose
`unknown` precisely because it "neither hides nor invents a fact", and here the warning invents
the claim they will not get the cache when the version simply could not be read. Soften the text
for the `unknown` case or split it.

### R1-6 — MINOR — crit 6 test recipe cannot exercise the settings-file precedence (Req 5 crit 6)
The test "puts a stub executable named `claude` on `PATH` and points `HOME` at a temporary
directory", which reaches value 5 only through `~/.claude/settings.json`. Crit 2.5 has three
settings tiers — the code root's `.claude/settings.local.json`, then `.claude/settings.json`,
then `~/.claude/settings.json` (D8/D11 first-file-wins). Nothing in the recipe controls the code
root (the script's source for "the code root" is also unstated — presumably `$PWD`), so the
local/project precedence and the first-file-wins ordering go untested. Name the cwd/fixture the
test stages so the precedence is actually covered.

## Top 5 risks / gaps

1. The PR gate (R1-1) is a hard contradiction: as written, the spec's own end-to-end
   requirement cannot be met, so implementation cannot legitimately close.
2. The `cacheTtl` extraction (R1-2) has a silent-green failure mode — a wrong value passes
   every automated check and only shows up in the watch view / profiles by eye.
3. The report's `unknown` rule on total rows (R1-3) will misreport whole phases as partially
   known when they are entirely unknown, defeating the point of the `unknown` column.
4. The watch tier line (R1-4) either ships glued text or perturbs the nine default agents;
   small, but it is the visible surface the feature is judged on.
5. Override-probe correctness edges (R1-5, R1-6): version ordering and the settings precedence
   are the exact places a "run on 5m mistaken for 1h" slips through — the failure this whole
   requirement exists to prevent.

## Top 3 conclusions to challenge or reverse

1. **"Block the PR until a restarted session runs the live scenarios" (D10 / Req 6 crit 7).**
   The block-vs-defer choice is a closed Gate A ruling, but the blocking *mechanism* is
   self-contradictory on this machine (R1-1). Reverse the mechanism, not the intent: make
   (1),(2),(3),(5) a mandatory **post-merge** verification obligation that gates the spec's
   completion record, not the PR's "ready for review" state.
2. **"buildProfiles reads cacheTtl with the same generic per-line split" (Req 1 crit 4).**
   It cannot — that split returns `{ cacheTtl: 1h }`. Reverse the claim: specify a dedicated
   extraction and a test that pins `"1h"` independently of `check:plugin-assets`.
3. **"cacheUnknown equal to its Anthropic spawn count" is well-defined (Req 4 crit 6).**
   It is not, for total rows. Either restrict the `unknown` collapse to per-agent cells and
   derive totals from the printed cells, or define the count as `providers.anthropic.spawns`.

## What is missing before acting on this document

- A coherent completion/verification model for the live half (R1-1): where the post-merge
  evidence for (1),(2),(3),(5) is recorded, who records it, and what it actually gates.
- The exact `cacheTtl` extraction rule and an independent assertion of `"1h"` (R1-2).
- The per-cell source of "Anthropic spawn count" for phase-total and grand-total rows (R1-3).
- A stated pad/separator decision for the tier line so crit 2/3/4 are jointly satisfiable
  (R1-4).
- The version-compare rule and the code-root/settings fixtures the crit 6 test needs (R1-5,
  R1-6).

## Verdict

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 2
MINOR: 3
DESIGN_READY: no
ESCALATE: none
```

`iterate` — one MUST_FIX (Req 6 crit 7 is unsatisfiable as written) and two SHOULD_FIX
(cacheTtl extraction, total-row `unknown` rule) block convergence.
