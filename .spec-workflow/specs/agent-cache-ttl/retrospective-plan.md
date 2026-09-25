# Retrospective plan — agent-cache-ttl

Status: CLOSED

Approved 2026-09-25 in the supervisor's retrospective conversation. Matthew chose P15
option A and left the other approvals to the supervisor ("You decide which are worth it").

## Decisions

- P15: option A — document the operator pre-merge-session pattern (spawn kit, restart, run,
  record) as the standing way. No code change. Implement it together with G2: they state the
  same rule.
- Supervisor selection: approve the fixture-kit group (P7, P8, P9, P14, G1), the skill
  frontmatter gate (P10), and the two live-check guidance notes (P2, P3). Reject P1.

## Approved proposals

- **P2 (F2) — Capture the resume-behaviour rule in the pass-bar note.** Record the "Claude Code
  re-sends the last turn on subagent resume, so measure content older than the last turn" fact
  where cache-hit scenarios are written, so a future spec sets the bar right first time.
  Target: harness skills or agents (sdd-implementation-phase references).
  Decision: approved (supervisor). One sentence.

- **P3 (F3) — Document the spawn-end-turn-wake probe pattern for long-gap live checks.** The
  Bash tool caps at 600 s and Claude Code backgrounds subagent spawns, so a probe cannot force a
  >600 s gap or a foreground worker. Write the working pattern (spawn, end the turn, wake on the
  completion notification) into the live-check guidance.
  Target: harness skills or agents (sdd-implementation-phase verification section).
  Decision: approved (supervisor).

- **P7 (F7) — Give scratch-store spec folders a routing-safe shape.** A fixture that seeds a
  scratch spec store either registers the probe spec in that store's decomposition.md or names
  the folder so spec-index does not treat it as a routable spec. Part of the G1 fixture-kit rule.
  Target: project steering / decomposition conventions (agent-rules.md).
  Decision: approved (supervisor); land with G1.

- **P8 (F8) — Require a description line on every generated fixture agent.** Any generated
  agent carries a non-empty, YAML-valid, double-quoted description. Part of the G1 fixture-kit
  rule.
  Target: project steering / decomposition conventions (agent-rules.md).
  Decision: approved (supervisor); land with G1.

- **P9 (F9) — Dry-run the live-verification fixture kit before the gated run.** A verification
  task that ships a fixture kit runs the kit once in the scratch store (registration and a no-op
  probe) and records it green before the gated live run begins.
  Target: harness skills or agents (sdd-implementation-phase verification section; sdd-verifier).
  Decision: approved (supervisor).

- **P10 (F10) — Extend the frontmatter YAML gate to skill `SKILL.md` files.** Add the same
  `js-yaml` parse-or-throw over each `harness/skills/*/SKILL.md` frontmatter in
  `sync-plugin-assets.cjs`, and double-quote any current offenders.
  Target: server code / scripts (`sync-plugin-assets.cjs`) plus harness skills.
  Decision: approved (supervisor).

- **P14 (F14) — Hold generated fixtures to the shipped-artifact validity bar.** Promote the rule
  behind P7, P8 and P9; implemented as graduation candidate G1.
  Target: project steering (agent-rules.md).
  Decision: approved (supervisor); implemented by G1.

- **P15 (F15) — Document the operator pre-merge-session pattern for live scenarios that need a
  rebuilt-harness restart.** The standing way: spawn the kit, restart on the rebuilt harness, run,
  record the result in `verification-evidence.md`. No code change.
  Target: harness skills or agents (sdd-implementation-phase verification section); CLAUDE.md
  verification convention.
  Decision: option A (Matthew); land with G2.

## Graduation candidates

- **G1 — Fixtures are held to the shipped-artifact validity bar** (agent-cache-ttl F4/F7/F8,
  review-gate). Rule text: "A fixture or generated artifact used in a live check must meet the
  same validity bar as a shipped one: YAML-valid, double-quoted frontmatter, a non-empty
  description on every generated agent, and no incomplete spec folder that spec-index would route.
  A task that ships a fixture kit dry-runs it in the scratch store and records it green before the
  gated run."
  Target: `.spec-workflow/agent-rules.md`.
  Decision: approved (supervisor).

- **G2 — Live scenarios stay pending behind a tracked evidence file, not a deferral**
  (agent-cache-ttl F13, question-gates d-1880d115). Rule text: "A live-verification scenario
  that cannot run inside the normal loop stays `pending` and is gated by a tracked
  `verification-evidence.md` whose every line must read `passed` before the retrospective opens;
  an operator runs it in a rebuilt, restarted session. Do not close it with a silent harness
  decision."
  Target: `.spec-workflow/agent-rules.md`.
  Decision: approved (supervisor); carries P15 option A.

## No-change confirmations

P4, P5, P6 (fixed on PR #64), P11 (folded into P2), P12 (Gate A worked as intended) and P13
(tracked-evidence gate worked; promoted as G2) need no work.

## Rejected

- **P1 (F1) — Name the cache-field transcript source in the verification plan.** Rejected: it
  fits this spec's one scenario only; P9's dry-run surfaces a missing data source anyway.

## Close-out

One line per proposal, written by the close-out phase.

- G1: done — d733799
- P7: done — d733799
- P8: done — d733799
- P14: done — d733799
- G2: done — e8a58b4
- P2: done — 56e8884
- P3: done — 3193b95
- P9: done — 1485bc6
- P10: done — a44b7ed
- P15: done — 5d50bb5
- spec-workflow-mcp: PR https://github.com/madmatt112/spec-workflow-mcp/pull/66
