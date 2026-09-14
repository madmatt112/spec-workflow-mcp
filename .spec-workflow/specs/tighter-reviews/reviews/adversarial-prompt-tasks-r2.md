# Adversarial Review — `tighter-reviews` tasks.md (round 2)

You are a senior engineering lead with deep experience shipping multi-track Node/TypeScript refactors that touch shared orchestration code, child-process invocation, and persistence-layer schema evolution. You have shipped enough "structurally guaranteed" features to know that those guarantees rot in the gaps between sequential HTTP requests, between PR boundaries, and between requirements/design/tasks layers.

Your job is to **tear apart the tasks document** for the `tighter-reviews` spec at `.spec-workflow/specs/tighter-reviews/tasks.md`. Do not validate. Do not "highlight what's good." Find the failure modes, the gaps in coverage, the tasks that look reviewable but aren't, the requirements that the task graph silently drops on the floor, the new mechanisms whose own failure surfaces have not been thought through. Be specific and concrete. Cite failure scenarios, not abstract risks. If something is actually fine, say so briefly and move on.

You have access to the full project tree. Read what you need: `tasks.md`, `requirements.md`, `design.md`, the actual code at `src/dashboard/multi-server.ts`, `src/tools/review-task.ts`, `src/core/hygiene-signals.ts`, anything else that grounds an attack angle. Steering docs are absent (`.spec-workflow/steering/` is empty); ground attacks in the requirements/design and the actual file layout.

## Prior Review Context

This is the **second** adversarial review of this tasks document. Round 1 already landed several findings that have been fully or partially addressed in the current `tasks.md`. The cumulative memory is at `.spec-workflow/specs/tighter-reviews/reviews/adversarial-memory-tasks.md` — read it before you start.

**Already resolved by current tasks.md (do NOT re-discover):**
- Track C "closure capture" structural impossibility — replaced by `stampAnnotationRunnerOptions` + `parseApprovalAnnotation` annotation-persistence design (tasks 18/19/20).
- `EXPECTED_R4_BLOCK_COUNT = 5` failing the drift test — replaced by `EXPECTED_R4_BLOCK_NAMES` set guard from inception.
- Track-A interim fixtures lacking sentinel marker — `# SPEC-WORKFLOW:TRACK-A:INTERIM-PIN` marker + sentinel regression test added.
- R4.2 not splitting benign empty from utility-rejection — split into R4.2a / R4.2b mirroring R4.6a / R4.6b.
- R3.12 partial coverage of `features` block edge cases — task 3's prompt now enumerates non-boolean, empty-string, null, non-object, unknown sub-keys.

**Still unresolved from round 1 (these are fair targets if you find them recurring):**
- R4.8 byte-identical legacy item-9 hygiene fixture regression test — no task pins this.
- End-to-end secret-leak integration test through `handlePrepare` — no task asserts `.ENV` ends up in `data.skippedPaths` AND absent from `data.diff` AND absent from `hygieneSignals` together.
- `.spec-workflow/.cache/` lifecycle / `.gitignore` — undocumented.
- Quantitative NFR thresholds — no percentile/hardware/instrument on "< 5 ms," "< 200 ms," "< 5 s incremental."
- R2.14 env-propagation assertion (`FORCE_COLOR=0` / `NO_COLOR=1`) — task 6 doesn't symmetrically enumerate it the way task 13 names `GIT_OPTIONAL_LOCKS=0`.
- Concurrent prepare against same project — design §7 calls it unsupported but no task surfaces it.
- `validateAllFiles`, `hygieneRejection`, `diffRejection` — design+tasks-level only, no R-level commitment.

**Classify every finding** as one of:
- **Novel** — not identified in any prior review.
- **Compounding** — builds on or deepens a prior finding (e.g., a recurring issue that has a new failure mode introduced by the v2 design pivot).
- **Recurring** — same issue identified before but not yet resolved; severity should escalate.

The bar for **novel** findings is high in round 2. Most low-hanging fruit was picked in round 1. Where you can, dig into the **new mechanisms introduced by the v2 fixes** — they were designed in response to round-1 critique and have not been adversarially reviewed. The primary candidates are the annotation-persistence design (tasks 18/19/20), the seven new cross-axis composite fixtures (task 16), and the drift-test extractor + expected-name-set guard mechanism (task 17).

## Analysis Dimensions

### 1. Annotation-persistence design (tasks 18, 19, 20) — the v2 replacement for closure capture

The Track-C persistence design is brand new since round 1. `stampAnnotationRunnerOptions` (task 18) merges `runnerOptions.model` into the JSON-string annotation; the retry handler (tasks 19, 20) reads it back with try/catch + four-shape filter (`null`, empty, non-string, missing). Attack:

- Stress-test the **stamp-then-run ordering**: task 19 says "stamp BEFORE invoking `runner.run`." What happens if `stampAnnotationRunnerOptions` succeeds but `runner.run` throws synchronously before the runner is registered with the approval-state machine? The annotation has a `runnerOptions.model` for an approval whose state never advanced past "in-flight"; the in-flight check (409 concurrent-initial) may now see this as a permanent in-flight job and block all future initials.
- Challenge **idempotency claims**. Task 18's prompt says "Idempotent. ... re-stamping the same model is a no-op write." Verify against the underlying approval-store API: does it write a new file revision on every call, even if content is identical? If yes, "idempotent" is at the **observable** level only, not the I/O level — file-watch consumers, audit logs, or git-tracked annotation files will see noise.
- Probe the **future-spec collision risk** the design explicitly calls out: "future-spec writers using the `runnerOptions` key for a different purpose — Track C owns this key." This is not a structural guarantee; it is a coordination promise. The schema rules say "Unknown keys under `runnerOptions` are silently ignored (forward-compat)." But the **stamp** helper is described as "merges `runnerOptions: { model }` (does NOT mutate other fields)" — does the merge implementation actually preserve unknown future keys, or does it overwrite the whole `runnerOptions` object? Task 18's prompt is silent on this.
- Hammer the **409 concurrent-initial** path. Task 19 says "concurrent-initial check at route entry returns 409 ... if approval-state machine reports an in-flight job." But which approval-state machine surface returns this? Does the existing `multi-server.ts` expose a sync queryable "is there an in-flight runner job for this approvalId?" — or is task 19 inventing a new approval-state surface that itself needs schema design? Read the actual code at `src/dashboard/multi-server.ts:742` and `:879` and verify the surface exists.
- Attack **the four-shape filter** (`null`, empty, non-string, missing): task 19 says `typeof === 'string' && !== ''`. What about a **whitespace-only model** (`"   "`)? CLI-default behavior with `--model "   "` is implementation-defined — likely passes the filter. What about a **valid-looking-but-unsupported model name** persisted from a prior version of the settings file? The retry will run with a model the current CLI rejects, with no recovery path beyond surfacing the CLI failure to the user.
- Question the **JSON.stringify ordering / canonicalization** assumption in the stamp: if task 18's helper reads existing annotation, mutates the object, and re-stringifies, the field order of the rest of the annotation may change (V8 preserves insertion order). Audit-log diffs become noise; git-tracked annotation files churn.

### 2. The 17 composite-pin fixtures (task 16) — newly expanded scope

Task 16 ships 17 hand-authored fixtures: 7 typecheck-axis + 4 diff-axis + 6 cross-axis. Two of the cross-axis fixtures (#5 `diff-rejected + typecheck-rejection` and #6 `success-partial-coverage + unavailable-other`) are NEW in v4 and were chosen specifically because they "expose rhetorical overlap." Attack:

- Challenge whether **fixture authorship discovers contradiction or merely pins it**. R4.10 admits "the fixture authoring step exposes the rhetorical overlap and either motivates prose alignment or pins the deliberate redundancy." If the author chooses "pin the deliberate redundancy," the LLM at review time still sees two "Surface this in your review summary" asks and may produce one summary with both notes collapsed — defeating the surfacing intent. No task pins LLM-side behavior; the fixture only pins what `buildReviewMethodology` emits.
- Probe **fixture authorship reliability**. R4 prose is authoritative; fixtures are derived. Task 16's success says "byte-identical (after normalization) to `buildReviewMethodology` output." But the fixture is **hand-authored** (humans cut/paste R4 verbatim text into fixtures), then the test asserts byte-equality. The author is two layers of typing-error away from a passing fixture: (1) R4 prose change in requirements.md not reflected in fixture, (2) fixture authoring typo never caught. Direction A drift test catches (1) when an R4.x block fails to appear; Direction B catches the inverse. But neither catches a **R4.x block correctly present + correctly placed + extra junk between blocks**.
- Stress-test **the boundary detection on `\n\n` BEFORE whitespace-collapse**. Design §Testing line 511 + R4.10 line 218 both name this ordering. What if a directive's verbatim prose **itself contains a paragraph break** (e.g. a multi-paragraph R4 directive)? The boundary extractor would split it into two blocks. The Direction A check would then fail on that R4.x block because no fixture contains it as a single contiguous substring. R4 prose was not designed under the constraint "no internal `\n\n`."
- Attack the **expected-name-set guard's specific assumption** that R4.x names are extractable from headings (`#### R4.x — ...`). What if a future requirement uses `### R4.x` (three hashes) or `**R4.x — ...**` (bold instead of heading)? The extractor returns a different name and the guard fails. Or worse: a renamed heading (`#### R4.1 — Diff-present directive (renamed)`) parses to `R4.1` correctly but the prose drift goes undetected.
- Probe **fixture-mass cognitive load on the reviewer**. Task 16's PR is one dashboard task review for 17 hand-authored prose fixtures plus a sentinel test plus a drift extractor change. The reviewer's job is to validate that 17 ~30–80-line fixtures match R4 verbatim by eye. Direction A catches structural mismatches but not "fixture composes R4 blocks in the wrong order" or "fixture has correct content but wrong contextual prose between directives." Round 1 flagged this at 15 fixtures; the count went **up** to 17.

### 3. Drift extractor + name-set guard (task 17) — new mechanism since round 1

The drift test now extracts blocks from `requirements.md` keyed by R4.x name parsed from the preceding heading, asserts both Direction A and Direction B, and asserts the keyset matches `EXPECTED_R4_BLOCK_NAMES`. Attack:

- Probe the **block extractor's regex behavior** on edge cases: nested code fences in R4 prose (a fenced `\`\`\`ts` block inside a fenced R4 directive); block-quote prose that wraps onto an unindented line then back into `> `; a heading line that happens to contain a `#### R4.x` substring inside a code span.
- Challenge the **"adjacent quoted/fenced lines join into one block per directive"** rule (design line 514). What about a directive that contains a deliberate paragraph break (blank `>` line)? Joins as one block — but then Direction A asserts the merged block must appear as a single contiguous substring in a fixture. Fixtures use `\n\n` for paragraph breaks; the merged R4 block doesn't have them.
- Stress-test **`EXPECTED_R4_BLOCK_NAMES` lockstep updating**. R4.10 says "Updating R4 (adding/removing directives) requires updating `EXPECTED_R4_BLOCK_NAMES` in lockstep." If a future spec adds R4.9 and the test fails, the failure pinpoints the missing name — but the constant lives in the test file, not in `requirements.md`. There's no compile-time link between the canonical R4 prose and the test constant. A future spec author can update R4 and update the constant **without** updating the fixtures, and the drift test passes vacuously (Direction A says "appears in at least one fixture" — if the new directive isn't in any fixture, Direction A fails; but if the spec author also adds a single trivial fixture mentioning the directive, both directions pass without the directive being properly composed).
- Attack the **two-way drift's silent-loss exemption**. R4.10 line 228 says "Closes the silent-loss path where a future R4.x written as a numbered list (`1. **Read X first.** ...`) bypasses the `> ` and ` ``` ` delimiters." But the *new* R4.x is the one bypassing — the test only fails if the extractor still finds the *old* expected name set without the new entry. If the spec author writes the new directive as a numbered list AND adds the name to `EXPECTED_R4_BLOCK_NAMES`, the keyset assertion fails (new name missing from extracted set). OK — but a more devious attack: the spec author writes the new directive in prose AND **doesn't** update `EXPECTED_R4_BLOCK_NAMES`. The extractor finds an extra block; the keyset assertion fails; the spec author "fixes" the test by either reverting their prose or adding the name. Both paths force a deliberate decision — which is the goal — but the failure mode where someone **deletes** `EXPECTED_R4_BLOCK_NAMES` entries to "make tests pass" is the realistic risk. Verify this isn't the path of least resistance.

### 4. Cross-task ordering hazards still in play

- Track A's PR ships `data.diff = ""`, `data.diffStats: undefined`, `data.skippedPaths: []`, `data.diffTruncated: false`, no `data.diffRejection`, AND **task 9's methodology emits no diff directive** (interim — diff state is `'empty'` for the seven Track-A fixtures). Reviewer-visible result: the LLM that reads `data.diff === ""` and finds no directive about it may invent guidance. Task 11's tests should pin "interim emits no diff directive even though the data field is present." Check task 11's enumeration — is this assertion actually there, or implicit in the fixture comparison only?
- Task 8 wires `unwrapHygiene` per design §`unwrap*` helpers, including a `hygieneRejection` field on `data`. But `computeHygieneSignals` is **already wired** (task 8's prompt notes "hygiene was already wired; preserve its behavior"). What does "preserve its behavior" mean for the new `Promise.allSettled` shape — does the existing serial call get *replaced* by `allSettled`, or does the existing serial call coexist? If coexist, the hygiene utility runs twice per prepare. If replaced, "preserve its behavior" requires that the existing tests still pass; task 8's success criterion does not name this regression.
- Tasks 18 and 19 are sequential (`stampAnnotationRunnerOptions` lands before its consumers). But task 19 cites "ES#16" (annotation write failure) and "ES#17" (annotation read-failure) — the integration tests for these scenarios are in task 21. **Task 19's PR ships the wiring with no integration-level test of the failure modes it claims to handle.** Task 21 lands the tests three tasks later. In the gap, task 19's PR cannot demonstrate the legacy fallback works end-to-end.
- Task 16 deletes the seven Track-A interim fixtures and authors 17. Task 17 then adds the drift test that extracts from fixtures. **What asserts the deletion happened?** Task 17's sentinel test catches `# SPEC-WORKFLOW:TRACK-A:INTERIM-PIN` markers; if task 16's author removes the marker but leaves a stale `success-clean-full.txt` from Track A, the sentinel passes. Direction B (fixture-only sentences must be in some R4.x block) catches this only if the stale fixture's prose happens to be an R4.x substring — it would, since Track-A interim fixtures *are* derived from R4. Stale fixture survives undetected.

### 5. Edge cases of the v1-flagged-but-still-unresolved items

These were flagged in round 1 and remain open. Look for **compounding** failure modes — not just "still missing" but "still missing AND now interacts with v2 changes."

- **R4.8 legacy item-9 hygiene fixture protection**: `buildReviewMethodology` is being rethreaded to take `diffState` and `typecheckState` parameters. If the implementation's emit logic for items 1–9 is touched (even to thread parameters), the legacy `fast-reviews` item-9 fixture pin from `src/tools/__tests__/review-task.test.ts:100` could drift. Task 11 should explicitly run that legacy test under the new orchestration; check whether it does.
- **End-to-end secret-leak**: now there are three consumers (diff, hygiene, typecheck output denylist filter). Without an end-to-end test, a regression in any one of them goes silent. The task graph could regress task 7's hygiene denylist call (e.g. someone refactors the hygiene scanner and forgets to apply `partitionPaths`); the existing hygiene unit tests would catch the *unit* but not the *integration*.
- **`.spec-workflow/.cache/`**: task 5 creates it but doesn't gitignore it. With the buildinfo fix landing in Track A, the directory will exist on every developer machine after the first review. The repo's `.gitignore` (check it) may or may not already have `.spec-workflow/`-prefixed entries; if it ignores `.spec-workflow/.git-history.json` but not `.spec-workflow/.cache/`, the buildinfo will get committed.
- **Task-level NFR thresholds**: with task 4's "regression bound" and no number, what's the actual CI gate? If there is no gate, the NFR is decorative.

### 6. Tasks-doc internal contradictions

- Task 8's "diff stub" pattern has an under-specified contract. Task 8 says the stub "resolves to `{ diff: '', stats: undefined, skippedPaths: [], truncated: false }`." Task 14 (Track B) replaces the stub. But task 14's new `data.diffRejection` field is a NEW field — was it in task 8's stub or not? Task 8's data-fields list says `diffRejection` is a "placeholder value until Track B." A placeholder for a field whose entire purpose is "present iff utility rejected" is meaningless — there are only two states: present-with-message or absent. What does the placeholder look like?
- Task 22 (docs) says "ship in same PR as Track C code." But task 22 is its own task line in tasks.md; the dashboard task review process treats each task line as a separate review checkpoint. Either Tasks 18+19+20+21+22 must collectively ship in one PR (which violates the task-line-per-PR convention), or task 22 ships separately and the same-PR claim is broken. Task 22's prompt says "doc updates land in the same PR as Track C's code, not a follow-up" — but the surrounding task structure makes this hard to enforce.
- Task 8 ships `validateAllFiles` boundary tests **inside the same task** as the orchestration-shell. Task 11 also lists "validateAllFiles boundary tests" in its test enumeration. Are these the same tests landing twice, or different cases? If the same: redundant work and a test-naming collision. If different: under-specified split.

## Closing Deliverables

Conclude with:

- **Top 5 risks/gaps** ranked by severity. For each, give a concrete failure scenario (what breaks, who notices when, why the existing tests don't catch it).
- **Top 3 conclusions to challenge or reverse**. Be specific about which task or task-prompt sentence to challenge and what alternative is principled.
- **What's missing** — work that should be done before acting on this tasks document. Categorize as: must-do-pre-merge, should-do-during-implementation, can-defer-to-follow-up.
- **Findings classification**: at the top of your output, give a count breakdown — `{novel: N, compounding: N, recurring: N}` — so the next review iteration can see at a glance what proportion of the analysis is new ground vs. reinforcement of prior findings. **Tag every individual finding inline** with one of these three labels.

Be specific and concrete. Cite failure scenarios, not abstract risks. If something is actually fine, say so briefly and move on. Do not pad with summaries of what's good. Direct your effort at the unresolved items and the new mechanisms.

## Where to write your analysis

Write your full review to:
`.spec-workflow/specs/tighter-reviews/reviews/adversarial-analysis-tasks-r2.md`
