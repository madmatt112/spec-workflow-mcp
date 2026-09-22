# Adversarial Analysis — provider-per-role/tasks (v1), round 1

Primary attack surface: atomicity, ordering, coverage. Fresh lens: the sub-agent that
receives only one task's `_Prompt:` and must produce a correct, compiling change from it
alone. This is the first tasks-phase review.

## What I checked and how

- Read the target `tasks.md`, the approved `requirements.md`, the approved `design.md`,
  the `codebase-context.md`, and the `provider-per-role` decomposition entry
  (`.spec-workflow/spec-decomposition/decomposition.md:326-388`).
- Re-verified both citations the v1 lint commit changed (auto-MUST_FIX if wrong):
  - `harness/skills/sdd-document-phase/references/briefs.md:125-197` — heading at 125,
    fence opens at 130, closes at 197. **Correct.**
  - `harness/skills/sdd-continue/references/formats.md:5-17` — `## Verdict block` at 5,
    closing fence at 17. **Correct.**
- Spot-checked the load-bearing artifacts each task pins: `sdd-activity.sh:11-12,32-35,
  37-49,114-123`; `sdd-reviewer.md:7-12` (file tools, no MCP); `sdd-reviser.md:7-16`
  (three `mcp__…adversarial-response` names); `agent-profiles.json:47-56` (reviewer
  47-51, reviser 52-56); `formats.md:119-121,130-135,155-198` (retro categories incl.
  `escalation`, worker-report flag list, event table); `sdd-continue/SKILL.md:71-72,
  76-86,190-208,247-248`; `sdd-document-phase/SKILL.md:8-11,23-27`; the alias mapping
  `decomposition.md:255-258`. Every path/range/behaviour the tasks doc states is
  accurate. **No misstated artifact found.**
- Traced the step-8 completion-gate verifier path
  (`sdd-implementation-phase/SKILL.md:100-109,186-205`;
  `sdd-implementation-phase/references/briefs.md:96-190`) and the verification-only-task
  handling, because tasks 1, 3 and 10 depend on how the *running* session executes them.

## Findings

### R1-1 (SHOULD_FIX) — The "halts the spec there" guarantee is not enforced in the run that builds this spec

`tasks.md:9` (Dependency order) claims: "a failed proof or an unset key halts the spec
there (Requirement 6 criteria 6-7), so nothing later is built on an unproven vendor
path." The halt is `PHASE: escalate`, which the supervisor acts on
(`sdd-continue/SKILL.md:247-248`). But that value is produced by the implementation
orchestrator's *escalate branch*, which task 3 adds to
`sdd-implementation-phase/SKILL.md`. Today that skill routes only `DESIGN-DEFECT`,
`AFFECTS-FUTURE-SPECS` and `RETRO:` (verified `SKILL.md:100-106`); there is no `ESCALATE`
flag. Skills load at session start (CLAUDE.md, "Agents and skills are read at session
start"), and task 3 runs *after* task 1. So during this implementation run the
orchestrator cannot turn task 1's `ESCALATE:` line into `PHASE: escalate`. The doc's own
Scope note (`tasks.md:117`) and D6 admit this ("The branch is live from the next session
restart"), yet the Dependency-order paragraph still asserts an automatic halt.

Concrete failure: `DEEPSEEK_API_KEY` is set, task 1 writes the body, runs (a), and (a)
fails (e.g. the transcript is not at the computed slug path, or the analysis lacks a
verdict block). Task 1 commits the record and reports `ESCALATE:` + `RETRO: escalation`.
The orchestrator logs the retro entry, does **not** recognise `ESCALATE`, gates task 1
(it is not verification-only — `File:` names `sdd-launch.sh` and `deepseek-preflight.md`),
marks it `[x]`, and proceeds to tasks 2-9 on the unproven vendor path — the exact outcome
the preflight-first ordering was meant to prevent. The unset-key path is only marginally
safer: task 1 writes no body, so task 2 (`SDD_LAUNCH_BODY = the real body under harness/`)
fails for lack of `sdd-launch.sh` rather than stopping cleanly. The doc should state the
current-run behaviour explicitly — a failed (a)/unset key is a human-mediated stop this
run, not an automatic one — so no reader relies on a halt that will not fire.

### R1-2 (SHOULD_FIX) — Task 10's corrected scenarios never reach the completion-gate verifier

D5 (`tasks.md:108`) justifies task 10 thus: it rejected "leaving the scenarios to the
completion gate's decomposition grep" in favour of "a named task … because the
decomposition's scenario text is superseded in two places … and the verifier brief must
carry the corrected outcomes." That premise is unfounded. The completion gate
(`sdd-implementation-phase/SKILL.md:186-205`) greps the decomposition entry for the
scenario, and the end-to-end verifier brief inserts it **verbatim** under
`## Scenario (from the decomposition entry) <verbatim>`
(`sdd-implementation-phase/references/briefs.md:177-181`). Creating task 10 as a
verification-only task changes neither: the step-8 verifier still reads the decomposition,
not task 10.

The decomposition scenario is stale exactly where the spec's own scope notes say
(`requirements.md:148-149`): scenario (4) reads "stops at `run.start` with a `note` …
neither the page nor the TUI shows a spawn" (`decomposition.md:383-384`) — superseded by
RI-1/D5 to *no ledger row at all*; the launcher bullet reads "`--model` the DeepSeek name"
and "`ANTHROPIC_MODEL` set to the same name" (`decomposition.md:344,346`) — superseded by
R2-1/R1-2 to the `claude-*` alias. Fed this verbatim, a step-8 verifier tests outcomes the
implementation deliberately changed and can report `VERIFY: fail` against a correct build;
task 10's corrected scenarios (1)-(5) are never exercised.

Compounding the gap: task 10 is verification-only (`File: none`), so per
`SKILL.md:106-109` no verifier is spawned for it — the orchestrator "runs its check
commands" and marks it `[x] outcome=gate`. Yet task 10's `_Prompt:` is written as a
verifier's job that judges six scenarios, emits `VERIFY: pass (deferred: <id>)`, and files
a `verification` deferral (`SKILL.md:201-209`). Under the skill, no agent executes that
prompt: the orchestrator runs only the flat command list and does not emit `VERIFY:` or
create the deferral. So the deferral of the supervisor/orchestrator halves — the mechanism
`tasks.md:118` relies on — has no writer. Task 10 needs either a real wiring that feeds its
corrected scenarios into the e2e verifier brief (overriding the decomposition grep), or a
`File:` path so it is a normal, verified task, and its VERIFY:/deferral contract has to be
reconciled with the `outcome=gate` marking a verification-only task actually gets.

### R1-3 (MINOR) — Three acceptance criteria map to no task's `_Requirements` list

Req 3 crit 5 (Anthropic rows unchanged, a rowless spawn reads `anthropic`), Req 4 crit 1
(key never read from the spec store / run file / `agent-rules.md` / launch prompt) and
Req 4 crit 5 (the run never prints the key; the folds never read it) appear in no task's
`_Requirements:` line. They are enforced in practice — 3.5 by the tasks 7/8 regression
assertions and task 10 scenario (2); 4.1/4.5 by the task-4/5/7/8 restrictions and the
folds reading no environment — so this is not a behavioural hole. But criterion-level
coverage is not auditable from the task lists. Add the IDs to the tasks that enforce them,
or note in Scope that they are negative constraints carried by restrictions.

### R1-4 (MINOR) — Task 1's manual `SDD_*` export set is under-specified for the direct-body run

Task 1 runs the body directly (`bash sdd-launch.sh AGENT "MESSAGE"`), not through the
per-run `launch.sh` wrapper task 5 writes, so it must export every `SDD_*` var the body
reads. The design's `launch.sh` block lists nine (`design.md:112-123`), but task 1's
prompt names only four explicitly ("`SDD_SPEC_STORE_REPO` … `SDD_CODE_ROOT` …
`SDD_HARNESS_REPO` … `SDD_PROVIDERS`"), under a "Export the `SDD_*` values" clause. A
sub-agent must infer to also export `SDD_EVENT_SCRIPT` (the staged `event.sh`), `SDD_SPEC`,
`SDD_RUN` and `SDD_SPEC_DIR`. The body author knows the full read set, so it is
self-consistent, but naming the full nine (or referencing the design block) would remove
the guess.

## Top 3 conclusions to challenge or reverse

1. **"A failed proof or an unset key halts the spec there, so nothing later is built on an
   unproven vendor path" (Dependency order).** Reverse for the current run: the escalate
   branch that produces the halt is not loaded until task 3 lands and the session
   restarts, and task 1 precedes task 3, so a failed (a) leaves the loop running (R1-1).
2. **D5: "the verifier brief must carry the corrected outcomes" because task 10 is a named
   task.** The step-8 e2e brief fills its Scenario section verbatim from the decomposition,
   not from task 10; a named verification-only task does not change that (R1-2).
3. **Intro: "task 10 is the verification of Requirement 7."** As a verification-only task
   it spawns no verifier, and its `VERIFY:`/deferral output has no executor under
   `sdd-implementation-phase/SKILL.md:106-109`; the actual end-to-end verification is the
   decomposition-scenario verifier, which task 10 does not feed (R1-2).

## What is missing before acting on this document

- A wiring for task 10: either a step that substitutes task 10's corrected scenarios for
  the decomposition grep in the step-8 verifier brief, or task 10 gets a real `File:` and
  a normal gate; plus reconciliation of its `VERIFY:`/`verification`-deferral contract with
  the `outcome=gate` marking a verification-only task receives.
- An explicit statement of the current-run behaviour on a failed (a)/unset key (a
  human-mediated stop), since task 3's automatic halt is not active in the run that
  executes task 1.
- Criterion-level coverage for Req 3.5, Req 4.1 and Req 4.5 (enumerate the enforcing
  tasks, or note them as restriction-carried negative constraints).

## Note on gate B / gate C

No task introduces a new external dependency beyond the DeepSeek vendor path the approved
requirements already authorise (no new npm package; `claude -p`, `node crypto.randomUUID`
and the CLI flags are all present/probed). No `[gate-b:T…]` findings. Task 3's general
implementer `ESCALATE` flag and the implementation-orchestrator branch are harness-wide,
but design D11 (approved) chose exactly that mechanism over reusing design-defect, so it
is within approved scope. No `[gate-c:T…]` findings.

## Disposition of the lint pass rejections (asked to judge, not re-open)

The two bridge-missing rejections (tasks 1 and 4 naming a later task) are narrative:
task 1's "task 4 reads this record" and task 4's reference to task 10 are ordering prose,
not compile dependencies. Verified task 4 leverages `docs/deepseek-preflight.md` (a
task-1 artifact, a backward edge) and task 1/2 consume `SDD_*` and the body per the design
Data Models, not per another task's private symbol. The 69 citation-identifier
rejections cover tokens this spec introduces (`SDD_*`, `provider`, `UsageByProvider`,
`sdd-launch.sh`, `sdd-providers.sh`, `## Providers`) cited ahead of their creation, or
existing artifacts cited correctly elsewhere in the same prompt. The disposition holds.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 2
MINOR: 2
DESIGN_READY: no
ESCALATE: none
```
