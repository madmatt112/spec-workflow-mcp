# Retrospective plan — dashboard-project-list

Status: APPROVED
Date: 2026-10-29

## Approved proposals

- **P1 (F1) — A new exported symbol drags in the export-classification guard test.** When a task adds or renames an exported function, the export-classification guard test (`src/core/__tests__/git-utils.test.ts`) must be edited; list it in that task's `File:` list. Extend the agent-rules "cited design clause names a module → File: must include it" convention to cover the guard test for any task that adds an export.
  Target: project steering (agent-rules.md Documents section).
  Effort: S. Risk: low: it only widens an existing File:-list check.
  Prerequisites: none.
  Eval case: new case — a tasks doc that adds an export without listing the export guard test is rejected by the tasks-phase review; grader checks the rejection fires.
  DECISION NEEDED: no.

- **P2 (F2) — `SPEC_WORKFLOW_SHARED_ROOT` leaks into verification.** The verifier and e2e gate must run every check with `env -u SPEC_WORKFLOW_SHARED_ROOT` so a session-exported var cannot re-scope results to the shared root. State this once in the verifier role prompt (and in verify-standing, see P8) rather than re-deriving it per run. Seen here and in advisor → graduation candidate.
  Target: harness agents (sdd-verifier.md).
  Effort: S. Risk: low: unsetting an unused var is inert; scoping is only ever correct when it points at CODE_ROOT.
  Prerequisites: none.
  Eval case: new case — verifier brief run with `SPEC_WORKFLOW_SHARED_ROOT` exported still scopes checks to CODE_ROOT; grader checks the var is absent from the check environment.
  DECISION NEEDED: no.

- **P3 (F3) — `npm test` wipes `/tmp/scratchpad/sdd`, destroying the live briefs.** The full suite's cleanup deletes the scratch root holding the run's briefs. Fix the suite so its temp fixtures use a dedicated dir (e.g. `os.tmpdir()/swm-test-*`) and never touch `/tmp/scratchpad/sdd`, so the verifier needs no backup step.
  Target: server code (test setup/teardown).
  Effort: M. Risk: medium: must find every test that writes under that path and repoint it without weakening isolation.
  Prerequisites: none.
  Eval case: new case — run the full suite with sentinel files under `/tmp/scratchpad/sdd`; grader checks they survive.
  DECISION NEEDED: yes. Where should the fix live?
  - Option A (recommended): repoint the test suite's temp root off `/tmp/scratchpad/sdd` so the hazard is gone for every run.
  - Option B: keep the backup step but move it into the verifier role prompt as a standing pre-suite action.
  - Option C: no change — accept the per-round backup as cheap.

- **P4 (F4) — `addProjectByPath` store-root change no longer re-points watchers.** Known product bug, deferred as d-960bb37e and accepted by the design C3 scope note; the parser/watcher/approvalStorage keep reading the old store on a same-workspace re-add with a new `workflowRootPath`. No harness/process change; the owner decides the product fix at the next project-manager-lifecycle touch.
  Target: product code (`src/core` project manager).
  Effort: M (when taken). Risk: medium: re-point touches watcher lifecycle.
  Prerequisites: a spec/task that reopens project-manager context lifecycle.
  Eval case: none — product behaviour, not harness; the deferral's revisit trigger covers it.
  DECISION NEEDED: yes. Fix the re-point or keep the C3 scope note?
  - Option A (recommended): leave deferred under C3 until the lifecycle is next touched; the stale-store case is rare and out of this spec's scope.
  - Option B: schedule a product fix now that recreates the context when `workflowRootPath` changes, as the base code did.

- **P5 (F5) — The `deferrals` tool cannot see a worktree-created, uncommitted deferral.** The tool reads only the merged store, so a deferral created in a worktree is invisible until its spec-store commit lands — it was nearly dropped from this retro. Smallest process fix: the implementation orchestrator commits any new worktree deferral to the spec store at the merge gate (same relocation already required for verification artifacts), so the retro compiler sees it.
  Target: harness agents (sdd-implementer.md / implementation orchestrator brief).
  Effort: S. Risk: low: it only commits an already-written file.
  Prerequisites: none.
  Eval case: new case — a deferral created in a worktree appears in `deferrals list` for its originSpec after the merge-gate relocation; grader checks total ≥ 1.
  DECISION NEEDED: no.

- **P6 (F6) — Completion ledger reported "0 deferrals added" with 1 added.** No change. This is the documented floor-not-total behaviour (agent-rules Run ledger); the count read zero because the deferral was worktree-created and uncommitted — P5 removes that blind spot at the source. The floor caveat is already graduated across five specs.
  Target: none.
  Effort: S. Risk: low.
  Prerequisites: P5.
  Eval case: none — no rule change proposed.
  DECISION NEEDED: no.

- **P7 (F7) — Three redundant re-spawns re-did already-committed work.** Before launching a retry/repair implementer, the orchestrator confirms the work is not already present (check the task's commit/diff); and consecutive clean reviews with no fix round between them (task 7 v1/v2) should not re-spawn. Add a one-line "skip the spawn if the committed tree already satisfies the brief" guard to the implementer/orchestrator brief.
  Target: harness agents (sdd-implementer.md and implementation orchestrator brief).
  Effort: S. Risk: low: a no-op-detection guard cannot lose work.
  Prerequisites: none.
  Eval case: new case — a repair brief whose target is already committed yields "no change needed" without a second implementer spawn; grader checks spawn count.
  DECISION NEEDED: no.

- **P8 (F8) — `verify-standing.md` absent at the path the verifier expected.** The verifier fell back to the standing rules embedded in its role prompt, which worked. Smallest fix: remove the dangling `verify-standing.md` lookup from the verifier brief so the embedded rules are the single source, avoiding a stale external copy.
  Target: harness agents (sdd-verifier.md / orchestrator brief template).
  Effort: S. Risk: low: embedded rules already cover the content.
  Prerequisites: none.
  Eval case: new case — verifier brief contains no reference to a non-existent standing file; grader greps the brief for a dead path.
  DECISION NEEDED: yes. Single source for the verifier standing rules?
  - Option A (recommended): drop the external `verify-standing.md` reference; keep the rules embedded in the role prompt.
  - Option B: ship a real `verify-standing.md` and have the role prompt point at it.

- **P9 (F9) — Verifier base-diffs every suspected regression before blocking.** No change. This is the desired behaviour (agent-rules "fails at base" discipline); the extra base runs were correctly spent and are logged only for the pattern.
  Target: none.
  Effort: S. Risk: low.
  Prerequisites: none.
  Eval case: none — behaviour affirmed, no rule change.
  DECISION NEEDED: no.

- **P10 (F10) — Review-coverage gap: task 13 logged but unreviewed, merge allowed.** No change. This is the accepted decision-C / P9 policy: a coverage gap is logged for the human and the merge proceeds. It recurs across four specs → graduation candidate below to make the policy explicit in agent-rules.
  Target: none (policy; see Graduation).
  Effort: S. Risk: low.
  Prerequisites: none.
  Eval case: none.
  DECISION NEEDED: no.

- **P11 (F11) — Nine tasks closed on a gate-only review, verifier skipped.** No change. Verifier-skipping on gate-only tasks is the accepted P6/P15 routing; 4 verifiers vs 13 was the intended spend. Recurs with dashboard-loop-views → graduation candidate below.
  Target: none (policy; see Graduation).
  Effort: S. Risk: low.
  Prerequisites: none.
  Eval case: none.
  DECISION NEEDED: no.

- **P12 (F12) — Operator ruling on the task 1 file-list.** No separate change; the cause is F1 and is removed by P1. Once the export guard test is a required File:-list member, the gate no longer flags it and no operator ruling is needed.
  Target: none (covered by P1).
  Effort: S. Risk: low.
  Prerequisites: P1.
  Eval case: none — see P1.
  DECISION NEEDED: no.

- **P13 (F13) — Blocking e2e fixed in the test fixtures, not product code.** No change. The implementer correctly judged the fixtures wrong — they registered a `*-workspace` path never created on disk, an impossible production state — and the startup prune (R4 AC1) was right; narrowing the prune would have contradicted AC1. This is the fixture-validity bar working as intended. Reinforce it (see Graduation) so fixtures must seed every path they register on disk.
  Target: none (policy reinforced in Graduation).
  Effort: S. Risk: low.
  Prerequisites: none.
  Eval case: none — decision affirmed.
  DECISION NEEDED: no.

## Decisions

- P3: Where should the fix live? → repoint the test suite's temp root off `/tmp/scratchpad/sdd` so the hazard is gone for every run.
- P4: Fix the re-point or keep the C3 scope note? → leave deferred under C3 until the lifecycle is next touched; the stale-store case is rare and out of this spec's scope.
- P8: Single source for the verifier standing rules? → drop the external `verify-standing.md` reference; keep the rules embedded in the role prompt.
- P14: Where does the tracked fix task land? → record on owner backlog and schedule at the next runs-view touch.

## Rejected proposals

- P14: dropped at retro-plan.

## Close-out

One line per proposal, written by the close-out phase.
- P6: skipped — no change chosen
- P9: skipped — no change chosen
- P10: skipped — no change chosen
- P11: skipped — no change chosen
- P12: skipped — no change chosen
- P13: skipped — no change chosen
- P1: skipped — Already correctly implemented at 95f65eaf (round 1); rule present at .spec-workflow/agent-rules.md lines 89-94, tree clean, nothing valid to change. Gate's file-outside-list reason is a path-prefix false positive (item Target names bare agent-rules.md vs real .spec-workflow/agent-rules.md). No new commit — fabricating a cosmetic edit would be dishonest.
- P2: done — dfa77c79c2a82da2cd98625c871462d3ffe3be57
- P3: done — befa05798d8ddabd4cf78a7e31c0e1f4dd353a32
- P5: to-do (human) — Targets an 'implementation orchestrator brief' that does not exist; under ADR 0004 the orchestrator is the controller (src/controller/), which writes deferrals straight to the spec store. Belongs in controller code or agent-rules relocation rule (outside this worktree root); cannot go in sdd-implementer.md (implementer must not touch deferrals). Needs re-scoping.
- P7: done — ff17a8000d5dc4871561f264c2c0280e95abc2f6
- P8: to-do (human) — DECISION NEEDED. Option A contradicts the controller design: the per-task verifier brief defers its report block to verify-standing, which also carries the agent-rules/codebase-context reads and git-diff rule absent from the role prompt, and the controller reliably generates verify-standing.md (implementation.ts:554) so the 'dead path' premise no longer holds. Dropping it touches brief-templates.ts + implementation.ts + harness.test.ts and risks losing verifier instructions. Needs a human ruling (A vs B).
- spec-workflow-mcp: PR https://github.com/madmatt112/spec-workflow-mcp/pull/193
- P4: to-do (human) — DECISION NEEDED (owner): Option A (recommended) = leave deferred under C3 scope note, no code change; Option B = schedule product fix, blocked on its project-manager-lifecycle prerequisite. Not forcing a medium-risk watcher-lifecycle change in close-out.
