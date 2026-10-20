# Adversarial Analysis — project-bootstrap/design (v1), Round 1

First review. Delta since the `docs(sdd): project-bootstrap design v1` checkpoint is tiny
(the line-20 citation widened `378-384` → `374-387`, plus the lint-pass Revision History
entry). I re-verified the delta first — `src/index.ts:374` is `async function main()` and
`:387` is `const cliArgs = parseArguments(args)`, so both anchors resolve; the lint
rejections are reasoned and about new-by-construction identifiers. Nothing to attack in the
delta. I then reviewed the whole document against the decomposition entry and read every
cited artifact at both ends of each range.

**Citation audit: clean.** Every path, range, signature and behaviour the document cites
verifies against the tree under the worktree — `src/index.ts` (22-118, 120-125, 143-156,
374-387, 400-406), `git-utils.ts` (45-51, 101-112, 152-158, 194-205, 214-252),
`dashboard-session.ts` (21-24, 50-51, 122-138), `multi-server.ts` (356, 420-445, 453-464),
`project-manager.ts` (77-92, 161-169, 240-249, 261-282, 318-343), `project-registry.ts`
(118-123, 354-393), `state.ts` (206-216, 425-441), `access.ts` (25-28, 36-67, 156-180),
`merge.ts` (47-50, 150-172), `run-setup.ts` (68-137, 94-96, 95-106), `gate-rules.ts`
(125-139), `workspace-initializer.ts` (52-57, 69), `utils.ts` (71-73),
`copy-static.cjs` (46-53), `sync-store-templates.cjs` (34-37), `sdd-service.sh` (33,
136-147), `docs/SDD-HARNESS.md` (252-270, 312-331), and the test anchors
(`index-args.test.ts` 9-17/391-396, `workspace-roots.test.ts` 514-517). No misstated
artifact → no citation-based MUST_FIX.

**Scope check against decomposition entry 24: in scope.** init writes `.mcp.json` →
`dist/index.js`, renders `agent-rules.md` with detected facts, registers via the controller,
prints what it wrote; doctor checks each plus remote and token and names the first failure;
both deterministic, no model. Dropped items (`/sdd-init` judgement half, `uninstall`, store
placements beyond in-repo/separate, `.gitignore`, init-manifest) match the re-plan. The three
out-of-`src/bootstrap/` changes (C7 route field, C8 export, C9 peek) are declared and
justified (C7 closes the "design SHALL close both gaps" of Req 5 AC 4).

---

## Topics attacked

### 1. C4 `token` check — error classification (Checks §7, Error Handling §4)

- **Challenge the claim** in Error Handling §4 that "A missing `gh` binary is reported as
  `gh exited ENOENT`, not a crash." The design enumerates the four reason strings
  (`gh exited <code>`, `gh timed out`, `unreadable gh output`, `no push permission`) but
  never states *how* `runChecks` tells them apart: which `child_process` error fields it
  reads. agent-rules.md requires exactly this ("a test that asserts on `child_process`…
  behaviour asserts only on fields the node 20 docs guarantee, and the design says which").
- **Stress-test** the interaction with the in-tree pattern the context file points at as
  "the execFile wrapper with timeout" (`src/controller/merge.ts:150-172`). `runCommand`
  classifies with `code: typeof e.code === 'number' ? e.code : (e ? null : 0)` and
  `timedOut: e.killed === true`. For a *missing binary*, `execFile`'s error carries the
  **string** `error.code === 'ENOENT'`, which `typeof e.code === 'number'` discards → `code`
  becomes `null`. An implementer who copies that pattern prints `gh exited null`, directly
  contradicting §4's promised `gh exited ENOENT`.
- **Attack the alternative path:** if instead the implementer `await`s a promisified
  `execFile` without a dedicated ENOENT catch, the ENOENT throw bubbles to C2's top-level
  handler (`error: <message>`, exit 1 — the generic crash path) rather than appearing as a
  `fail token` line inside the normal seven-line doctor output. §4 says this must not happen.
- The timeout reason (`gh timed out`) likewise depends on `error.killed`/`error.signal`,
  which the design does not name.

**→ F1 (SHOULD_FIX).** The crux of four of the token check's reasons is unspecified, and the
obvious in-tree implementation (`runCommand`) contradicts §4's ENOENT promise. Fix: reuse or
cite `runCommand`, and pin the fields — `error.killed` (timeout), `error.code` read directly
so the string `'ENOENT'` survives, `error.code` numeric for a non-zero exit — stating they are
node-20-guaranteed. Failure scenario: `doctor` on a host without `gh` (or a bad
`CONTROLLER_GH_BIN`) prints `gh exited null` or crashes with `error: spawn gh ENOENT`,
instead of `fail token: gh exited ENOENT — fix: …`.

### 2. Data Models — the `POST /api/projects/add` response set

- **Challenge the completeness** of the Data Models block: it pins `200` and `400` only.
  C7/D3 newly route a failed `rememberProject` write to **500** ("a failed write rejects and
  the route answers 500"). This round's error-branch directive requires every named error
  branch to pin its discriminant and status code in the design; the 500 branch is named in
  C7 prose but its body shape is absent from the Data Models section, the designated place
  for response shapes.
- The 500 is not merely the pre-existing catch: the design adds a *new* trigger for it by
  awaiting `rememberProject` inside `addProjectByPath` (gap 1). Its shape is the base
  `{ error: error.message }` (`multi-server.ts:462`), but the design never says so.

**→ F2 (SHOULD_FIX).** Add `500: { error: string }  (new trigger: failed durable write)` to
the Data Models block so the branch is pinned before tasks. Failure scenario: a
`projects.json` write fails under a full disk; the route returns 500 and the tasks phase has
no pinned shape for the init exit-2 mapping to assert against.

### 3. C3/C4 — `agent-rules.md` location term ("storeDir")

- **Stress-test** the term `readAgentRules(storeDir)` in C4 check 3 against the reader's
  contract. `readAgentRules(workflowRoot)` reads `join(workflowRoot, 'agent-rules.md')`
  (`run-setup.ts:69`), and Req 4 AC 2 puts the file at `<storeRoot>/.spec-workflow/agent-rules.md`.
  So the argument must be the `.spec-workflow` directory, not the store root. The document
  uses "store root" (check 2) and "storeDir"/"the store's agent-rules.md" (check 3)
  interchangeably; an implementer who passes the store root reads a non-existent
  `<storeRoot>/agent-rules.md` and the check fails on a correctly-initialised repo.
- Fine otherwise: the merge-method double-read via `parseAgentRuleKey` is justified —
  `readAgentRules` silently defaults an invalid value to `merge` (`run-setup.ts:94-96`), so
  the raw-key read is the only way to catch a bad value. Column-0 anchoring is real
  (`^…/m` at `run-setup.ts:95-106`).

**→ F4 (MINOR).** Terminology only; the correct path is derivable from the reader's contract.
Name the `.spec-workflow` directory explicitly in C3 (write) and C4 (read).

### 4. C4 `doctor` — default timeout vs the Performance NFR

- **Challenge** the unstated default. C3 pins init's `timeoutMs` default to 10000, but
  `runDoctor`/`runChecks` leave `timeoutMs?` without a default. The Performance NFR pins each
  network call (health, `gh`) to 10 s and the whole run to 30 s; C4 asserts "two network
  calls of at most `timeoutMs` each … inside 30 seconds" but never says `timeoutMs` defaults
  to 10000 when no caller supplies it.

**→ F3 (MINOR).** State `runDoctor`'s default `timeoutMs` = 10000 so the NFR holds without a
caller. Value is otherwise derivable from the NFR.

### 5. C3 phase 2 — `(was: …)` on a malformed-but-object prior entry

- **Attack the edge case:** phase 1 step 3 validates only that `mcpServers` (when present) is
  an object; it does not validate the `mcpServers['spec-workflow']` sub-value. A prior entry
  that is an object lacking `command`/`args`, or a string/number, still reaches the deep
  compare in phase 2 step 2 and yields `(was: undefined undefined)`. Cosmetic; no write
  corruption (the entry is overwritten regardless).

**→ noted (MINOR, not counted).** Harmless; mention if convenient.

### 6. Things that are actually fine (checked, moving on)

- **D2 + C7 + the `registered` check cohere.** init always sends `workflowRootPath` (D2);
  C7's present-branch awaits `rememberProject` directly, bypassing `addProject`'s equality
  rule (`project-manager.ts:240-249`) that would otherwise drop a separate-store project;
  both ends canonicalise with realpath (D9), and `gitTopLevel`/`generateProjectId` both
  realpath-normalise, so `projects.json.workspacePath`/`workflowRootPath` match doctor's
  recomputed `top`/`storeRoot`. The in-repo case stores `workflowRootPath = top`, so
  `registered` passes without `--store` too.
- **D12 migration is safe.** `removeProject` (`project-manager.ts:261-282`) does *not* call
  `forgetProject`, so the remove-and-re-add rebuild cannot forget the entry before the
  explicit `rememberProject` re-writes it; `registerProjectLocked` updates `workflowRootPath`
  in place under the same id (`project-registry.ts:374-375`); `rememberProject` replaces by
  id → one entry (Req 5 AC 5).
- **C9 peek is correctly motivated.** `getDashboardSession` mkdirs
  (`dashboard-session.ts:51`) and unlinks a dead-pid file (`:130-137`); Req 7 AC 6 forbids
  both, so `peekDashboardSession` reads with no mkdir/unlink. The `controller` check reaches
  the open health route (`access.ts:165` exempts `GET /api/health`). The secret is required
  on `POST /api/projects/add` (`access.ts:173-174`).
- **The partial-mock rationale (D1) holds.** `index-args.test.ts:9-17` declares only the
  git-utils exports index.ts imports; the dynamic import keeps bootstrap (and its wider
  git-utils use) out of that static graph. `showHelp` assertions (`:391-396`) are
  `toContain`/`not.toContain('--no-open')`; the `SUBCOMMANDS:` block adds no asserted value.
- **The new template is not auto-copied.** `WorkspaceInitializer` copies a fixed list
  (`workspace-initializer.ts:52-57`); `sync-store-templates.cjs:34-37` iterates store names,
  so a store without `agent-rules-template.md` never receives it.

---

## Closing deliverables

### Top risks/gaps (3)

1. **Token-check error classification is unspecified and its stated ENOENT behaviour
   conflicts with the in-tree `execFile` pattern** (F1, SHOULD_FIX) — §2 topic 1.
2. **Data Models omits the 500 branch the design newly triggers** (F2, SHOULD_FIX) — §2
   topic 2.
3. **`doctor` default timeout unstated against a hard NFR; `agent-rules.md` read path term
   ambiguous** (F3/F4, MINOR) — topics 3–4.

### Top 3 conclusions to challenge or reverse

1. **"A missing `gh` binary is reported as `gh exited ENOENT`" (Error Handling §4).** Not
   guaranteed by any implementation the design describes; the in-tree `runCommand` pattern
   would print `gh exited null`. Either pin the direct `error.code` read or rewrite §4 to the
   reason the chosen mechanism actually produces.
2. **"All code samples are illustrative … The post-conditions are binding" (Components
   intro), applied to the token check.** The binding post-conditions (reason strings) depend
   on non-illustrative `child_process` field reads that are nowhere stated — the illustrative
   disclaimer cannot carry the ENOENT/timeout distinction to tasks.
3. **Data Models is complete.** It is not: it enumerates 200/400 and silently assumes the 500
   is "as at base," though C7 adds a new path into it.

### What's missing before acting on this document

- Pin the token check's `child_process` classification (reuse/cite `runCommand`; name
  `error.killed`, direct `error.code`, numeric exit) as node-20-guaranteed fields.
- Add the `500: { error: string }` row (failed durable write) to Data Models.
- State `runDoctor`'s default `timeoutMs` (= 10000) and name the `.spec-workflow` directory as
  the `readAgentRules` argument in C3/C4.

---

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 2
MINOR: 2
DESIGN_READY: no
ESCALATE: none
```
