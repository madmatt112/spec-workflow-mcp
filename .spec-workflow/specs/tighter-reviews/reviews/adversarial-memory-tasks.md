# Adversarial Review Memory — tasks
Last updated: 2026-04-29 (after v2 review)

## Cumulative Findings Summary

### Accepted (incorporated into current tasks.md)

**From v1 review (resolved before v2):**
- Closure-capture / annotation-persistence redesign: replaced by per-job storage on the runner (tasks 18/19/20).
- `EXPECTED_R4_BLOCK_NAMES` set guard: replaces count guard from inception.
- Track-A → Track-B interim sentinel marker: `# SPEC-WORKFLOW:TRACK-A:INTERIM-PIN` with regression test.
- R4.2 split into R4.2a (benign empty) / R4.2b (utility-rejection): mirrors R4.6a/R4.6b.
- R3.12 edge-case enumeration in task 3: full coverage of non-boolean / null / non-object / empty-string / non-string sub-keys.

**From v2 review (resolved in current tasks.md):**
- **Task 20 had no surface for annotation stamping** (v2 §1.1) — entire annotation-persistence design discarded; replaced by per-job storage extension to `AdversarialJob`/`TaskReviewJob` interfaces. Tasks 18/19/20 now mirror cleanly because both runners have `getJob(jobId)` accessors and a `model?: string` field on the job.
- **409 concurrent-initial check had no queryable surface** (v2 §1.2) — replaced by translating the runner's existing `(specName, phase)`-scoped duplicate-guard `Error` throw at the route layer with narrow message-shape match. Tasks 19/20 enumerate the translation; task 21 verifies other throws still 500.
- **`stampAnnotationRunnerOptions` clobbered by post-`runner.run` `updateApproval`** (v2 §1.3) — moot. The annotation persistence mechanism is gone. Per-job storage doesn't interact with `updateApproval`.
- **Whitespace-only / non-string model bypass** (v2 §1.5) — task 19/20's `typeof === 'string' && .trim() !== ''` filter covers whitespace-only, empty, null, non-string; all four shapes degrade identically.
- **Drift extractor numbered-list silent-loss** (v2 §2.1) — task 17 explicitly pins Direction A's "empty-block-as-failure" rule: a heading match without block content fails the test rather than vacuously matching.
- **Heading-format brittleness** (v2 §2.3) — task 17 pins the heading regex `/^####\s+(R4\.\d+[a-z]?)\s+[—-]\s+/m` and documents the constraint in a comment near it.
- **Direction B "directive sentence" definition unpinned** (v2 §2.4) — task 17 pins it as: any sentence in fixture directive blocks (`**Read first:**`, item-9, item-10), excluding (a) top-of-file docstring, (b) item-numbering boilerplate, (c) boldface markers. Pinned as a regex/extractor function.
- **Track-A interim methodology silent on `data.diff`** (v2 §3.1) — task 8.2 explicitly drops all diff-related data fields from Track A. Task 11 asserts the response shape contains NO diff-related fields (`data.diff` absent, not empty-string). Task 14 (Track B) adds the data fields and methodology preamble together. The "data field present, methodology silent" inconsistency is structurally prevented.
- **Task 8/11 boundary-test duplication** (v2 §3.2) — task 8 split into 8.1 (helpers + unit boundary tests, exclusive) and 8.2 (orchestration shell). Task 11 explicitly does NOT re-add boundary cases; it only exercises validateAllFiles via the integration surface.
- **`unwrapHygiene` rejection state structurally unreachable** (v2 §3.3) — partially addressed: task 11 stub-tests it as a synthetic surface for the synthetic guarantee; task 17 includes it in the diff-rejection-path tests. The R-level commitment gap remains design-level only.
- **Task 14 silent reliance on task-8 assertions surviving** (v2 §3.4) — addressed by the Track-A "no diff fields" stance: there are no Track-A diff assertions for task 14 to invalidate. Task 14 ships the fields and the methodology preamble together with new test assertions.
- **Task 19 ships annotation wiring without integration tests** (v2 §3.5) — task 19's prompt explicitly enumerates spy assertions (`callCount === 1` with `equal`); task 21's tests cover the integration surface for ES#15/ES#16 separately.
- **`diffRejection` placeholder semantics meaningless** (v2 §5.1) — placeholder framing dropped. Task 8 ships no diff fields; `diffRejection` is omitted by absence rather than placeholder.
- **R4.8 legacy item-9 byte-identical regression test** (v1 §3, v2 §4.1) — task 11 explicitly enumerates: "Legacy item-9 hygiene fixture passes byte-identically (R4.8 protection)."
- **End-to-end secret-leak test across all three consumers** (v1 §3, v2 §4.2) — task 17 explicitly extends to typecheck `coverage.compiled` AND `coverage.excluded` AND `diagnostics[].file` arrays.
- **`.spec-workflow/.cache/` `.gitignore` entry** (v1 §3, v2 §4.3) — task 5.1 includes "Append `.spec-workflow/.cache/` to repo `.gitignore` if absent."
- **R2.14 env-propagation symmetry** (v1 §3, v2 §4.5) — task 6 explicitly names `FORCE_COLOR=0` / `NO_COLOR=1` capture-the-execFile-env-arg assertion symmetric to task 13's `GIT_OPTIONAL_LOCKS=0`.
- **Concurrent-prepare error scenario surfacing** (v1 §3, v2 §4.6) — task 22 includes a one-paragraph README note in `Reviewer Configuration` / `Limitations`.

### Partially Accepted

- **Quantitative NFR thresholds** (v1 §4, v2 §4.4) — recurring across two reviews. Task 4 still says "regression bound" without numbers; warm vs cold split per design §"warm < 1 ms; cold 5–15 ms typical" vs NFR "< 5 ms per call" still conflicts. No CI gate. Status: still partially unaddressed.
- **Task 22 R3.11 same-PR with task 19/20** (v2 §5.2) — current tasks.md preserves the same-PR claim explicitly: "Tasks 19, 20, 22 land in a single PR (R3.11 same-PR constraint)." The previous review flagged that this contradicts task-line-per-PR convention; the current spec accepts the bundled-final-commit pattern explicitly. Bundling is now design intent, not contradiction.

### Rejected (not addressed; intentional or oversight unclear)

- None known explicitly. v2 review's recommendations were predominantly accepted via the per-job storage redesign.

### Unresolved

- **R4.x prose with internal paragraph breaks splits Direction A** (v2 §2.2) — no constraint pinned. R4 directives could maintain into multi-paragraph form and either silently merge or silently lose first paragraph depending on extractor implementation. Task 17's "block extraction" doesn't specify deduplication-by-heading semantics.
- **Heading-format renames silently parse to same R4.x name** (v2 §2.3 follow-up) — `#### R4.1 — Diff-present directive (renamed)` extracts as R4.1; the rename isn't surfaced. Drift catches structure not semantic identity.
- **17 fixture ordering / inter-block prose under-pinned** (v2 §2.4 follow-up) — Direction B's "directive sentence" definition partially pins this, but block-ordering inversions (R4.4 before `**Read first:**`) and non-directive filler prose between blocks (e.g., narrative "(fixture-only narration)") are not caught by the drift test.
- **Whitespace-only / non-string model in retry survives CLI version skew** (v2 §1.5 part-2) — task 19/20's filter catches the four "unusable shape" cases but does NOT catch a model-string-no-longer-valid case (model name renamed, CLI upgraded). Task 21's tests don't simulate this. R3.9's "telemetry/billing consistency" rationale doesn't survive the model-no-longer-exists case.
- **Server-restart wakeup race** — between dashboard server restart and retry handler invocation. The runner.jobs map is rebuilt empty at boot; if a retry POST arrives while the server is in mid-init or before all jobs are loaded (which is impossible in v1 because there's no persistence), the test path is the documented degraded fallback. Status: covered for v1 but worth re-verifying.
- **`runner.run` throws other than the duplicate-guard message** (v2 §1.2 follow-up): the 409 catch is narrow, but `runner.run` may also throw `Maximum 2 concurrent adversarial reviews per project` (per `adversarial-runner.ts`), which task 19's prompt acknowledges should still 500. Task 21's tests verify this ONLY for adversarial; verify for task-review if its runner has analogous throws.
- **`vi.spyOn` on `resolveRunnerModel`** (task 21) requires either namespace import or `vi.mock` partial; if `multi-server.ts` uses direct named import, the spy silently observes zero invocations (test fails loudly via `equal(1)` mismatch but the cause isn't obvious). Task 21 documents this in a top-of-file comment, but the underlying import-shape change in `multi-server.ts` is task 19/20's responsibility — circular dependency between tasks 19/20 and 21.
- **Per-job storage interaction with parallel job-store consumers** — `getJobsForProject` is the existing accessor used by other (non-Track-C) consumers. Adding `model?` to the job interface means downstream consumers (dashboard rendering, websocket pushes) may surface model in places that weren't previously surfaced. No task asserts this is intentional or hidden.
- **Concurrent initial-review collision scope semantics** — task 19 says "(specName, phase)" scope; task 20 says "(specName, taskId)". These are different keys. If a single user kicks off an adversarial review and a task review for the same spec in parallel (different scopes), no collision. But if the runner's underlying duplicate guard is keyed differently (e.g., adversarial-runner is `(specName, phase)`, task-review-runner may be `(specName, taskId)` or just `taskId` or something else), task 20's prefix-match must verify the actual message string in `task-review-runner.ts` — task 20 says "verify before pinning" but doesn't pin the verified prefix.
- **`failedJob` lookup in task 20's retry handler** — uses `getJobsForProject(projectId).find(j => j.specName === specName && j.taskId === taskId && j.status === 'failed')`. If multiple failed jobs for the same `(specName, taskId)` exist (multiple historical retries), `.find` returns the FIRST matched — which is order-dependent. The "first" job's `model` may not be the most recent retry's model. R3.9 says "retry uses initial's model"; if multiple retries exist, "initial" is ambiguous.
- **Track-C `cli`/`cliArgs` not pinned per-review** — task 19/20 read `cli`/`cliArgs` from current settings on retry, while `model` is pinned from the prior job. Mid-review settings edit causes `cli`/`cliArgs` divergence between initial and retry. Acknowledged as intentional but not documented to users (task 22 doesn't surface this).
- **`tsconfig` lookup in task 5.1** — task 5.1 says "tsconfig resolution (`'no-tsconfig'` / `'project-references'` / `'wrapper-config'`)" but doesn't enumerate the exact resolution algorithm. R2.1 says "the project root contains a `tsconfig.json`" but doesn't define "project root" — `projectPath`? The git root? Some search-upward? Task 5.1's prompt is silent.
- **R2.4 case-fold heuristic** — `process.platform === 'darwin' || process.platform === 'win32'` is wrong for: APFS on macOS in case-sensitive mode; ext4 with case-folding mounted on Linux; SMB-mounted Windows shares from Linux. Task 5.3 does not pin a fallback or document the heuristic's limits.
- **Task 22's `Limitations` section content** — task 22 says "or a sibling `Limitations` section" but doesn't enumerate other limitations that should appear there (multi-config typecheck unsupported, partial-commit diff gap, Windows process-termination grace, etc.). Existing `Out of Scope` items in requirements.md aren't surfaced in user docs.

## Patterns & Themes

- **Iterative stripping of premature mechanism**: v1 introduced annotation stamping to "fix" closure capture; v2 found three structural problems with the stamp; v3-era tasks.md replaces the stamp entirely with per-job storage. The simpler mechanism resolves the v2 findings cleanly. Pattern: each round's "elegant fix" introduces new structural issues that the next round catches; the third iteration is genuinely simpler.
- **Quantitative NFR thresholds remain unfixed across THREE review cycles**: v1 flagged, v2 flagged, current tasks.md still has placeholder regression bounds without percentile/hardware/instrument. This is a decorative-NFR pattern that hasn't moved despite repeated attention.
- **Cross-task ordering hazards**: the multi-PR sequencing across Tracks A → B introduces multiple seam contracts (Track A's "no diff fields" → Track B's "diff fields ship together with utility wiring"; task 8.1's exclusive boundary-test ownership → task 11's integration-only surface; task 16.1's interim sentinel deletion → task 17's sentinel regression). These are pinned at the task level but the seam invariants only fire at PR-merge time.
- **Cross-cutting integration assertions formerly missing are now mostly pinned**: secret-leak across three consumers is in task 17; legacy item-9 byte-identical is in task 11; env-propagation symmetry is in tasks 6 and 13. The remaining recurring gap is quantitative NFRs.
- **Settings cache and warn-once semantics**: density of edge-case enumeration in tasks 3/4 is the highest in the spec. R3.5 / R3.7 / R3.12 are all multi-branch with warn-once dedup. Worth verifying nothing slipped into a "warn-once for cause-class A but not for cause-class B" asymmetry.
- **Track-C re-write**: tasks 18/19/20 are entirely new. Per-job storage extension to runner interfaces. Worth scrutinizing whether this introduces NEW failure modes that v3 should catch — especially around concurrent reads of the job map, the `getJob` accessor's existing semantics under the new field, and the `failedJob.find` ordering issue called out in Unresolved.

## Guidance for Next Review (v3)

- **The biggest design churn was Track C's pivot from annotation persistence to per-job storage.** Verify the new mechanism doesn't introduce a v3-class problem the way annotation persistence introduced v2-class problems. Specific scrutiny areas:
  - The `failedJob.find` ordering in task 20's retry handler — what happens with multiple historical retries for the same `(specName, taskId)`?
  - The `vi.spyOn` import-shape circular dependency between tasks 19/20 and 21.
  - Whether `cli`/`cliArgs` divergence between initial and retry (across mid-review settings edits) is a real bug or accepted noise.
  - Whether downstream consumers of `getJobsForProject` (dashboard, websocket) accidentally surface `model` in places that weren't previously visible.
  - Race conditions in concurrent initial-and-retry: if a retry POST arrives during `runner.run`'s in-flight window, what happens?
- **Drift test corner cases not covered by v2's fixes**:
  - R4.x with internal paragraph breaks (Direction A behavior under deduplication-by-heading)
  - Heading renames that still parse to the same R4.x name (semantic identity, not structural)
  - Block-ordering inversions in fixtures (R4.4 before `**Read first:**`)
  - Non-directive filler prose between blocks (Direction B's "directive sentence" definition is pinned, but only catches sentences within marked directive blocks; non-directive narrative interleaved between blocks is uncaught)
- **Look for new failure modes in task splits** (5.1/5.2/5.3, 8.1/8.2, 16.1/16.2):
  - Sub-task ordering invariants that aren't enforced (e.g., what if 5.2 lands before 5.1's spawn contract is correct?)
  - Cross-sub-task contract drift (e.g., 5.1's "stub" being rewritten in 5.2 — is the function signature locked?)
  - Test-file boundary collisions (8.1's unit tests vs 11's integration tests in the same file)
- **Quantitative NFR thresholds are still placeholder** — re-flag if persisting; this is a third-time-recurring finding.
- **Unresolved items from v2 to re-verify status**:
  - R4.x internal paragraph breaks (still unresolved)
  - Heading-rename semantic identity (still unresolved)
  - Whitespace-only / non-string model — partially resolved by the `.trim()!==''` filter; CLI version skew case still unresolved
- **Areas that have been well-covered (avoid re-discovering)**:
  - Per-job storage as the retry-consistency mechanism (resolved cleanly in v3-era tasks.md)
  - Concurrent-initial 409 translation via narrow message-shape match (resolved — verify via Unresolved item)
  - End-to-end secret-leak across three consumers (now in task 17)
  - Drift test silent-loss path (numbered-list R4.x — closed via empty-block-as-failure rule)
  - Track-A interim "data.diff present but silent methodology" (resolved — Track A ships no diff fields)
  - Boundary-test split between tasks 8 and 11 (resolved with exclusive ownership)
- **Compounding lens**: where v2 found a structural problem in annotation-persistence and the v3 fix is per-job storage, look for new failure modes introduced by the new mechanism — not just whether the original problem is gone. The pattern is: "fix introduces new problems."
- **Recurring-finding lens**: quantitative NFRs are now THREE rounds unaddressed. If still unaddressed in v3, escalate severity in the analysis.
