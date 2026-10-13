# Retrospective proposals — greeting-endpoint

One proposal per finding from `retrospective.md`. Format per that file's header.

## Proposals

- **P1 (F1) — Disambiguate `{ hour: null }` from a missing hour.** Today a missing
  second argument means "no hour" (`Hello, ...!`) while `{ hour: null }` is an invalid
  hour (`RangeError`); a reader can conflate them. The cheapest fix removes the
  conflation without touching behaviour: state both branches explicitly in the
  Requirement 4 hour contract and add one test per branch so the distinction is pinned.
  Target: project steering, templates or decomposition conventions (requirements.md +
  test).
  Effort: S. Risk: low: documentation and tests only, no code change.
  Prerequisites: none.
  DECISION NEEDED: yes. Should `{ hour: null }` keep throwing, or be normalised to
  "no hour"?
  - Option A (recommended): keep throwing; document both branches and add tests. Smallest
    change, preserves the "explicit invalid hour is an error" invariant.
  - Option B: normalise `null`/`undefined` hour to "no hour" (return `Hello`). Friendlier,
    but erases a signal that a caller passed a bad value on purpose.

- **P2 (F2) — Declare "no typecheck configured" so the gate stops recording a degraded
  state.** Every task gate logged `typecheck unavailable-other` because the harness
  expects a typecheck the project deliberately does not have (steering: "no
  dependencies", "scope stays tiny on purpose"). The cause is a missing declaration, not
  a missing tool. Add a `typecheck:` field to agent-rules.md (e.g. `typecheck: none`) and
  have the gate read it, so absence records as "not-configured" rather than
  "unavailable-other".
  Target: harness skills or agents; project steering (agent-rules.md).
  Effort: M. Risk: low: changes gate bookkeeping, not test execution.
  Prerequisites: gate reads the new field.
  DECISION NEEDED: yes. Add real static checking, or declare none?
  - Option A (recommended): declare `typecheck: none` / `lint: none` in agent-rules.md.
    Honours the zero-dependency steering and clears the gate noise.
  - Option B: add `tsc --checkJs` and/or ESLint. Real coverage, but pulls in dev
    dependencies the steering forbids for a throwaway fixture.
  - Option C: leave as-is. Gate keeps logging "unavailable-other" every task.

- **P3 (F3) — Precheck `gh` auth before the implementation phase pushes.** The phase
  pushed the branch, then found `gh` unauthenticated and could only leave a blocker note.
  Run `gh auth status` at phase start and surface a clear "authenticate gh to open the
  PR" message up front (or name it as a documented operator prerequisite) instead of
  discovering it after the push.
  Target: harness skills or agents; server docs.
  Effort: S. Risk: low: a read-only precheck and a doc line.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P4 (F4) — Extend the P5 citation lint to requirement/criterion prose cites.** The
  lint validates only `D<n>` design citations, so "Requirement 4 criterion 5" (criterion
  3 actually governs) passed and reached the approved tasks. Extend the P5 check to parse
  "Requirement N criterion M" references and confirm the requirement and criterion exist.
  Target: harness skills or agents; server code.
  Effort: M. Risk: medium: prose-citation parsing can mis-flag free text; scope the regex
  to the `_Prompt`/_Leverage lines that already carry structured cites.
  Prerequisites: a stable citation phrasing to match against.
  DECISION NEEDED: no.

- **P5 (F5) — Validate cited line ranges when building `codebase-context.md`.** The
  context file cited `test/greet.test.js:1-7` for a 6-line file; the overstated range
  carried into both drafting phases (the documents themselves were correct). When the
  context file is generated, clamp or warn on any `path:start-end` whose end exceeds the
  file's line count.
  Target: harness skills or agents (context generation).
  Effort: S. Risk: low: a bounds check at generation time.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P6 (F6) — No change needed; record the primitive/zero-argument calls as accepted.**
  `greet('Ada', 5)` and `greet()` match no criterion but are harmless — `(5).hour` is
  `undefined` so both return `Hello`, which the natural implementation already absorbs.
  Adding criteria for them would grow the contract for no behavioural gain. Leave the
  behaviour as-is and note in requirements.md that non-object and zero-argument second
  arguments are intentionally treated as "no hour".
  Target: project steering, templates or decomposition conventions (one requirements
  note).
  Effort: S. Risk: low: a clarifying note, no code change.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P7 (F7) — Decide the default when `gh` cannot open the PR.** The implementation phase
  shipped (pushed branch, left a blocker note) rather than halt, and the human was not
  asked. The default is reasonable but undocumented. Make the fallback explicit in the
  phase skill and in the HANDOFF so the operator sees the exact step owed to them.
  Target: harness skills or agents; server docs.
  Effort: S. Risk: low: documents and surfaces an existing default.
  Prerequisites: P3 (the precheck feeds the operator message).
  DECISION NEEDED: yes. What should the phase do when `gh` is unauthenticated?
  - Option A (recommended): keep shipping with a blocker note, but surface the exact
    manual `gh pr create` command and make the default explicit in the skill. Keeps the
    run unattended while owning the deferred step.
  - Option B: halt the phase and ask the operator before pushing. Nothing is left
    half-done, but a one-step auth gap stalls the whole run.
  - Option C: make it a configurable policy in agent-rules.md (`pr-on-auth-fail:
    ship | halt`). Flexible, but adds config surface for a rare case.

## Graduation candidates

None qualify yet. Graduation requires a pattern in two or more specs' findings, and this
is the first spec in the store with a retrospective (see F "Repeat patterns"). The
following are single-spec watch items to re-evaluate when a second retrospective exists:

- **Second-argument / options contract silence** (F1, F6 — both in this spec). If a later
  spec also leaves option-object edge cases (null, primitives, missing) unspecified,
  promote to a decomposition convention: *"When a function takes an options object,
  requirements must state the behaviour for a missing argument, a non-object argument, and
  a null option value."* Target: project steering (decomposition conventions).

- **Citation accuracy beyond `D<n>`** (F4). If a second spec produces a wrong
  requirement/criterion cite, promote: *"Lint validates every structured citation —
  design `D<n>` and `Requirement N criterion M` — against the cited document."* Target:
  agent-rules.md / harness lint spec.
