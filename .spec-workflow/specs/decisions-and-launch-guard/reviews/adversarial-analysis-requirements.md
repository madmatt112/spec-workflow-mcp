# Adversarial Analysis — decisions-and-launch-guard/requirements (v1, round 1)

First review. Primary surface: completeness, ambiguity, scope. Fresh lens: wire
contracts across a boundary (router, query params, response shapes, client state).
Deltas since `c988b71b` are the lint-pass citation corrections and the rejected-lint
note; I re-checked every changed citation against the code (all accurate — see below).

## What I checked and how

Read: requirements.md (all), codebase-context.md, decomposition entry 36, agent-rules.md.
Read both ends of every citation changed in the diff and the load-bearing ones:
- `project-registry.ts:354-393` — `registerProjectLocked` overwrites `projectName` at
  :376, computes it at :360 (`options.projectName || generate…`). Accurate (R1 AC2).
- `harness.ts:541-561` `classifyTarget` / `closeout.ts:362-375`,`:368` — both match
  `/Target:/`, so a `Target document:` line yields class `none`. Accurate (R3 AC7, AC2).
- `runs.ts:1314-1315`,`:1355-1358`,`:1136-1139`,`:1261-1265`,`:1288-1291` — each opens a
  wait; `:832`/`:849-851` runOnce sets `running`; `:566-571` save spreads; `:1331-1354`
  document retry re-calls `runDocumentPhase` with no cancel check. Accurate (R7).
- `runStep(` production call sites: exactly five (document 401, implementation 472,
  retrospective 169, closeout 319, merge-fix 229). R7 AC1's "five" is exhaustive.
- `tiles.tsx:126`,`:149-150`,`:165-174`; `board.ts:35`,`:46-59`,`:90-117`;
  `runs.ts:1410-1431` discardRun acts on `run.branch`, `:1482-1488` branchHeld sees live
  only. Accurate (R8/R9/R10). The wire row `ControllerRunRow` already carries `phase`,
  `created`, `status`, `inFlight`, `lastActivity`, `stepStarted`, `branchPresent`,
  `discardAllowed` — R8/R9/R10 need **no new wire field**.
- `implementation.ts:826-842`,`:858-871`,`:880-893`,`:929-936`; `gate-rules.ts:527-529`;
  `case.json:29` (`"prefix":"REQUIRED:"`); `sdd-implementer.md:31`. Accurate (R4).
- `document.ts:253-265` REVIEWER_SCHEMA (findings are plain strings; a label needs a
  schema change), `:892-903` SHOULD_FIX-only path gated on `D>=2`. Accurate (R5).
- `path-utils.ts:108` translatePath is identity unless `SPEC_WORKFLOW_*_PATH_PREFIX` env
  is set (off on this host), so R2 AC1 / NFR equating list `projectPath`
  (`originalProjectPath`) with launch `codeRoot` (`workspacePath`) holds in practice.
- `run-setup.ts:150-224` buildSetupView reads the store; `HomePage.tsx:83-88` currently
  tracks `nextProjects` (one representative per store) — R2 AC2 "replaces nextProjects"
  is accurate. `useNextViews.ts` fetches `/harness/setup` per tracked project.

No misstated artifact found. No MUST_FIX.

## Topics attacked

### 1. Requirement 2 "Launch guard" — the no-`tasks.md` path
- Challenge AC7's split: it names the no-`tasks.md` case "the common case at launch"
  (true — `nextUnstartedSpec` returns specs with **no directory**), then specifies novel
  behaviour there ("read the source the design states … a comparison for a decomposition
  entry that names repository paths"). The novel, risky logic lives on the common branch.
- Stress-test the Verification line against AC7: the Verification ("with task files only
  in the app repository …") and the decomposition's e2e item 2 both assume a spec that
  **has** task files — i.e. the `tasks.md` File:-entry branch, the *rarer* case. The
  decomposition-entry branch AC7 calls common has **no** stated acceptance scenario.
- Confirm the one-run-per-store interaction is safe: once a run is live, `launchBlock`
  nulls `launchable` for the shared store, so both tradr tiles vanish (good, no gap).
- Confirm the cross-project "name the project to use" (AC3/AC6) is implementable without
  a new boundary: each per-project setup view can report presence under its own
  `workspacePath`, and the frontend (which knows the store group) combines the booleans.
  So this is **not** a wire gap — no finding.

### 2. Requirement 3 "Close-out builds recorded decisions"
- Confirm the premise: `parsePlanItems` (`harness.ts:504`) scans only `## Approved
  proposals`/`## Graduation candidates`; the `## Decisions` lines `buildRetroPlanMarkdown`
  writes (`runs.ts:352-356`) are a separate section the close-out does not read today. AC1
  correctly requires a new read. Sound.
- Stress-test the `## Decisions` parse contract: the writer inlines
  `- <id>: <question> → <answer>` on one line (`runs.ts:356`). AC1 says "read the
  `## Decisions` lines" but a free-text answer containing a newline or `→` would truncate
  under a line-based parse. Unaddressed (MINOR).
- Challenge AC5's "chooses no change" test: deferred to "the design states the test"
  against free-text answers — a fuzzy match with no bound in the requirement (MINOR).

### 3. Requirement 5 "Doc review cap" — the label contract
- Confirm AC2 vs base: the SHOULD_FIX-only path is gated on `D>=2` and
  `openMustFix==0`; round 1 is `D==1`, so a new branch is genuinely required. Sound.
- Confirm severity/label orthogonality: a drafting **MUST_FIX** (e.g. a wrong citation,
  which the standing rules make an automatic MUST_FIX) is coherent with AC1's definition.
  No contradiction.
- Note the label is a reviewer→controller wire change (REVIEWER_SCHEMA findings are
  `string[]`); AC1 defers "how the label travels" to design — acceptable.

### 4. Requirement 1 "Project display names" — durable vs read path
- Stress-test AC8 "These values SHALL be registry data" against AC2/AC3: the durable row
  is `projects.json` (AC3); the registry `projectName` is overwritten on every
  registration (:376). Resolved: post-fix the registration feeds `options.projectName`
  from the durable store, and pages read the synced live context — "registry data"
  describes the read path, AC3 the durable source. Coherent, not a defect.

## Findings

### R1-1 — SHOULD_FIX — Novel — Req 2 AC7 / Verification
The requirement elevates the no-`tasks.md` path to "the common case at launch" and puts
the novel guard logic there (read the design-stated source, compare against a
decomposition entry's repository paths), but the **only** acceptance scenario the
requirement names (the `Verification:` line) and the decomposition's e2e item 2 both use
a spec that **has** task files — the `tasks.md` File:-entry branch. A wrong implementation
of the decomposition-entry comparison would pass every scenario the requirement states.
**Failure scenario:** the design reads the decomposition entry for a tradr spec with no
`tasks.md`, mis-resolves a `src/…` path that exists under both tradr code roots, and warns
on (or clears) the wrong tile — and no stated verification catches it, because every
verification uses the `tasks.md` path. **Fix:** add a Verification for a launchable spec
with **no** `tasks.md` (the AC7 common case), or state explicitly that the design's
live-verification owns that branch so the tasks phase is bound to cover it.

### R1-2 — MINOR — Req 2 AC5
"WHEN no warning shows THEN one press SHALL launch (invariant, verified, not red-first)"
carries no citation, unlike every sibling invariant (AC10 cites `multi-server.ts:105-132`).
The base one-press path is `HomePage.tsx:188-194`. Add the citation.

### R1-3 — MINOR — Req 3 AC1
The `## Decisions` read contract assumes a single-line answer; `buildRetroPlanMarkdown`
inlines the answer (`runs.ts:356`). State that answers are single-line (or that the parse
takes the first line), so a multi-line / `→`-bearing answer does not truncate silently.

### R1-4 — MINOR — Req 3 AC5
"IF the recorded answer itself chooses no change" is matched against free text with the
test deferred ("the design states the test"). Flag that the match is heuristic so the
design pins and tests it; an unmatched "no change" answer regresses to a batch.

### R1-5 — MINOR — Introduction
"fixes eleven operator-reported defects" — items 4 (file-list patch, retro P6) and 5 (doc
review cap, retro P5) are retro efficiency decisions, not operator-reported defects. Loose
wording; "eleven operator items" or similar is truer to the decomposition.

## Closing deliverables

**Top risks/gaps**
1. The guard's common branch (no `tasks.md` → decomposition-entry comparison) ships
   unverified by any stated scenario (R1-1).
2. Cross-repo path ambiguity on that branch: a `src/…` path named by a decomposition entry
   can exist under both tradr code roots, and the requirement gives no disambiguation rule
   for that source (design-deferred via Scope notes, but unverified — folds into R1-1).
3. The `## Decisions` phase-to-phase format contract tolerates only single-line answers
   (R1-3).

**Top 3 conclusions to challenge**
1. "Verification: with task files only in the app repository…" — this does **not**
   exercise the path AC7 itself calls common. Reverse the emphasis: the no-`tasks.md`
   scenario is the one most worth a stated verification.
2. AC7 "this is the common case at launch" vs the Verification — internally inconsistent
   about which branch matters; resolve by verifying the common branch.
3. R2 AC1/NFR "the value a launch stores as codeRoot" — strictly the list carries
   `originalProjectPath` and the launch stores translated `workspacePath`; identical only
   because translation is off on this host. Fine to keep, but the equivalence is
   host-conditional, not definitional.

**What's missing before acting**
- A verification (or explicit design-owned deferral) for launch on a spec with no
  `tasks.md`, plus the disambiguation rule for a decomposition-entry path that resolves
  under more than one store-group code root.
- The single-line constraint on `## Decisions` answers.

Nothing here needs a human now.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 4
DESIGN_READY: no
ESCALATE: none
```
