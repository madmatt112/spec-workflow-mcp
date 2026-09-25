# Retrospective — agent-cache-ttl

Compiled 2026-09-25 by the retro orchestrator from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

## Gotchas

- **F1 — Only one spec-run transcript carries the ephemeral cache fields.** Scenario (4)
  had to pair the one spec-run subagent transcript that showed `cacheWrite5m`/`1h` with a
  second real-project transcript to get a second data point. Evidence: HANDOFF
  agent-cache-ttl implementation gotchas; retro log task 9 (2026-09-24T20:01:41Z).
  Frequency: once. Cost: unknown (extra transcript sourcing, no rounds).
- **F2 — Scenario (2) pass bar was wrong on first design.** Reading the whole previous
  prefix scored only 80% because Claude Code re-sends the last turn on subagent resume;
  the correct measure is content older than the last turn (100% after an 819 s gap).
  Evidence: retro log ruling 2026-09-25T15:31:22Z; commit a615375. Frequency: scenario (2)
  re-run three times. Cost: two extra scenario runs.

## Product bugs found

None found. (All defects were in the SDD harness itself — see Harness defects.)

## Tool and MCP errors or deficiencies

- **F3 — No way to force a >600 s gap or a foreground subagent spawn in a probe.** The
  scenario (2) live probe cannot make a one-hour-TTL-relevant gap with `sleep` (Bash tool
  timeout caps at 600000 ms) and cannot spawn its worker in the foreground (Claude Code
  2.1.282 backgrounds subagent spawns). The probe must instead spawn, end the turn, and
  wake on the completion notification. Evidence: retro log 2026-09-25T00:33:28Z.
  Frequency: once (one too-short-gap run). Cost: one scenario-2 run.

## Harness defects

- **F4 — All 12 `harness/agents/sdd-*.md` frontmatters have been invalid YAML since
  written.** The unquoted `description` contains `': '`, so Claude Code silently drops the
  experimental `cacheTtl` mapping (it still reads name/model/effort/tools). Live scenario
  (1) exposed it: cw1h 0 / cw5m 49204, versus cw1h 33242 / cw5m 0 with the description
  double-quoted. Fixed on PR #64: all 12 descriptions quoted, launcher unquotes,
  sync-plugin-assets fails on invalid agent frontmatter. Evidence: commit 91d11aa; retro
  log 2026-09-24T21:04:59Z. Frequency: latent across all 12 agents since inception. Cost:
  one failed scenario-1 run + one fix commit.
- **F5 — `spawn.end` first-yield undercount since PR #62 P17.** The SubagentStop marker let
  only the first SubagentStop of a spawn write `spawn.end`, so a yielding orchestrator held
  its usage at the first yield; every orchestrator token figure since P17 is an undercount
  (scenario (3): 49204/0 then 6 unrecorded calls vs recompute 53309). Fixed on PR #64: the
  hook writes a fresh `spawn.end` per usage change, keyed by agentId; usage/ledger keep the
  latest row. Evidence: commit 59a6374; retro log 2026-09-24T21:27:42Z. Frequency: every
  orchestrator since P17. Cost: two scenario runs + one fix commit.
- **F6 — Unit tests passed on the invalid frontmatter because the build script reparses
  leniently.** `sync-plugin-assets.cjs` used its own line parser, which reads exactly what
  Claude Code drops, so nothing caught F4 until the live check. Blocking the PR on the
  gate-A live checks is what caught it. Evidence: scripts/sync-plugin-assets.cjs
  buildProfiles; retro log 2026-09-24T21:04:59Z gotcha. Frequency: once. Cost: none beyond
  the failed run.
- **F7 — A scratch store for a live check routed ambiguous.** `e2e-setup.sh` created
  `specs/cache-gap-probe/` in the scratch store; spec-index saw an incomplete spec absent
  from decomposition.md, routing returned ambiguous, the supervisor refused to pick.
  Overwatch wrote `deferred.json` and patched the setup script. Evidence:
  /tmp/scratchpad/sdd/agent-cache-ttl/e2e-setup.sh; retro log 2026-09-24T20:42:08Z.
  Frequency: once (would have hit scenario 5 too). Cost: one failed scenario-1 launch.
- **F8 — Generated fixture agents had no description and failed to register.**
  `e2e-setup.sh` wrote `sdd-cache-probe.md` / `-worker.md` with no description line; Claude
  Code does not register an agent without one ("Agent type sdd-cache-probe not found").
  Evidence: /tmp/scratchpad/sdd/agent-cache-ttl/e2e-setup.sh; retro log
  2026-09-25T00:20:24Z. Frequency: once. Cost: one failed scenario-2 launch.

## Prompt misunderstandings

None found.

## Inefficiencies

- **F9 — Three fixture-repair cycles inside the live-verification run.** The C8 scratch
  probe kit failed to start three separate ways (F7 stray spec folder, F8 missing
  descriptions, F3 non-waiting probe) plus the F2 pass-bar amendment, each patched by
  overwatch out of band. The live check is real value, but the fixture kit was not exercised
  before the run. Evidence: retro log entries 2026-09-24T20:42Z, 2026-09-25T00:20Z,
  00:33Z, 15:31Z. Frequency: 4 restart/patch cycles this spec. Cost: several scenario
  re-runs across an afternoon.

## Documentation gaps

- **F10 — Skill `SKILL.md` descriptions carry the same unquoted `': '` pattern and are not
  checked.** F4's fix guards agent frontmatter only; the skill files have the identical
  latent defect and no validation. Evidence: retro log 2026-09-24T21:04:59Z gotcha.
  Frequency: latent, all skills. Cost: unknown (future silent-drop risk).

## Model behaviour

None found. Every document phase converged fast (design v1, tasks v1); the three drafter
RE-DECIDED literals per phase were all ruled refinement/closed by the reviewer.

## Process deviations and rulings

- **F11 — Scenario (2) pass bar amended mid-verification by Matthew.** The measured bar
  moved from whole-prefix read to older-than-last-turn read after the resume behaviour was
  understood (see F2); recompute.mjs was changed to match. Evidence: retro log ruling
  2026-09-25T15:31:22Z. Frequency: once. Cost: folded into F2.
- **F12 — Requirements re-entered at v1 through a Gate A revision.** MODE revision made the
  live verification scenarios (1),(2),(3),(5) non-deferrable and block-until-restart (RI-1),
  and reconciled a pre/post-merge deadlock plus two unknown-cache truth-table
  contradictions. Evidence: retro log 2026-09-24T16:02:46Z; HANDOFF requirements; approval
  approval_1790265698477_k4x8xi0qt. Frequency: once (6 reviser spawns in requirements).
  Cost: 2 reviewer + 1 checker + 6 reviser spawns.

## Decisions the harness made for the human

- **F13 — Live scenarios left `pending` with no deferral, gated on a tracked evidence
  file.** Per requirements D10 the four live scenarios stayed pending and the tracked
  `verification-evidence.md` blocked the retrospective until every line read `passed`,
  rather than filing a deferral. The operator (overwatch, headless after Matthew's scratch
  login) ran the pre-merge C8 sequence. All four now `passed`. Evidence:
  verification-evidence.md; HANDOFF implementation; requirements D10. Frequency: once. Cost:
  the F9 fixture cycles.

## Repeat patterns

- **F14 — Live-check / generated fixtures are not held to the shipped-artifact validity
  bar.** This spec hit it three times (F4 invalid YAML also latent in shipped agents, F7
  stray spec folder, F8 missing descriptions). review-gate found the same class: a "fixture
  cannot produce the asserted verdict" defect (review-gate/retrospective.md:167). Evidence:
  this spec retro log 2026-09-24T21:04:59Z / 20:42:08Z / 2026-09-25T00:20:24Z;
  review-gate/retrospective.md:167. Frequency: 3 in this spec, seen in review-gate.
- **F15 — Running live verification needs a rebuilt-harness restart the normal loop cannot
  do.** question-gates deferred its live gate scenarios (d-1880d115, cited in HANDOFF); this
  spec needed an operator pre-merge session plus repeated overwatch intervention. Evidence:
  HANDOFF "Next deferrals worth working"; this spec F9/F13. Frequency: seen in question-
  gates and here.

## Summary numbers

| Metric | Value |
| --- | --- |
| Phases | 4 (requirements, design, tasks, implementation) |
| Versions per phase | req v4, design v1, tasks v1 |
| Review rounds | req 3 (2 adversarial + 1 narrow check), design 1, tasks 1 |
| Fix rounds (implementation) | 0 |
| Adjudications | 0 |
| Escalations | 0 |
| Rulings | 1 (scenario (2) bar amendment) + Gate A requirements revision |
| Deferrals added | 0 |
| Worker spawns (implementation) | 11 (8 implementer + 2 verifier + 1 log) |
| Live-verification harness defects found + fixed | 2 (F4, F5) on PR #64 |
| PR | #64, merged 12cb20f |

## Proposal format (for the analyst)

One proposal per finding, numbered P<n> and naming the finding it answers:

- **P<n> (F<m>) — <title>.** <the change, one to three sentences>.
  Target: <harness skills or agents | server code, docs or templates | project steering,
  templates or decomposition conventions | CLAUDE.md, memory or settings | product code>.
  Effort: <S | M | L>. Risk: <low | medium | high>: <one line>.
  Prerequisites: <none | list>.
  DECISION NEEDED: <yes | no>. <When yes: the question, then two to four options, one
  line each, with your recommendation marked.>

The file ends with `## Graduation candidates`: patterns seen in two or more specs'
findings, each proposed for promotion into a steering document or agent-rules.md,
with the rule text as it would be written.
