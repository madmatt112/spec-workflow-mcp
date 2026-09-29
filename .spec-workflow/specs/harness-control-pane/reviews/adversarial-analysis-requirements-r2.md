# Adversarial Analysis — harness-control-pane/requirements (v2)

Round 2. Primary attack surface: completeness, ambiguity, scope. Fresh lens: every cited
artifact re-read at both ends of its range (the v1→v2 delta and the lint pass rewrote many
citations; confirm each cited range still says what the AC claims).

v2 accepted all five round-1 findings (R1-1…R1-5), then a lint pass (commit f15d391) trimmed
the body and rewrote several citations. Per the prompt, I attacked (a) whether the trim dropped
normative content, (b) whether any citation now points at the wrong range, and (c) whether the
R1 fixes are internally consistent.

## What I checked and how

- Read the v2 target in full, the round-1 analysis, and the rolling memory.
- Re-read every code/decomposition range the document cites, both ends:
  - `spec-decomposition/decomposition.md:665-667` (Intro / scope-note authority), `:711`,
    `:753-755` (the boundary note), `:759-761` (D14).
  - `src/core/index-generator.ts:44-82` and `:70-72` (AC 1.1 write path).
  - `harness/skills/sdd-continue/references/sdd-providers.sh:21-29`, `:28-29`, `:72-74`
    (AC 1.6/1.7, AC 2.4 merged-map format).
  - `harness/skills/sdd-document-phase/SKILL.md:24-34` (AC 2.4 deepseek launcher).
  - `harness/skills/sdd-continue/SKILL.md:85-96` (AC 2.6 preflight), `:226-228` (AC 2.3
    no-model spawn), `:336-345` (AC 2.8 worktree), `:488-500` (AC 3.13 deregister).
  - `docs/SDD-HARNESS.md:244-248` (AC 3.1 headless command).
  - `src/dashboard/adversarial-runner.ts:156-220` (AC 3.2 child-process pattern).
  - `src/watch/index.ts:101-104` (AC 4.1 chokidar), `src/watch/ledger.ts:243-457`
    (AC 4.2 model builder).
  - `src/dashboard/multi-server.ts:205-294` (AC 4.8 socket), `:1965-1989` (AC 4.4 tdd route),
    `:2125-2151` (AC 4.9 broadcastToProject / broadcastToAll).
- Diffed the pre-lint v2 (940cdb3) AC text against the post-lint v2 (f33d416) for dropped
  normative content, per the lint-commit diff supplied in the prompt.

Result: every code citation is accurate at both ends. One decomposition citation is now a
wrong range (R2-1). Two R1-2-added wire-contract ACs are internally inconsistent or were
weakened by the lint (R2-2, R2-3). The R1-1, R1-3, R1-4, R1-5 substance survives.

## Findings

### R2-1 — Scope-note citation `decomposition.md:753-754` is the wrong range for the boundary note it quotes — MUST_FIX (fix-induced; Compounds: R1-1)

The scope note (requirements.md:153) reads: 'The boundary note "it adds no ledger field"
(spec-decomposition/decomposition.md:753-754) scopes per-spawn usage to spec 8, not this…'

At the cited lines:
- `decomposition.md:753` — "**The execution-context disclosure object is in 2.** Spec 1 emits
  no new reviewer-facing channel." This is an *unrelated* boundary note (spec 2 / spec 1), not
  the spec-9 note.
- `decomposition.md:754` — "**Per-spawn usage is in 8, its display is in 8 and 9.** Spec 9
  renders `RunModel`; it adds no"
- `decomposition.md:755` — "ledger field. Spec 10 writes the same fields…"

The quoted phrase "it adds no ledger field" spans **754-755** ("it adds no" on 754, "ledger
field" on 755). The cited range `753-754` therefore (1) pulls in line 753, a different note,
and (2) stops one line short of the words it quotes. The correct citation is `754-755`.

This is fix-induced by the lint pass, which changed the citation from `:754` (pre-lint, 940cdb3)
to `:753-754` (post-lint, f33d416): the change moved the range *away* from the quoted phrase and
onto an unrelated note. It compounds R1-1 because this exact boundary note is the load-bearing
authority for the R1-1 reconciliation — the whole "spec 9 may add `overrides`/`setup` to
`run.start` because the ‘adds no ledger field’ note is scoped to per-spawn usage" argument rests
on quoting this note correctly. A reader who follows `753-754` lands on the execution-context
note and never sees "ledger field."

Per the standing directive, a wrong line range is an automatic MUST_FIX. Fix: cite `754-755`.

### R2-2 — The lint trim gutted the AC 4.9 / AC 5.10 message-type demux contract that R1-2 was accepted to establish — SHOULD_FIX (fix-induced; Compounds: R1-2)

R1-2 was accepted specifically to name "the message types for run-model / log / todos / overview
payloads … so the page can demultiplex them from the existing `initial` / `projects-update`
messages." The lint pass then removed that concrete constraint from both push ACs:

- **AC 4.9.** Pre-lint (940cdb3): "each message SHALL carry a `type` the page demultiplexes,
  **distinct from `initial` and `projects-update`**: one for the run model (AC 4.2), one for a
  batch of new log lines (Requirement 3 AC 5), and one for the gate sections (AC 4.5)." Post-lint
  (f33d416): "each message SHALL carry a type field the page demultiplexes, **distinct from the
  AC 4.8 messages**: one for the run model, one for a batch of new log lines, one for the gate
  sections." The concrete "distinct from `initial` and `projects-update`" became "distinct from
  the AC 4.8 messages," which is ambiguous and points at the wrong thing: AC 4.8's *own* new
  message is the client→server harness **subscribe**, whereas these three are server→client
  **pushes** — a push is trivially "distinct from" a subscribe by direction. The actual existing
  server pushes the new types must not collide with are `initial` and `projects-update`
  (multi-server.ts:231, 246, 279), and that requirement is now unstated. The per-payload source
  ACs (4.2, Req 3 AC 5, 4.5) were also dropped.
- **AC 5.10.** Pre-lint: "each with a distinct `type` the page demultiplexes **(overview rows,
  todos list), distinct from `initial` and `projects-update`**." Post-lint: "each with a
  distinct type field." AC 5.10 lost the enumeration of the two push types *and* the entire
  distinctness-from-existing-types constraint; it now says only "each with a distinct type
  field" — distinct from what is no longer stated.

Failure scenario: the design/implementer picks a push `type` that collides with `projects-update`
(or reuses `initial`), and the existing Specs-page handler or the new Harness page mis-routes the
payload — the precise ambiguity R1-2 closed and the lint reopened. Fix: restore "distinct from
`initial` and `projects-update`" (or name the existing message set explicitly) in AC 4.9 and
AC 5.10, and re-enumerate the AC 5.10 types (overview rows, todos list).

### R2-3 — AC 4.9 pushes "only harness subscribers via the existing broadcastToProject," but that helper filters on projectId alone — SHOULD_FIX (fix-induced; Compounds: R1-2)

AC 4.9: "the run-model and gate pushes SHALL reach **only that project's harness subscribers**
via the **existing** `broadcastToProject` (src/dashboard/multi-server.ts:2139-2151)."

`broadcastToProject` (multi-server.ts:2139-2151) sends to every connection where
`connection.socket.readyState === WebSocket.OPEN && connection.projectId === projectId`
(line 2143). It filters on `projectId` only — it cannot restrict to *harness* subscribers, so it
also delivers every run-model and gate push to a Specs-page connection bound to the same
`projectId`. This contradicts AC 4.9's own word "only," and it contradicts the premise the same
delta established: AC 4.8 says the server must "tell the two apart on one `projectId`," and AC 4.7
keys the watcher lifecycle on the *harness-subscriber count* — state the push path here ignores.
So the delta added subscriber-type tracking for the watcher lifecycle but wired the push through a
helper that does not use it.

Failure scenario: the implementer takes AC 4.9 literally, reuses the existing `broadcastToProject`
unchanged, and every open Specs tab on that project receives every harness run-model and gate push
(needless traffic, and a client error if the Specs handler is not defensive about unknown types);
or, trying to honour "only harness subscribers," the implementer builds a new harness-filtered
broadcast — work AC 4.9 says is not needed ("existing"). Fix: either add a
harness-subscriber-filtered broadcast keyed on the AC 4.8 subscription state, or drop "only … harness
subscribers" and state that non-harness connections receive and ignore the typed push.

### Minor (do not keep the loop alive)

- **AC 1.1 lost the R1-5 clarification.** The pre-lint v2 AC 1.1 stated the ordering logic is
  private ("`deriveSpecStatus`, the class's `categorize`, and the exported `deriveRouting`") and
  that "Exposing a pure order/status function, or reimplementing the private ordering, is part of
  this work." The lint trimmed both. Confirmed against index-generator.ts: `categorize` (:133)
  and the `render` ordering (:159) are private, reachable only via `generate()` (:44-82) which
  writes INDEX.md (:70-72); only `deriveRouting` (:67) and `deriveSpecStatus` (:53) are importable.
  The surviving text ("reuse … through a read-only function, and SHALL NOT call the generator's
  INDEX.md write path") still expresses the requirement, so this is MINOR — but it re-hides that a
  new read-only function is real work, which is why R1-5 was accepted.
- **Introduction dropped the explicit key names.** Pre-lint named the two keys "(`overrides` and
  `setup`)"; post-lint says only "two provenance keys." AC 2.9 still names both, so no content is
  lost overall. MINOR.
- **AC 2.4 vs AC 2.6 trigger wording for a model-only deepseek override.** AC 2.4's WHEN is "the
  file sets a **model** for a worker role"; AC 2.6's WHEN is "the file sets a **provider** for a
  role." A deepseek worker's overridden model travels only in the merged map AC 2.6 builds. This
  is consistent *if* "sets a provider" means "the file records a provider entry" (AC 1.11 writes
  provider per non-omitted role, so a deepseek role in the file always carries provider=deepseek).
  Under that reading it is covered; the wording is loose but not broken. MINOR.

## Closing deliverables

### Top 3 risks / gaps

1. The scope-note citation `753-754` points at an unrelated boundary note and stops short of the
   quoted phrase (correct: `754-755`) — and this note is the authority the R1-1 ledger-scope
   reconciliation rests on (R2-1).
2. The lint trim reopened the R1-2 demux ambiguity: AC 4.9 and AC 5.10 no longer state the push
   types must be distinct from `initial`/`projects-update`, and AC 5.10 no longer enumerates its
   two types (R2-2).
3. AC 4.9 delivers "only harness subscribers" through a helper (`broadcastToProject`) that filters
   on `projectId` alone, contradicting AC 4.8/4.7's subscriber-type distinction (R2-3).

### Top 3 conclusions to challenge or reverse

1. **"Lint pass. 13 fixed; rejected: none" (Revision History).** Challenge: the lint pass was not
   content-neutral — it introduced a wrong citation range (R2-1) and weakened two accepted
   wire-contract ACs (R2-2). A lint pass must not move a citation off the text it quotes.
2. **AC 4.9 "reach only that project's harness subscribers via the existing `broadcastToProject`."**
   Reverse or qualify: the existing helper cannot restrict to harness subscribers; pick a new
   filtered broadcast or drop "only" (R2-3).
3. **The R1-1 reconciliation is sound in substance but not in citation.** The argument (spec-9
   `run.start` provenance keys are authorized by decomposition:665-667/711, and the "adds no ledger
   field" note is scoped to per-spawn usage) holds — but only if it cites the note correctly. As
   written it quotes a range that contains a different note (R2-1).

### What's missing — do before acting on this document

- Correct the `753-754` citation to `754-755` (R2-1).
- Restore the "distinct from `initial` and `projects-update`" demux constraint and the AC 5.10
  type enumeration (R2-2).
- Decide and state the harness-only push mechanism, or accept ignored fan-out to same-project
  Specs connections (R2-3).

ESCALATE: none. (D10's reuse of the existing binding/rate-limit/audit hooks for a
permission-skipping headless `claude` was reviewed and accepted in round 1; no new security
surface in the v2 delta.)

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 2
MINOR: 3
DESIGN_READY: no
ESCALATE: none
```
