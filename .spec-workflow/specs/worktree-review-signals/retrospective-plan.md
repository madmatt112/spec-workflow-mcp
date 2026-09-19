# Retrospective plan — worktree-review-signals

Status: CLOSED

Approved 2026-09-18 by Matthew Field in the retrospective conversation (block mode). Source:
`retrospective-proposals.md`; findings in `retrospective.md`.

## Decisions made

- **P14 / G3 — Gate A asks outcomes only.** Matthew chose "outcomes only": gate A presents scope, user-visible outcomes and trade-offs with a product cost; implementation mechanics are decided by the agents and recorded silently.
- **P21 — Gate B keeps one-click approval.** Matthew chose "log it": approval stays a single click; the record notes when veto items went unannotated.
- **P9 — fix site** (mechanics, supervisor decision): writer-side, skip the redundant `interrupted` row. Not implemented this round (group rejected).
- **P11 — how the lint rule stops re-firing** (mechanics, supervisor decision): carry-forward of the prior version's dispositioned findings.

## Approved proposals

- **P4 (F4) — No change; fix already shipped.** The TOON encoder/decoder version mismatch
  was closed by task 1 (bump to 4.x, strip undefined keys); deferral d-a2233b94 resolved.
  Add a one-line note to the prepare-response test that pins the encoder and decoder to the
  same major so the round-trip stays covered.
  Target: product code (prepare-response test).
  Effort: S. Risk: low: a version-pin assertion.
  Prerequisites: none.
  DECISION NEEDED: no.
  Decision: implement the version-pin assertion.

- **P6 (F6) — Report git-infra failure as degraded, not `rejected`.** `isAncestorOfHead`
  maps an infra error to `rejected`, which would emit a false `head-degraded` note. Make
  the function distinguish an infra failure (throw or return `unknown`/`degraded`) from a
  genuine `rejected`, so the honesty edge closes. Resolve open deferral d-c99e352b.
  Target: product code (src/core, isAncestorOfHead).
  Effort: S. Risk: low: a small tri-state return the caller already branches on.
  Prerequisites: none.
  DECISION NEEDED: no.
  Decision: implement; resolve d-c99e352b.

- **P16 (F16) — Suppress ENOENT in `TaskStateStore.read`.** The design makes `read` warn
  once per file, which fires on the normal single-checkout `head-expected` path where no
  `task-state.json` exists. Treat ENOENT as the expected empty case (return empty, no warn);
  warn only on a real read/parse error.
  Target: product code (src/core/task-state-store.ts).
  Effort: S. Risk: low: narrows a warning to genuine faults.
  Prerequisites: none.
  DECISION NEEDED: no.
  Decision: implement.

- **P1 (F1) — Anchor lint-inserted citations to a file, not a bare line.** The v1 lint
  brief may insert a bare `:30` that a later pass re-resolves to the wrong file. Have the
  lint brief require every inserted citation to carry its filename (`typecheck.ts:30`), and
  have the reviewer reject bare `:<line>` tokens outside a code block.
  Target: harness skills or agents (sdd-document-phase briefs.md, lint brief).
  Effort: S. Risk: low: a stricter citation format the reviewer already checks.
  Prerequisites: none.
  DECISION NEEDED: no.
  Decision: implement.

- **P3 (F3) — Design briefs pin the runtime signature, not the test call.** Component 1
  pinned `constructor(specPath)` but the Testing Strategy needed a `timeoutMs`. Add a rule
  to the design brief: when a pinned interface has a Testing Strategy that needs an extra
  argument, pin it as an optional trailing param so the implementer does not have to invent
  a backward-compatible shim.
  Target: harness skills or agents (design brief in briefs.md).
  Effort: S. Risk: low: tightens what a brief already states.
  Prerequisites: none.
  DECISION NEEDED: no.
  Decision: implement.

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
  Decision: implement.

- **P12 (F12) — worktree-setup must list the e2e browser install.** The worktree Playwright
  suite needs `npx playwright install chromium`; agent-rules worktree-setup lists only
  `npm ci`. Add the browser install as a conditional setup step for tasks that run the
  worktree e2e suite. See graduation G2.
  Target: project steering (agent-rules.md worktree-setup).
  Effort: S. Risk: low: an added setup line.
  Prerequisites: none.
  DECISION NEEDED: no.
  Decision: implement (with G2).

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
  Decision: implement — decision: carry-forward (supervisor chose; mechanics).

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
  Decision: implement — decision: outcomes only (Matthew, 2026-09-18).

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
  Decision: implement — decision: log unannotated vetoes, keep one-click approve (Matthew, 2026-09-18).

- **G1 — Carry rejected lint findings forward.** Seen in worktree-review-signals F11,
  question-gates F4, spec-lint retro, harness-bookkeeping F11. Rule text: "A version's lint
  pass receives the prior version's dispositioned findings. A citation-identifier warning on
  a token that is unchanged since a version where it was rejected with a reason is
  suppressed, not re-fired." Target: harness/skills/sdd-document-phase/references/briefs.md
  (lint brief).
  Decision: graduate (with P11).

- **G2 — worktree-setup lists every install step, not just `npm ci`.** Seen in
  worktree-review-signals F12 (playwright chromium) and spec-lint F1 (`npm ci` missing at
  worktree entry). Rule text: "worktree-setup: `npm ci`; a task that runs a worktree
  Playwright e2e suite also runs `npx playwright install chromium` before it." Target:
  .spec-workflow/agent-rules.md (worktree-setup).
  Decision: graduate (with P12).

- **G3 — Human gates ask outcomes, not mechanics.** Seen in worktree-review-signals F14/F20
  and question-gates gate-A findings. Rule text: "A human gate presents only decisions the
  human is positioned to own — scope, outcomes, tradeoffs with a product cost. Implementation
  mechanics (recording sites, storage layout, constants, transport) are decided by the
  orchestrator and recorded, not put to the human." Target: harness Gate A/B procedure
  (sdd-continue SKILL.md) or a steering note.
  Decision: graduate (with P14).

## Rejected proposals

- **P9 (F9) — Phase-log regeneration must not append below an approved row.** — rejected: ledger/TUI group not approved this round; phase-log writer fix deferred (supervisor recommends writer-side when picked up).
- **P10 (F10) — Label a phase by the orchestrator's model, not the ledger's run.start.** — rejected: ledger/TUI group not approved this round; cosmetic.
- **G4 — Label a phase by the model that ran it.** — rejected: graduates with P10; deferred with it.

## No-change proposals (accepted as written, nothing to implement)

- **P2 (F2) — No change.**
- **P5 (F5) — No change; fix already shipped.**
- **P8 (F8) — No harness change; a rare mid-commit reboot.**
- **P13 (F13) — No harness change; matches known project memory.**
- **P15 (F15) — Covered by P2 and P3.**
- **P17 (F17) — No change; ratify the lint-skip.**
- **P18 (F18) — No change; correct recovery of F7.**
- **P19 (F19) — No change; normal deferral/ruling flow.**
- **P20 (F20) — Folded into P14.**

## Close-out

One line per proposal, written by the close-out phase.

- P4: done — ccc3ea8 (follow-up PR; installed @toon-format/toon major pinned to the declared range in the prepare-response test)
- P6: done — ccc3ea8 (follow-up PR; isAncestorOfHead tri-state, git faults reported as "could not be validated"; d-c99e352b narrowed to R2-3)
- P16: done — ccc3ea8 (follow-up PR; ENOENT is the silent empty case in TaskStateStore.read)
- P1: done — 04b1e89
- P3: done — ff3ab1e
- P7: done — a5da1be
- P12: done — e9c1f36
- P11: done — d3fd64c
- P14: done — 42358c4
- P21: done — 98e08fb
- G1: done — d3fd64c
- G2: done — e9c1f36
- G3: done — 42358c4
- spec-workflow-mcp: PR https://github.com/madmatt112/spec-workflow-mcp/pull/50
- briefs.md dedupe (close-out note): done — 383a777 (the duplicated `## Lint brief` section removed; plugin copies synced)
