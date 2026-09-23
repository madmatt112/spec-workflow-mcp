# Retrospective proposals — provider-per-role

One proposal per finding of `retrospective.md`. Format per that file's header.

## Proposals

- **P1 (F1) — Require `${VAR:-}` for env reads in generated shell under `set -u`.** The
  launcher template and any task that authors a `set -u` shell script must read optional
  environment variables as `${VAR:-}`, never bare `$VAR`, so an unset key hits the intended
  no-row path instead of unbound-variable exit 1. Add the rule to the decomposition
  conventions for shell-authoring tasks and to `review-task`'s shell checklist.
  Target: project steering, templates or decomposition conventions.
  Effort: S. Risk: low: a one-line convention, the code fix already landed (044bbc3).
  Prerequisites: none.
  DECISION NEEDED: no.

- **P2 (F2) — Supervisor preflights provider secrets before the implementation phase.**
  Before spawning the implementation orchestrator, the supervisor reads the `## Providers`
  map and, for every non-anthropic provider named, checks its required key is exported; a
  missing key stops with a plain-text ask up front instead of burning an implementer spawn
  and a mid-phase escalation that blocks dependent tasks.
  Target: harness skills or agents (`sdd-continue` supervisor preflight).
  Effort: M. Risk: low: preflight only reports, never writes.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P3 (F3) — E2E tasks that stage a scratch store must name a distinct event-script
  path.** A task brief that tells the implementer to build a scratch store with its own
  event script must give an explicit path under that scratch store (e.g.
  `<scratch-store>/event.sh`) and state that it must not be the supervisor's
  `EVENT_SCRIPT`. Pair with an implementer standing rule: never write to the
  `EVENT_SCRIPT` path from the launch prompt.
  Target: project steering, templates or decomposition conventions; and `sdd-implementer`
  agent rules.
  Effort: S. Risk: low: wording plus one standing rule.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P5 (F5) — Same fix as P3.** The root cause of F3 was the brief's "its own event.sh"
  wording naming no distinct location. P3's decomposition-convention wording (name an
  explicit scratch-store path, forbid the shared `EVENT_SCRIPT`) removes this cause; no
  separate change.
  Target: project steering, templates or decomposition conventions.
  Effort: S. Risk: low: folded into P3.
  Prerequisites: P3.
  DECISION NEEDED: no.

- **P4 (F4) — Add a ledger truncate-on-resume helper.** The supervisor already recovers by
  hand: on resume, before appending, truncate `harness-events.jsonl` to its last complete
  line (drop a trailing partial line and any NUL run). Ship this as a small shell helper the
  resume path calls, so crash recovery is one documented step, not manual surgery.
  Target: harness skills or agents (supervisor resume path in `sdd-continue`).
  Effort: M. Risk: low: only trims an already-corrupt tail; keeps the same run id.
  Prerequisites: none.
  DECISION NEEDED: yes. How much crash-resilience does the ledger warrant?
    - A) Truncate-on-resume helper only (recommended) — covers the observed crash, small.
    - B) A + fsync/atomic append on every `event.sh` write — fewer partial lines, more IO.
    - C) No change — keep manual truncation; the case is rare (once).

- **P6 (F6) — No separate change; fixed by P11.** Requirements hit the v4 cap because every
  post-r1 MUST_FIX was fix-induced (F11), not because the cap or convergence rule is wrong.
  Removing the fix-induced findings (P11) is what keeps this phase under the cap.
  Target: harness skills or agents (see P11).
  Effort: S. Risk: low: no change here.
  Prerequisites: P11.
  DECISION NEEDED: no.

- **P7 (F7) — No separate change; fixed by P11.** Tasks hit the v4 cap with the same
  fix-induced shape as F6. P11 addresses the shared cause.
  Target: harness skills or agents (see P11).
  Effort: S. Risk: low: no change here.
  Prerequisites: P11.
  DECISION NEEDED: no.

- **P8 (F8) — Caveat the "no MCP server" line for the eligible reviser.** In
  `docs/SDD-HARNESS.md` the DeepSeek-child sentence "given only the agent's frontmatter
  tools and no MCP server" reads as absolute, but the eligible `sdd-reviser` is launched
  with `--mcp-config` (design.md:133). Add a clause noting the reviser is the exception
  because its `adversarial-response` tool needs the server.
  Target: server code, docs or templates (`docs/SDD-HARNESS.md`).
  Effort: S. Risk: low: documentation only.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P9 (F9) — Fix the garbled auth-path clause in a later phase.** Req 6 crit 5's clause
  ("a 'no' answer fails preflight (a)") does not parse cleanly; it was correctly deferred at
  approval and carried as a design note. No harness change: the reviser or a later
  requirements edit rewrites the sentence when the criterion is next touched.
  Target: no change (spec-local document edit, already deferred).
  Effort: S. Risk: low: cosmetic, intent already inferable.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P10 (F10) — No change.** The stale CLI citation (`2.1.278` vs installed `2.1.280`) was
  flagged MINOR and out-of-scope by the adjudicator and left for a later phase. Version
  strings drift; pinning one in a criterion invites this. No harness change warranted.
  Target: no change.
  Effort: S. Risk: low: cosmetic, out of scope.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P11 (F11) — Reviser must fix every site of a multi-site finding.** Add an
  `sdd-reviser` standing rule: when a finding names a claim, value, decision or citation
  that can recur, `grep` for every occurrence and fix all of them in one pass; a partial
  fix that leaves a contradiction remnant is a MUST_FIX next round. This is the shared cause
  of F6, F7 and the fix-induced cap runs.
  Target: harness skills or agents (`sdd-reviser` agent).
  Effort: S. Risk: low: one standing rule, aligns with the existing citation-verify rule.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P12 (F12) — No change.** The two design rulings (Req 2 crit 5 alias/effort split, crit 7
  `--add-dir` for an out-of-root store) were resolved as refinement inside round 1 with no
  extra spawn. The ruling path worked as intended.
  Target: no change.
  Effort: S. Risk: low: working as designed.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P13 (F13) — No change.** Requirements v1 was a pre-gate draft; the approved run applied
  Gate A answers in revision mode and the refused-at-start run writes no ledger row. Not a
  defect. Every approved version still gets an adversarial pass; the pre-gate draft is not a
  reviewable version.
  Target: no change.
  Effort: S. Risk: low: expected gate behaviour.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P14 (F14) — No change; the auto-route is correct, and P11 makes it rarer.** The harness
  declined the extra convergence round because MUST_FIX was flat, exactly the documented
  rule (Cap convergence check). Asking a human at every flat cap would add friction for a
  call the rule already pins. P11 reduces how often a phase reaches the flat-cap state.
  Target: no change (see P11).
  Effort: S. Risk: low: working as designed.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P15 (F15) — No change.** On the WSL crash the supervisor truncated to the last complete
  line and resumed the same run id — the correct call, no cost. P4 turns this hand recovery
  into a helper; no policy change to the resume decision.
  Target: no change (tooling covered by P4).
  Effort: S. Risk: low: correct behaviour.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P16 (F16) — Guard the shared `event.sh` / `EVENT_SCRIPT` path from workers.** Across
  three specs a spawned worker or peer step wrote the supervisor's shared `event.sh` or
  `.runid`, splitting one run across ids and fragmenting `--watch`. Make the rule explicit
  everywhere workers run: only the supervisor writes `event.sh`, `.runid` and the shared
  event script; any scratch store a task stages uses its own named path. See the graduation
  candidate below for the exact rule text.
  Target: project steering, templates or decomposition conventions; agent-rules.md.
  Effort: S. Risk: low: a standing rule plus the P3 wording; no code change.
  Prerequisites: P3.
  DECISION NEEDED: no.

## Graduation candidates

Patterns seen in two or more specs, proposed for promotion.

- **The shared run-ledger paths are supervisor-only (F16 here; harness-bookkeeping F6;
  question-gates F3 — 3 specs).** Rule text, for `agent-rules.md` under a new
  `## Run ledger` heading (and echoed in the decomposition conventions):

  > Only the supervisor creates or writes `/tmp/scratchpad/sdd/<spec>/event.sh`, its
  > `.runid` and the run's `harness-events.jsonl`. A spawned worker calls `EVENT_SCRIPT`
  > only to append rows; it never rewrites, re-initializes or repoints it. A task that
  > stages a scratch store with its own event script gives that script an explicit path
  > under the scratch store (`<scratch-store>/event.sh`) and must not reuse the
  > supervisor's `EVENT_SCRIPT` path.

  Target document: `.spec-workflow/agent-rules.md`.
