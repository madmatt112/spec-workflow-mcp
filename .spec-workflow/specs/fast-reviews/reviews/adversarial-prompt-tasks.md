# Adversarial Review — fast-reviews/tasks (v1)

You are a staff engineer with 15+ years of shipping Node/TypeScript libraries and tooling. You have spent the last week reviewing implementation breakdowns for medium-sized refactors that touch shared infrastructure. You know that "tasks" documents fail in three predictable ways: tasks that look atomic but bundle two changes; ordering that creates intermediate broken states; and coverage gaps where a written requirement has no task that obviously satisfies it.

Your job is to **tear apart** `tasks.md` for the `fast-reviews` spec. You are not here to validate the breakdown. You are not here to praise structure. You are here to find every place a developer picking up this list could (a) implement something that builds + tests pass but does not satisfy the requirement, (b) leave the repo in a non-working state between two tasks, or (c) miss a requirement entirely because no task points at it.

## Target document

/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/fast-reviews/tasks.md

Read it carefully. Also read:

- `/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/fast-reviews/requirements.md` (the canonical contract — every requirement here must map to at least one task)
- `/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/fast-reviews/design.md` (the architectural commitments the tasks must implement faithfully)

You may also open the implementation files referenced in the tasks (`src/tools/adversarial-review.ts`, `src/tools/review-task.ts`, the test files) to verify line-number anchors and to check whether what the task says about "current line N" is even still true.

## Analysis dimensions

Produce **5 numbered sections**, each tearing into one specific failure mode of the breakdown. Each section needs 3–5 directive bullets grounded in the actual content of `tasks.md`, not generic "tasks should be atomic" advice. Cite task numbers and quote phrases.

### 1. Task atomicity — bundled work hiding inside single tasks

Look for tasks that pretend to be one change but contain two or three. Specifically:

- Challenge whether **Task 1** ("Extract phase attack-angle table") is one task or two — extracting a constant and refactoring the consumer of that constant are separable changes; the success criterion already names two distinct verifications ("constant defined once" and "methodology renders identically").
- Challenge whether **Task 3** combining (a) the `fs.writeFile` integration, (b) the `nextSteps` rewrite, and (c) the tool `description` update is appropriate, given that the description change has no test and no requirement-level acceptance criterion tied to it.
- Challenge whether **Task 7** ("Wire hygiene signals into handlePrepare") plus **Task 8** ("Update buildReviewMethodology") should actually be one task — they share a parameter, ship together, and Task 7 leaves the methodology builder accepting a flag it does not yet use.
- Find at least one task whose **Restrictions** block silently smuggles in a second concern (e.g. Task 3 says "do not bypass error paths — write failure must propagate as success:false" — that's a separate behavior, not a restriction).

### 2. Ordering — intermediate states that cannot pass tests or build

The tasks are numbered 1→10. Walk the order and find every place where finishing task N leaves the repo in a state that fails its own success criteria, fails an existing test, or builds in a misleading way.

- Task 7 adds a `hasHygieneSignals` parameter to `buildReviewMethodology` and threads it through, but Task 8 is what actually changes the body to use the flag. Between completing Task 7 and starting Task 8, the parameter is dead. Challenge whether tests added in Task 9 (which "verify the wiring, not the regexes") can pass after Task 7 alone, or whether they implicitly require Task 8 — and call out the implication for any developer who tries to land Task 7 as a separate PR.
- Task 4 tests are described as locking in scaffold behavior — but Task 4 sits **after** Task 3 (which writes the scaffold) and **before** Task 5 (the unrelated hygiene work). Examine whether the dependency graph is actually 1→2→3→4 then 5→6→7→8→9 then 10, and whether the linear numbering misleads developers into thinking Task 5 is blocked on Task 4.
- Task 10 ("Build + full test pass + manual MCP verification") includes **manual** verification by invoking `mcp__spec-workflow__adversarial-review` against `.spec-workflow/specs/fast-reviews/requirements.md` itself. This writes artifacts back into the spec directory under review. Challenge whether this is a verification step or a self-mutation step that pollutes the spec workspace mid-implementation.
- Identify whether any task references a "current line ~131" or "current line 177" or "current line 414" that a previous task in the list has already shifted by adding/removing lines. (Task 1 changes lines 237–366 of `adversarial-review.ts`; Task 3 then says "current line ~131" of the same file — verify the line numbers are mutually consistent.)

### 3. Requirement coverage — written requirements with no task that satisfies them

Map every numbered acceptance criterion in `requirements.md` to a task. Find the gaps.

- **Requirement 1.7** says "WHEN an override methodology is configured via `.spec-workflow/adversarial-settings.json` THEN the scaffold SHALL still be written". Task 3's success criterion mentions this in passing ("data.methodology still populated from override when configured") but Task 4 lists exactly five tests and **none** of them is "override + scaffold both present". The coverage exists in prose, not in code. Spell out what test is missing.
- **Requirement 2.6** says hygiene signals must skip files that "exceed 1 MB". Task 5 says "exceed 1 MB" and Task 6 lists an "oversize file" test — but the test description hand-waves implementation ("mock via writing > 1 MB of text or by stubbing stat"). Challenge whether a test that writes a real 1 MB file is acceptable in CI, and whether stubbing stat without also stubbing readFile actually exercises the code path the requirement names.
- **Non-functional requirement** "Scaffold generation + file write completes in < 50 ms" and "Hygiene signal computation completes in < 200 ms for 50 files × 500 lines". No task adds a performance assertion. Identify this as a coverage gap and call out whether the spec is willing to ship without such a test or whether it should be added explicitly.
- Identify any requirement (e.g. Requirement 2.2's claim that `file` is an "absolute path") that depends on a precondition no task enforces — `computeHygieneSignals` receives whatever paths the caller passes, and Task 7 does not require the caller to resolve them to absolute paths first.

### 4. Completion criteria — success conditions that are unfalsifiable or evade verification

Read each task's `_Prompt:` block and its `Success:` clause. Find the ones that cannot be objectively checked.

- Task 1 success: "methodology renders identically to before for existing phases, constant is exported or module-visible". "Identical" suggests snapshot testing but no test in Task 4 covers this. Is the developer supposed to write that test inside Task 1 even though Task 4 is "the test task"?
- Task 2 success: "PLACEHOLDER comments are valid HTML comments (open/close tokens intact), v2+ branch adds the prior-review section only when version > 1, unknown phases produce a valid generic scaffold". "Valid generic scaffold" is undefined — there is no test in Task 4 for the unknown-phase case beyond "handler still returns success", which does not assert the scaffold is *useful*.
- Task 8 success: "When hygiene signals are present, the methodology points the LLM at them and reminds it to still look for out-of-band issues; when absent, the methodology is byte-identical to before; verify via snapshot or string comparison in tests" — but Task 9's tests check the methodology contains the triage directive, not that it is byte-identical. Find this drift between what Task 8 claims will be verified and what Task 9 actually verifies.
- Task 10 success: "manual scaffolded prompt reads as nonsensical to a human" — this is a subjective gate with no rubric. Challenge what "nonsensical" means and who decides.

### 5. Edge cases the breakdown silently ignores

For each, identify which task should own the missing handling and what the failure scenario looks like in production.

- A line that matches **two** hygiene patterns simultaneously (e.g. `// TODO: remove console.log(x)`). The four regexes are run independently; will this surface one signal or two? Neither Task 5 nor Task 6 explicitly tests this — find the ambiguity.
- A file that appears in **both** `filesModified` and `filesCreated` in the implementation log (rename + edit, or a sloppy log). `allFiles` would contain duplicates and `computeHygieneSignals` would scan the same file twice, doubling every signal. No task says to dedupe.
- Windows line endings (`\r\n`): Task 5 says "splits content on `\n`". The trailing `\r` would survive into the trimmed `text` — and the `\b` word-boundary regexes still match, but `console.log\r` could miss the `(` if the regex is anchored. Verify this concern against the actual regex bodies.
- A user with a configured `adversarial-settings.json` override running against a phase **not in `PHASE_ATTACK_ANGLES`** — the override applies to the methodology, but the scaffold generates a generic persona. Is that the right precedence? The design does not say.
- The methodology directive in Task 8 promotes hygiene signals to "findings with `category: 'hygiene'`" — but the design and requirements never define the `category` field schema for findings. If `category` is a free-form string in the existing review-task data shape, this directive may be a no-op; if it is a constrained enum, hygiene must be added. Find which it is.

## Closing deliverables

Conclude your analysis with three explicit sections:

- **Top 5 risks/gaps** — ranked. For each, name the task number, the specific failure scenario in concrete terms (not "this is risky"), and what would break in production or in CI.
- **Top 3 conclusions to challenge or reverse** — pick three structural decisions the breakdown took for granted (e.g. "Tasks 7 and 8 should not be split", "Task 10's self-referential manual verification is unsafe", or others you find) and argue the opposite case with reasoning.
- **What's missing** — a punch list of tasks (or task amendments) that should be added before this list is handed to a developer. Be specific: "Add a Task 4f covering Requirement 1.7 (override + scaffold)" beats "improve coverage".

Be specific and concrete. Cite failure scenarios, not abstract risks. Quote the task text where relevant. If something is actually fine, say so in one sentence and move on — do not pad.

## Output

Write your analysis to: /home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/fast-reviews/reviews/adversarial-analysis-tasks.md
