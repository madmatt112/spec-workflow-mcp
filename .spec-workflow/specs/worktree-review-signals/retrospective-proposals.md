# Retrospective proposals — worktree-review-signals

One proposal per finding. Format per `retrospective.md` header.

## Gotchas

- **P1 (F1) — Anchor lint-inserted citations to a file, not a bare line.** The v1 lint
  brief may insert a bare `:30` that a later pass re-resolves to the wrong file. Have the
  lint brief require every inserted citation to carry its filename (`typecheck.ts:30`), and
  have the reviewer reject bare `:<line>` tokens outside a code block.
  Target: harness skills or agents (sdd-document-phase briefs.md, lint brief).
  Effort: S. Risk: low: a stricter citation format the reviewer already checks.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P2 (F2) — No change.** The brief guessed a non-repo `git diff HEAD` exits 128; it
  exits 1. The implementer caught it and wrote tests to the observed cause at zero extra
  cost. Self-correction worked as intended; a per-fact pre-check would cost more than it
  saves. See P16 for the shared doc-gap theme.
  Target: none.
  Effort: S. Risk: low: leaves a working self-correction path in place.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P3 (F3) — Design briefs pin the runtime signature, not the test call.** Component 1
  pinned `constructor(specPath)` but the Testing Strategy needed a `timeoutMs`. Add a rule
  to the design brief: when a pinned interface has a Testing Strategy that needs an extra
  argument, pin it as an optional trailing param so the implementer does not have to invent
  a backward-compatible shim.
  Target: harness skills or agents (design brief in briefs.md).
  Effort: S. Risk: low: tightens what a brief already states.
  Prerequisites: none.
  DECISION NEEDED: no.

## Product bugs found

- **P4 (F4) — No change; fix already shipped.** The TOON encoder/decoder version mismatch
  was closed by task 1 (bump to 4.x, strip undefined keys); deferral d-a2233b94 resolved.
  Add a one-line note to the prepare-response test that pins the encoder and decoder to the
  same major so the round-trip stays covered.
  Target: product code (prepare-response test).
  Effort: S. Risk: low: a version-pin assertion.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P5 (F5) — No change; fix already shipped.** The status-route `runGit` gained a 10 s
  timeout in design round 2. This is the review gate working. Keep the standing rule that
  every server-side git spawn carries a timeout and a degraded path; it caught this one.
  Target: none (confirm the rule holds).
  Effort: S. Risk: low.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P6 (F6) — Report git-infra failure as degraded, not `rejected`.** `isAncestorOfHead`
  maps an infra error to `rejected`, which would emit a false `head-degraded` note. Make
  the function distinguish an infra failure (throw or return `unknown`/`degraded`) from a
  genuine `rejected`, so the honesty edge closes. Resolve open deferral d-c99e352b.
  Target: product code (src/core, isAncestorOfHead).
  Effort: S. Risk: low: a small tri-state return the caller already branches on.
  Prerequisites: none.
  DECISION NEEDED: no.

## Harness defects

- **P7 (F7) — Extend the gate-A resume recheck to interrupt-before-emit.** The recheck
  (sdd-continue SKILL.md step 3 rule 4) fires only when a `## Gate A` receipt exists and is
  unanswered; an interrupt after the v1 checkpoint but before the emit leaves no receipt, so
  "absent receipt ⇒ dispatch normally" skips v1 lint and gate A. Add: if a requirements v1
  draft or v1 checkpoint exists but no gate-A receipt and gate A is unresolved, run the Gate
  A procedure instead of a normal revision re-dispatch.
  Target: harness skills or agents (sdd-continue SKILL.md rule 4).
  Effort: M. Risk: medium: the recheck now keys on a v1-draft signal; a wrong signal could
  re-run gate A on a legitimately fresh phase.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P8 (F8) — No harness change; a rare mid-commit reboot.** The supervisor already
  reconstructed the approved state from the surviving approval record and HANDOFF, which is
  the intended recovery. Hardening git against a mid-commit power loss is out of scope for
  the harness.
  Target: none.
  Effort: S. Risk: low.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P9 (F9) — Phase-log regeneration must not append below an approved row.** A regenerated
  `interrupted` row landed below the approved row and the watch TUI (last row per stage) hid
  the approval. Make phase-log regeneration skip emitting an `interrupted` row for a stage
  that already has an `approved`/terminal row, or have the TUI prefer a terminal state over
  a later `interrupted` for the same stage+version.
  Target: harness skills or agents (phase-log writer / watch TUI).
  Effort: M. Risk: medium: TUI last-row logic is shared; a change touches every stage.
  Prerequisites: none.
  DECISION NEEDED: yes. Fix at the writer or at the reader?
  - Writer: skip the redundant `interrupted` row. (recommended — smallest, keeps log honest)
  - Reader: TUI prefers terminal over later `interrupted`. Broader blast radius.

- **P10 (F10) — Label a phase by the orchestrator's model, not the ledger's run.start.**
  The TUI labelled the design orchestrator fable-5-1 xhigh because the label reads the
  supervisor's `run.start` model. Have the phase row carry the spawned orchestrator's own
  model (from its agent ledger `agent.start`) and have the TUI read that field.
  Target: harness skills or agents (ledger schema + watch TUI). See graduation G4.
  Effort: M. Risk: low: cosmetic field, but touches the ledger contract.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P11 (F11) — Carry rejected citation-identifier findings forward across versions.** The
  rule re-fires the same identifier-is-new-behaviour warnings each version (33 of 38 on v3).
  Give a version's lint pass the prior version's rejected/dispositioned findings and suppress
  a re-fire on an unchanged token already dispositioned with a reason. See graduation G1.
  Target: harness skills or agents (sdd-document-phase lint brief in briefs.md).
  Effort: M. Risk: medium: a carried-forward suppression could mask a genuinely new use.
  Prerequisites: none.
  DECISION NEEDED: yes. How should the rule stop re-firing?
  - Carry-forward: pass prior rejected findings; suppress unchanged re-fires. (recommended —
    no per-doc annotation burden, keeps the rule's coverage)
  - Mark-new marker: author tags an identifier as newly named; rule skips tagged tokens.
  - Suppress the identifier check entirely for defined terms. Loses real signal.

- **P12 (F12) — worktree-setup must list the e2e browser install.** The worktree Playwright
  suite needs `npx playwright install chromium`; agent-rules worktree-setup lists only
  `npm ci`. Add the browser install as a conditional setup step for tasks that run the
  worktree e2e suite. See graduation G2.
  Target: project steering (agent-rules.md worktree-setup).
  Effort: S. Risk: low: an added setup line.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P13 (F13) — No harness change; matches known project memory.** The opus-4-8 overlay was
  written into the plugin cache but agents load from `plugins/spec-workflow-harness`; this is
  exactly project memory `tier-overlay-in-plugin-cache`. The run recovered with an overlay at
  the effective path plus a restart. The standing memory rule already covers it.
  Target: CLAUDE.md, memory or settings (already recorded).
  Effort: S. Risk: low.
  Prerequisites: none.
  DECISION NEEDED: no.

## Inefficiencies

- **P14 (F14) — Reframe Gate A around outcomes, or drop it.** Gate A asked five decisions as
  implementation mechanics (recording sites, storage layout, pinned constants, diff
  transport); the human answered "you choose" to every one, so the gate produced no signal.
  See graduation G3 and P20.
  Target: harness skills or agents (gate-A surface builder / sdd-continue Gate A procedure).
  Effort: M. Risk: medium: changing gate content changes what the human is asked to own.
  Prerequisites: none.
  DECISION NEEDED: yes. What should Gate A ask?
  - Reframe to outcomes/scope only; drop any mechanics decision, and record mechanics
    silently. (recommended — matches project memory grill-questions-are-about-outcomes)
  - Keep the gate but let the orchestrator pre-answer mechanics and ask only genuine forks.
  - Drop Gate A when every surfaced decision is mechanics. Loses the audit receipt.

## Documentation gaps

- **P15 (F15) — Covered by P2 and P3.** Both briefs stated a fact the implementer corrected
  at the tree (non-repo exit code; pinned constructor). Both self-corrected at zero extra
  spawn. The targeted brief tweaks in P1/P3 remove the recurring cause; no separate change.
  Target: none (see P2, P3).
  Effort: S. Risk: low.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P16 (F16) — Suppress ENOENT in `TaskStateStore.read`.** The design makes `read` warn
  once per file, which fires on the normal single-checkout `head-expected` path where no
  `task-state.json` exists. Treat ENOENT as the expected empty case (return empty, no warn);
  warn only on a real read/parse error.
  Target: product code (src/core/task-state-store.ts).
  Effort: S. Risk: low: narrows a warning to genuine faults.
  Prerequisites: none.
  DECISION NEEDED: no.

## Process deviations and rulings

- **P17 (F17) — No change; ratify the lint-skip.** Skipping the v3 reviser spawn (38
  warnings, 33 already-rejected re-fires, 5 carried to the round-2 reviewer as LINT.open)
  saved ~100k tokens and bought nothing lost. P11 removes the re-fires that made this call
  necessary; keep the orchestrator's discretion to skip a reviser when all findings are
  re-fires or already carried.
  Target: none (P11 addresses the cause).
  Effort: S. Risk: low.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P18 (F18) — No change; correct recovery of F7.** Running Gate A by hand from the fresh
  gate-a.json when no receipt existed was the right deviation and was logged. P7 makes this
  path automatic, retiring the manual step.
  Target: none (see P7).
  Effort: S. Risk: low.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P19 (F19) — No change; normal deferral/ruling flow.** Two design MINORs deferred
  (d-c99e352b, closed by P6) and two rulings closed as refinements. This is the review gate
  disposing of edges as designed.
  Target: none.
  Effort: S. Risk: low.
  Prerequisites: none.
  DECISION NEEDED: no.

## Decisions the harness made for the human

- **P20 (F20) — Folded into P14.** The supervisor kept all five delegated Gate A choices
  because they were mechanics the human declined to own. Reframing Gate A (P14) removes the
  case; if mechanics stay in the gate, the supervisor keeping delegated choices is the
  correct fallback and needs no separate change.
  Target: none (see P14).
  Effort: S. Risk: low.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P21 (F21) — Surface Gate B veto items for explicit acknowledgement.** The human approved
  the 12-task plan with 7 class-a veto items and no annotation; the plan was accepted without
  engagement on the vetoes. Have Gate B require a one-line ack (or an explicit "no veto") per
  class-a item before it records approval, so a silent approval cannot pass unread vetoes.
  Target: harness skills or agents (Gate B procedure in sdd-continue).
  Effort: M. Risk: medium: adds friction to an approval the human may want to fast-path.
  Prerequisites: none.
  DECISION NEEDED: yes. How much engagement does Gate B require?
  - Require a per-veto ack or explicit "no objection" before approval. (recommended — makes
    the veto items load-bearing without blocking)
  - Keep a single approval but log that veto items went unannotated.
  - Leave as is; silent approval means accept-all.

## Graduation candidates

- **G1 — Carry rejected lint findings forward.** Seen in worktree-review-signals F11,
  question-gates F4, spec-lint retro, harness-bookkeeping F11. Rule text: "A version's lint
  pass receives the prior version's dispositioned findings. A citation-identifier warning on
  a token that is unchanged since a version where it was rejected with a reason is
  suppressed, not re-fired." Target: harness/skills/sdd-document-phase/references/briefs.md
  (lint brief).

- **G2 — worktree-setup lists every install step, not just `npm ci`.** Seen in
  worktree-review-signals F12 (playwright chromium) and spec-lint F1 (`npm ci` missing at
  worktree entry). Rule text: "worktree-setup: `npm ci`; a task that runs a worktree
  Playwright e2e suite also runs `npx playwright install chromium` before it." Target:
  .spec-workflow/agent-rules.md (worktree-setup).

- **G3 — Human gates ask outcomes, not mechanics.** Seen in worktree-review-signals F14/F20
  and question-gates gate-A findings. Rule text: "A human gate presents only decisions the
  human is positioned to own — scope, outcomes, tradeoffs with a product cost. Implementation
  mechanics (recording sites, storage layout, constants, transport) are decided by the
  orchestrator and recorded, not put to the human." Target: harness Gate A/B procedure
  (sdd-continue SKILL.md) or a steering note.

- **G4 — Label a phase by the model that ran it.** Seen in worktree-review-signals F10 and
  the question-gates repeat note (F3 ↔ harness-bookkeeping F6, spec-lint F3: a run's ledger
  id/model overwritten mid-run). Rule text: "The watch TUI labels a phase from the spawned
  orchestrator's own `agent.start` model, never the supervisor's `run.start` model." Target:
  harness ledger schema and watch TUI.
