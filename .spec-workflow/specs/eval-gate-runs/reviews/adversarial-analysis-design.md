# Adversarial Analysis — eval-gate-runs/design (v1, round 1)

Primary surface: feasibility, consistency, edge cases. First review. No fresh lens this round.

## What I attacked and how

### 1. The deltas since checkpoint `5bd412ab` (lint-pass citations) — attacked first
The only changes since v1 are five citation additions from the lint pass. I read both ends of each:
- `src/evals/select.ts:188-190` — `role` push (188), blank (189), `profile` push (190). The range covers both build sites. **Accurate.**
- `src/evals/gate.ts:20-23` — `RunGateResult` declaration. **Accurate.**
- `src/evals/gate.ts:92` — `revisitTrigger: \`eval case ${c.id} passes\``. **Accurate.**
- `src/evals/select.ts:19-23` — `SelectedCase` declaration (the Data Models line that previously implied it lived in `runner.ts`). **Accurate** — the corrected home.
No semantic drift; the lint pass was citation-only. Nothing to raise.

### 2. The reason-to-count rule (Component 1, D2) — is it airtight and consistent with R1?
Enumerated every reason string `selectCases` can emit: `case` (184), `role` (188), `profile` (190), `grader <name>` (194), `brief <template>` (153), `brief source` (200), `brief: base render unavailable` (131). The rule "indirect = equals `role`/`profile` OR starts with `brief`; 1 if all indirect else 3" classifies all seven with no gap: the three brief forms all share the `brief` prefix; `grader <name>` and `case` and any unknown reason fall to 3 (D2). Matches R1 AC1/AC3 and the decomposition. The `plannedRuns([])`→1 vacuous case is excluded by the stated non-empty precondition (`select.ts:204`). **No defect.**

### 3. The select/gate equality (Architecture, R4 AC5) and the provisional edge cases (Error Handling 3-4)
Both callers run `plannedRuns` over the same reasons; the gate always selects `mode:'exact'` (`gate.ts:41`), so equality holds by construction when the ranges and `--base-dist` match — exactly the condition R4 AC5 and Error Handling 4 state. Error Handling 3's two divergence directions (a `brief source`-only case dropping at the exact gate; exact render finding a `brief <template>` diff provisional's two-file check misses) are both reachable in `select.ts:174-202` and correctly scoped. **No defect.**

### 4. The deploy wiring and the dry-run symlink claim (Component 5, D6) — the load-bearing runtime claims
- Gate case lines reach `deploy.log`: `onLine` → `runGate` → `runCases.onLine` → `console.log` → script stdout (`sdd-self-update.sh:248`) → `execDeploy` logFd (`actions.ts:367-369`). Chain verified end to end.
- The design asserts a symlinked `dist/evals/cli.js` "exits 0 and prints nothing" because `cli.ts:208-215` compares unresolved `argv[1]` (`path.resolve`, no deref) against the realpath'd `import.meta.url`, and that `import()` of a CJS module exposes `exports.createWait`. **I probed both on node 24.13.0** (`/tmp/scratchpad/sdd/eval-gate-runs/probe`): symlinked main printed nothing, exit 0; dynamic `import()` of `exports.createWait = …` exposed it as a named export. Both true; behaviour is stable on node 20 (CI). The design's reasoning and the D6 wrapper requirement stand.

### 5. Citation integrity across every changed/relied-on artifact and test seam
Read both ends of each: `gate.ts:8-18/20-23/25-30/45-49/56-58/66-81/74/76/92/96`, `runner.ts:18-40/42-49/137-140/144/160/165-243/246-250/253-254`, `cli.ts:128-149/141/148/151-169/171-187/208-215`, `select.ts:131/153/184-200/204`, deploy script `232-234/236/248/252-258`. Test assertions the design touches or leans on: `gate.test.ts:369-371` becomes `fail-case fail 0/3 <reason>` (a 3-run `case`, correct), the `:337-338` comment follows, `:440` stays `passes 3/3` (3-run case, correct); `cli.test.ts:283` prefix `toContain` survives the appended count, `:318` stays `pass 3/3` (direct run); `service-scripts.test.ts:264` unchanged; `runner.test.ts:378-394` stub shape and `stub-claude.mjs:62-72` `.counter` match. **Every citation accurate.**

### 6. Prompt-specific MUST_FIX gates
- **Data Models completeness:** the only referenced result objects (`EvalResultRecord`/`EvalCaseRecord`, `RunGateResult`, `SelectedCase`) are unchanged and cited to full declarations, not given through union members only. Satisfied.
- **Error-branch shape:** every branch pins its discriminant+status via the CLI exit code — exit 1 (unnamed fail/inconclusive), exit 2 (override validation, `gate.ts:45-49/66-72`), exit 0. No HTTP surface, no race loser (sequential). Satisfied.
- **Library-capability claims:** probed (item 4). Satisfied.
- **Reader claim (R3 AC4):** grep confirms no record or `select`-output parser outside `src/evals/`; the `scripts/`/`docs/` hits are the `dist/evals/cli.js` path and prose. Satisfied.

## Top risks/gaps
None rising to SHOULD_FIX or above. The design is internally consistent, matches requirements and the decomposition, cites accurately at both ends, and its two load-bearing runtime claims are verified true.

## Conclusions to challenge
None reversed. The three central decisions I pressed hardest — (a) the all-indirect-else-3 rule, (b) select/gate equality by construction, (c) the symlink-forces-a-wrapper claim behind D6 — each survived a grounded check.

## What's missing before acting
Nothing blocking. Optional, not required: the design states the node-version probe results inline but points to no probe artifact; stating the verified behaviour is the accepted form, and I re-verified it independently, so no action is needed.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 0
DESIGN_READY: yes
ESCALATE: none
```
