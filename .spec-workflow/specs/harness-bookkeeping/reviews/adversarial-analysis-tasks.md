# Adversarial Analysis — harness-bookkeeping/tasks (v1)

Round 1 (first review). Primary attack surface: atomicity, ordering, coverage.
Fresh lens: the sub-agent that receives only the task prompt.

## What I checked and how

- Read the target `tasks.md` (v1), `codebase-context.md`, `requirements.md` (v3),
  `design.md` (v3), decomposition entry 6, and `agent-rules.md`.
- Re-verified every citation the v1 lint commit changed (the whole `## Changes since`
  set) at both ends against the real code:
  - task 1 — `task-parser.ts:153` (`parseTasksFromMarkdown`), `:164-176` (`checkboxIndices`),
    `:420` (`parseTaskProgress`): all correct.
  - task 2 — `task-parser.ts:153`; `index.ts:17-33` (array, 13 tools), `:35-96` (switch);
    `spec-status.ts:69-79` (`deriveSpecStatus`+`deriveDocumentApprovalStates`);
    `spec-lint.ts:79-90` (root/read pattern): all correct.
  - task 3 — `path-utils.ts:183-206` (`safeJoin`); `briefs.md:4-11` (agent-rules first-line
    rule): correct.
  - task 5 — `sdd-activity.sh:44-67` (PreToolUse/SubagentStop branches), `:11-29`
    (pointer/`SPEC_DIR`); `hooks.json:4-38`; `ledger.ts:14-20` (`LedgerEvent`): correct.
    Confirmed `tool_input.prompt` is genuinely a new field the script does not read today
    (lines 48-55 read command/file_path/subagent_type/action/pattern/skill only).
  - task 6 — `ledger.ts:226-248` (pairing loop), `:241` (`!s.endedAt` match), `:273`
    (`tokensTotal`), `:300-301` (ticker spawn branch); `render.ts:180-208` (`agentLines`):
    all correct. "per design Component 6" resolves.
  - task 7 — `formats.md:185-197` (event table): correct.
- Verified task 4's leverage (`ledger.ts:144-161`, `:188-224`, `:209-211`, `:216-224`,
  `:145-157`; `index-generator.ts:159-211`; `index.ts:35-39` `handoffPath`;
  `formats.md:52-67`) and task 8's (`TOOLS-REFERENCE.md:5` "13 tools", `:20-34` tool table).
  All correct; 13→14 is right (13 tools registered today).
- Confirmed the rejected `citation-identifier` warnings (lines 19/23/32/41/50/61/73/80) each
  name an artefact this spec creates at the anchor the new code attaches to — not
  mis-citations.

Deltas are clean: no wrong path, range, signature or behaviour in the changed lines. The
dependency chain compiles at each step, both not-implemented bridges (task 2's `brief` and
`phase-log`) are removed by their pointing tasks (3 and 4), and every cross-task reference
("task 1 adds", "tasks 2 to 4 add", "the hook task 5 writes", "the event task 6 defines")
points at the creating task. Design components 1-7 and requirement ACs all map to a task,
except 4.3 and 5.5, which are end-to-end verification scenarios correctly left to the gate.

## Findings

### R1-1 — SHOULD_FIX — The brief-template set is unenumerated; task 3 and task 7 share an unpinned contract

Task 3's `_Prompt` ships "the named server templates the five brief kinds need"; Scope note
(tasks.md:94) and design Scope (design.md:119) both say "the five brief kinds" without ever
listing them. But design Component 5 (design.md:61) enumerates the brief-launched workers as
**seven** kinds — drafter, lint/reviser, document-phase adjudicator, implementation
implementer, high-risk verifier, implementation adjudicator, close-out batch implementer —
and the live implementation skill writes at least an "implementer template" and a "verifier
template" by distinct names (`SKILL.md:85-86`, `:114-115`). So the number is inconsistent
with the design's own list, and neither document names the template identifiers.

Task 7 is the consumer: it edits the skills to "replace manual brief assembly with the
`brief` action" — i.e. call `harness brief` with a `template` name. That name must match a
template task 3 created. Failure scenario: task 3 (reading Component 5) creates a template
set keyed one way; task 7 references a name that is not in it; at runtime the orchestrator's
`harness brief` call returns `success:false` (unknown template, 2.3) and the phase cannot
spawn its worker. Neither task's checks catch it — task 3 asserts only the implementer brief
byte-for-byte plus a missing-value failure; task 7 asserts only `check:plugin-assets` +
`plugin validate`. Pin the exact template names (a table brief-kind → template name) in the
design or in tasks 3 and 7, and reconcile "five" with Component 5's seven.

### R1-2 — SHOULD_FIX — Task 7 bundles ~7 edits under checks that verify none of them (challenge D4)

Decision D4 folds every skill, budget and formats edit into one task "because they share the
sync-plugin-assets step and the one event-contract change and none compiles code." The result
is a task that must, across five files: replace Step 0 with `orient` in three skills, replace
manual brief writes with `brief` in three skills, drop worker `spawn.start`/`spawn.end` in
three skills, make `sdd-continue` call `phase-log`, add the `spawn.usage` row to `formats.md`,
and add a reduced-context sentence to two budgets. Its entire Success line is
`check:plugin-assets` + `plugin validate --strict` — the first proves `plugins/` matches
`harness/`, the second is schema validation. **Neither inspects the content of any edit.**

Concrete failure: if task 7 fails to remove worker `spawn.start`/`spawn.end` from one skill,
then after release both that skill's orchestrator **and** the task-5 hook append the boundary
events, so `buildModel` builds a phantom second `SpawnNode` for the same worker (the coarse
one the `spawn.usage` fold never claims), and `--watch` shows an extra spawn — breaking
Requirement 4.2's "same spawns/tokens." This passes every check task 5, 6 and 7 run. The one
scenario that could catch it, decomposition scenario 3 ("no orchestrator call"), is explicitly
deferrable under the `verification` tag (design.md:106). Give task 7 per-skill done-conditions
(or split the highest-risk edit — dropping worker spawn events, which must exactly complement
task 5 — from the budget-sentence edits), so "done" is checkable.

### R1-3 — MINOR — Intro calls tasks 5 and 6 "independent" while task 6 consumes task 5's output

tasks.md:4 says "tasks 5 and 6 add the hook events and the renderer join independently," yet
task 6's prompt says "Consume the `spawn.start`/`spawn.end` the hook task 5 writes." The claim
is true for build/test order (task 6's unit tests use synthetic fixtures, so it does not
compile-depend on task 5), but the wording invites a reader to think the two carry no
relationship. Reword to "build-independent; task 6 handles the events task 5 writes."

## Top risks / gaps

1. Unenumerated brief-template set (R1-1): task 3 producer and task 7 consumer share a
   template-name contract that no document pins and whose stated count contradicts the design.
2. Task 7's completion criteria (R1-2) cannot detect an omitted or wrong skill edit; the
   worst case is a silent double-write of spawn events that breaks the `--watch` invariant.
3. The double-write / drop-spawn-events change (task 5 hook writes them, task 7 skills stop
   writing them) only becomes coherent when both land and the plugin is reinstalled; the one
   e2e scenario that exercises it is deferrable, so the seam ships largely on inspection.

## Top 3 conclusions to challenge or reverse

1. **D4 — "one combined skill task."** Reverse or qualify. The unit of highest risk (worker
   spawn-event removal, which must mirror task 5) is bundled with trivial budget-sentence
   edits and verified by a sync/schema check that reads no content. Split it or attach
   per-skill done-conditions.
2. **"the five brief kinds" (tasks.md:94, design.md:119).** Challenge. Design Component 5
   lists seven brief-launched roles; "five" is unreconciled and no template names are given,
   so task 3 is not deterministically executable in isolation.
3. **tasks.md:4 "each task leaves ... every existing suite green."** Challenge for task 7:
   task 7 runs no existing suite (its only checks are `check:plugin-assets` and
   `plugin validate`), so the blanket claim over-states the guarantee for the one task that
   touches every skill.

## What's missing before acting

- A brief-kind → template-name table (in design Component 3 or shared by tasks 3 and 7), and
  reconciliation of "five" with Component 5's seven roles.
- Per-skill, checkable done-conditions for task 7 (which edits, in which skill, confirmed how),
  so a partial edit cannot pass.
- A stated guard that task 7 (skills stop writing worker spawn events) and task 5 (hook starts
  writing them) are released together, since neither task's checks detect the transient
  double-write between them.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 2
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
