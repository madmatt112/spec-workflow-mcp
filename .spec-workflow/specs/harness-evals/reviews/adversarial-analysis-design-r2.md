# Adversarial Analysis — harness-evals/design (v1, round 2)

Round 2. The working tree carries the reviser's answers to round 1 (R1-1…R1-5); the
`## Changes since b34e3f47` diff is those answers. This pass is a fix-induced re-check of each
round-1 finding scoped to its fix, then a fresh feasibility/consistency/edge-case lens on the new
text. Every new code claim the diff introduces was probed at the installed version under the
worktree.

## What I checked (deltas only; round 1 verified the rest)

- **`DeferralStorage.create`/`update`** (`src/core/deferral-storage.ts:229-270`, `:321-342`):
  `create` returns the minted id (`Promise<string>`, `return id` at :269); `update(id, { context })`
  sets `deferral.body.context` (`:335`). Both real callers (`implementation.ts:412`, `:1120`) pass
  `owner`, `originSpec`, `originPhase`, `revisitTrigger`, `tags`, `supersedes`, `body`.
- **`Deferral` type** (`src/types.ts:312-333`): `revisitTrigger`, `tags`, `supersedes: string|null`,
  `body.{context,decision,revisitCriteria}` all non-optional; `owner?` optional.
- **`git archive <tree-ish> <subpath> | tar -x`**: ran it in the worktree against `harness/agents`;
  git **2.43.0** writes entries under the full repo-relative prefix, so `git archive target
  harness/evals/<id> | tar -x -C tmp` lands the case at `tmp/harness/evals/<id>`. The design's
  reason-5 `caseDir` claim holds.
- **`StepSpec`** (`src/controller/step.ts:92-134`) and `runStep` (`:343-387`): every option
  Component 6 passes is a real field — `worktree`, `sessionId`, `schema`, `noSessionPersistence`,
  `workspace`, `sharedRoot`, `mcpConfig`, `runId`, `stepId`; `{ ...process.env }` spread at :381
  confirms the "delete inherited SDD_RUN_ID/SDD_STEP_ID" note.
- **`drafter` template** (`src/tools/brief-templates.ts:1616-1620`): required keys are exactly
  `phase, docPath, specDir, specStoreRoot, codeRoot, carried`; `closeout-standing` requires
  `commitScript` (`:1585`); `closeout-batch` requires `standing` (`:1588`). `SERVER_BRIEF_KEYS`
  (`src/tools/harness.ts:585`) is `agentRules, taskBlock, spec`. The new case-author contract
  (design line 159) is accurate.

No misstated artifact in the diff.

## Fix-induced re-checks (round-1 findings)

- **R1-1 (was MUST_FIX) — resolved.** The deferral is now a two-write create-then-`update`: the
  body is written empty, then `update(id, { context })` embeds the now-known id. `revisitTrigger`
  and `body.{decision,revisitCriteria}` are supplied. The own-id-in-body impossibility is gone.
  One residue remains — see R2-1.
- **R1-2 (was SHOULD_FIX) — resolved.** Reason 5 now materialises target's case dir via
  `git archive target harness/evals/<id> | tar -x` and builds the fixture with `caseDir` at the
  temp copy, then removes it. Verified the archive layout above. The "without a checkout"
  contradiction is closed: ids/definitions still come from git objects, but the fixture build gets
  real files.
- **R1-3 (was MINOR) — resolved.** The case-author contract (line 159) states the drafter's six
  hand-wired keys, that only `{{fixture}}`/`{{scratch}}` substitute, that a grader's path arg
  equals the value it reads (`docPath` ↔ `tasks-labels-canonical` `doc`), and that
  `closeout-standing`'s `commitScript` is `{{scratch}}/closeout-commit.sh`.
- **R1-4 (was MINOR) — resolved.** `Fixture = { root, parent, bases }` is now pinned in Data
  Models; `parent` is the `mkdtemp` dir `disposeFixture` removes, consistent with Component 2 PC1/PC5
  and Component 5's `FixtureView` (same minus `parent`, plus `git`).
- **R1-5 (was MINOR) — resolved.** Error Handling 6 pins the no-summary fallback text
  (`eval gate failed before it could report`); EH9 pins `<target 12>: deferral write failed, <id>`.
  Residual wording issue — see R2-2.

## Fresh lens — feasibility / consistency / edge cases

### R2-1 (Compounding on R1-1, MINOR) — `create` recipe still omits the required `supersedes`
Component 8 PC5 lists the `create` input as `owner, title, tags, null origin fields,
revisitTrigger, body`. `create`'s parameter is `Omit<Deferral, 'id'|'status'|'createdAt'|
'updatedAt'|'resolvedAt'|'resolution'|'resolvedInSpec'|'supersededBy'>`, which leaves
`supersedes: string|null` **required**. Both existing callers pass `supersedes: null`
(`implementation.ts:412`, `:1120`). A verbatim transcription of the recipe does not compile.
Impact is small — TypeScript flags it immediately and the fix is the same `supersedes: null` every
caller already writes — so this does not reach SHOULD_FIX, but the "field-by-field recipe an
implementer can transcribe" that R1-1 asked for is one field short.

### R2-2 (Novel, MINOR) — EH9 `<id>` is ambiguous and unavailable on a `create` failure
EH9 / PC5 say a `create` **or** `update` failure gives exit 1 with `summaryFile` =
`<target 12>: deferral write failed, <id>`. On a `create` failure no id is returned to the caller,
so `<id>` cannot be the deferral id there; elsewhere in PC5 `<id>` is both the case id ("overrode
eval case `<id>`") and the deferral id ("deferral `<id>`"). The operator cannot tell which. A
related edge: an `update` failure leaves an orphaned deferral (`body.context = ''`, no override-log
line); a retry mints a second one (no dedup on `['eval-override']` tag). Pin `<id>` as the **case**
id and note the orphan, or capture the id only after a successful `update`.

### R2-3 (Novel, MINOR) — grader `repo`→`bases` key convention is unpinned
Graders receive `FixtureView.bases` and take a `repo` arg (`.` or `.claude/worktrees/landing`), then
compare "HEAD equals its base" (`no-new-commit`, `item-commit-on-branch`, etc.). The Fixture model
says `bases` "maps the root and each worktree dir" to HEAD, but never states the key string — is the
root `"."`, `f.root`, or `"root"`; is a worktree `"landing"` or `".claude/worktrees/landing"`? The
grader cannot look up its base deterministically until the convention is fixed. Tests will pin it,
but the design leaves the one coupling between the `repo` arg and the `bases` key unstated.

## Top risks / gaps

1. (MINOR) `create` recipe omits the required `supersedes` field — R2-1.
2. (MINOR) EH9 `<id>` ambiguous / unavailable on `create` failure; `update`-failure orphan — R2-2.
3. (MINOR) grader `repo`→`bases` key convention unstated — R2-3.

## Top conclusions to challenge

1. "field-by-field recipe an implementer can transcribe" (R1-1's goal) — still one required field
   short; add `supersedes: null`.
2. "A create or update failure … `deferral write failed, <id>`" — `<id>` must be the case id on the
   `create` branch, and the `update`-branch orphan deserves a line.
3. Everything else in the diff is sound; the git-archive materialisation and the two-write deferral
   are the right calls and are correctly grounded.

## What's missing before acting

- Nothing that blocks tasks. The three MINORs are one-line tightenings a reviser can fold in or a
  tasks author can settle against the cited code; none changes a component boundary or a contract.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 3
DESIGN_READY: yes
ESCALATE: none
```
