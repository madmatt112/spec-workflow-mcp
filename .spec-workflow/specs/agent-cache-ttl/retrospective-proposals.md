# Retrospective proposals — agent-cache-ttl

One proposal per finding. F4, F5 and F6 were already fixed on PR #64; those proposals
confirm the fix and, where a sibling surface still carries the same latent defect, extend
it (F10).

- **P1 (F1) — Name the cache-field transcript source in the verification plan.** Scenario (4)
  needed two transcripts carrying `cacheWrite5m`/`1h` and only one spec-run subagent had them,
  so a real-project transcript was paired in ad hoc. When a scenario asserts on ephemeral
  fields present in few transcripts, the verification design should list where each data point
  comes from before the run.
  Target: harness skills or agents (sdd-implementation-phase verification section).
  Effort: S. Risk: low: guidance only, no behaviour change.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P2 (F2) — No change; capture the resume-behaviour rule in the pass-bar note.** The bar moved
  from whole-prefix read to older-than-last-turn read because Claude Code re-sends the last turn
  on subagent resume. This is a correct one-off refinement, not a defect. Optionally record the
  "last turn is re-sent, measure older content" fact where cache-hit scenarios are written so a
  future spec sets the bar right first time.
  Target: harness skills or agents (sdd-implementation-phase references).
  Effort: S. Risk: low: a single sentence.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P3 (F3) — Document the spawn-end-turn-wake probe pattern for long-gap live checks.** The
  Bash tool caps at 600 s and Claude Code backgrounds subagent spawns, so a probe cannot force a
  >600 s gap or a foreground worker. The working pattern (spawn, end the turn, wake on the
  completion notification) should be written into the live-check guidance so the next probe
  author does not rediscover it. No tool change: the caps are external to this repo.
  Target: harness skills or agents (sdd-implementation-phase verification section).
  Effort: S. Risk: low: documentation of an external constraint.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P4 (F4) — No further change; the fix is complete.** All 12 agent descriptions are now
  double-quoted, the launcher unquotes, and `sync-plugin-assets.cjs` fails on invalid agent
  frontmatter (PR #64). The cause — unquoted `': '` silently dropping `experimental` — is
  removed at both the data and the gate. See P10 for the still-open skill sibling.
  Target: harness agents (already landed).
  Effort: S. Risk: low: confirmation only.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P5 (F5) — No further change; the fix is complete.** The hook now writes a fresh `spawn.end`
  per usage change keyed by `agentId`, and usage/ledger keep the latest row (PR #64). Yielding
  orchestrators no longer freeze their usage at the first yield. Historical figures since P17
  remain undercounts but are not re-derivable and need no action.
  Target: harness hooks (already landed).
  Effort: S. Risk: low: confirmation only.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P6 (F6) — No further change; lenient parser replaced.** `sync-plugin-assets.cjs` now loads
  frontmatter through `js-yaml` and throws on the exact input Claude Code drops, so a unit run
  can no longer pass invalid frontmatter. The gate-A live check that caught F4 stays the
  backstop. Cause removed.
  Target: server code / scripts (already landed).
  Effort: S. Risk: low: confirmation only.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P7 (F7) — Give scratch-store spec folders a routing-safe shape.** `e2e-setup.sh` wrote an
  incomplete `specs/cache-gap-probe/` that spec-index saw as a spec missing from
  decomposition.md, so routing returned ambiguous. A fixture that seeds a scratch spec store
  should either register the probe spec in that store's decomposition.md or name the folder so
  spec-index does not treat it as a routable spec. Fold this rule into the fixture-kit
  convention (see P9).
  Target: project steering / decomposition conventions (agent-rules.md).
  Effort: S. Risk: low: narrow convention.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P8 (F8) — Require a description line on every generated fixture agent.** Claude Code does not
  register an agent with no `description`, so the probe/worker fixtures failed with "Agent type
  not found". The fixture-kit convention should state that any generated agent carries a
  non-empty, YAML-valid, double-quoted description — the same bar the shipped agents now meet.
  Rolled into P9.
  Target: project steering / decomposition conventions (agent-rules.md).
  Effort: S. Risk: low.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P9 (F9) — Dry-run the live-verification fixture kit before the gated run.** The C8 probe kit
  failed to start three ways (F7, F8, F3) plus the F2 bar amendment, each patched out of band
  across an afternoon. The smallest fix: a verification task that ships a fixture kit must run
  the kit once in the scratch store — registration and a no-op probe — and record it green
  before the gated live run begins. This turns three restart cycles into one dry-run.
  Target: harness skills or agents (sdd-implementation-phase verification section; sdd-verifier).
  Effort: M. Risk: low: adds a pre-flight step, no gate weakened.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P10 (F10) — Extend the frontmatter YAML gate to skill `SKILL.md` files.** The F4 fix guards
  agent frontmatter only; skill descriptions carry the identical unquoted `': '` pattern and are
  unchecked, so a skill can still silently drop a mapping. Add the same `js-yaml` parse-or-throw
  over each `harness/skills/*/SKILL.md` frontmatter in `sync-plugin-assets.cjs` (or its skill
  path), and double-quote any current offenders.
  Target: server code / scripts (`sync-plugin-assets.cjs`) plus harness skills.
  Effort: S. Risk: low: mirrors a landed, tested pattern.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P11 (F11) — No change; folded into P2.** The scenario (2) bar amendment and the matching
  `recompute.mjs` edit are the same event as F2. Covered by P2.
  Target: none.
  Effort: S. Risk: low.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P12 (F12) — No change; Gate A did its job.** The v1 requirements re-entry (6 reviser spawns)
  made the live scenarios non-deferrable and reconciled the pre/post-merge deadlock and two
  truth-table contradictions. This is Gate A catching an ambiguity before build, which is the
  intended cost. No rule change; the spawn count is the price of a correct requirements set.
  Target: none.
  Effort: S. Risk: low.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P13 (F13) — No change; the tracked-evidence gate worked as designed.** Per requirements D10
  the four live scenarios stayed `pending` and the tracked `verification-evidence.md` blocked the
  retrospective until every line read `passed`, instead of filing a deferral. The operator ran
  the pre-merge C8 sequence and all four passed. The mechanism held the line without a human
  choice; keep it. See the graduation candidate below for promoting the pattern.
  Target: none (candidate for graduation).
  Effort: S. Risk: low.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P14 (F14) — Hold generated fixtures to the shipped-artifact validity bar.** This spec hit the
  class three times (F4 latent invalid YAML, F7 stray spec folder, F8 missing descriptions) and
  review-gate hit "a fixture cannot produce the asserted verdict". The concrete fix is P9's
  dry-run plus P7/P8's fixture-kit conventions; this proposal promotes the underlying rule (see
  Graduation candidates).
  Target: project steering (agent-rules.md).
  Effort: M. Risk: low: convention plus one pre-flight step.
  Prerequisites: P7, P8, P9.
  DECISION NEEDED: no.

- **P15 (F15) — Give live verification a first-class rebuilt-restart path.** question-gates
  deferred its live gate scenarios (d-1880d115) and this spec needed an operator pre-merge
  session plus repeated overwatch intervention, because the normal loop cannot rebuild the
  harness and restart the session mid-run. This needs a human decision on how much to invest.
  Target: harness skills or agents; CLAUDE.md verification convention.
  Effort: M. Risk: medium: touches the run/restart lifecycle.
  Prerequisites: none.
  DECISION NEEDED: yes. How should the harness handle a live scenario that only passes after a
  rebuilt-harness restart?
  - A) Document the operator pre-merge-session pattern (spawn kit, restart, run, record) as the
    standing way, no code change. **(recommended)** — matches what worked here and in question-gates.
  - B) Add a deferral type "needs-rebuilt-restart" that the loop files automatically and a later
    restarted session drains, like the existing `tag=verification` records.
  - C) Build in-loop rebuild-and-restart orchestration — largest change, most fragile.

## Graduation candidates

- **Fixtures are held to the shipped-artifact validity bar** (seen in agent-cache-ttl F4/F7/F8
  and review-gate). Rule text: "A fixture or generated artifact used in a live check must meet the
  same validity bar as a shipped one: YAML-valid, double-quoted frontmatter, a non-empty
  description on every generated agent, and no incomplete spec folder that spec-index would route.
  A task that ships a fixture kit dry-runs it in the scratch store and records it green before the
  gated run." Target document: `.spec-workflow/agent-rules.md`.

- **Live scenarios stay pending behind a tracked evidence file, not a deferral** (seen in
  agent-cache-ttl F13 and question-gates d-1880d115). Rule text: "A live-verification scenario
  that cannot run inside the normal loop stays `pending` and is gated by a tracked
  `verification-evidence.md` whose every line must read `passed` before the retrospective opens;
  an operator runs it in a rebuilt, restarted session. Do not close it with a silent harness
  decision." Target document: `.spec-workflow/agent-rules.md` (or the implementation-phase skill).
