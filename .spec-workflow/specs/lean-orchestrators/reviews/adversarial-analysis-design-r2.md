# Adversarial Analysis — lean-orchestrators/design (v2), round 2

Primary surface: feasibility, consistency, edge cases.
Fresh lens: the cost of touching an existing component — the tests, fixtures and
callers of every file this design edits or deletes.

## Deltas since v1, re-verified first (required)

The v2 delta touched four places: `listSpawns` (design.md:142), `QueuedTask`
(design.md:151), the sentence that replaced the test-field paragraph (design.md:155),
and the Revision History. All three accepted round-1 fixes land cleanly:

- **R1-1 (cut `testFiles`/`integration`).** `QueuedTask` is now
  `{ id; title; status; files }` (design.md:212). I grepped the whole document for
  `testFiles`, `integration` and `Test (integration)`: the only remaining hit is the
  Revision-History bullet describing the cut (design.md:274). No dangling producer, no
  consumer dangles, no requirement is violated — Req 4.2 asks only for "id, title and
  status" and C5 still returns `files` (the justified part of the closed ruling). Clean.
- **R1-2 (pin `compareSources`).** design.md:215 now pins `data.sources` as
  `SourcesReport` and `data.compareSources` as `SourcesReport | null`, matching C4's
  `data adds sources and compareSources` (design.md:81). Clean.
- **R1-3 (`listSpawns` W source).** design.md:142 now reads "W from the row that sets
  tokens (`src/watch/usage.ts:259-275`), as in C1." I confirmed 259-275 is `reduceSpawn`'s
  loop: line 265 sets `tokens` from "the later digit-string `spawn.end` value; kinds and
  cache from that same row." So `listSpawns` and the `UsageCell` fold now cite the same
  row and cannot diverge on an `unknown` re-fire. Clean.

No fix-induced regression. The three deltas are correct.

## What else I checked and how (fresh lens)

**Files this design edits/deletes, traced to their tests and callers:**

- **`formatUsageTable` gains a W column.** The only callers are `src/tools/harness.ts:1238,1243`
  (the `usage` action, rewritten in C4) and `src/watch/__tests__/usage.test.ts` (12
  `formatUsageTable` assertions, 288-553). No dashboard renderer consumes `UsageReport`/
  `UsageCell`/`UsagePhase` (grep: only `harness.ts` imports them). The design accounts for
  this churn — Testing Strategy says "the W column (update existing table assertions)."
  Fine, no finding.
- **Both `references/briefs.md` deleted.** Six plugin mirrors exist
  (`plugins/*/skills/sdd-*/references/briefs.md`). I confirmed `scripts/sync-plugin-assets.cjs`
  removes files "that no longer exist in `harness/`" and its `--check` mode (Req 8.6) reports
  `stale <path>`, so the mirror deletion is handled by the existing sync. Fine, no finding.
- **`BRIEF_TEMPLATES` → `src/tools/brief-templates.ts` as `Record<string, BriefTemplate>`.**
  This is the expensive touch — see R2-1.
- **Skill step-text rewrite.** The Req 3.6 heading-coverage test (`src/__tests__/skill-split.test.ts`)
  is specified in C8/Testing Strategy and matches the requirement (heading existence, not
  byte-identity, which is all Req 3.6 asks). Fine.

## Findings

### R2-1 — The brief-template refactor under-accounts for the existing `briefAction` test suite (SHOULD_FIX, Novel)

C6 says `BRIEF_TEMPLATES` moves to `src/tools/brief-templates.ts` and changes shape from
`Record<string, string>` (today: six `{{key}}`-placeholder string bodies,
`src/tools/harness.ts:493-557`) to `Record<string, BriefTemplate>` with a `render()`
function and explicit `required`/`optional` arrays (design.md:117). C6 asserts `briefAction`
"keeps its behaviours (unknown kind, all missing values at once, agent-rules line, taskBlock,
graph append, safeJoin write)" (design.md:99). But those behaviours are today implemented *by*
the `{{key}}` scan the refactor removes: missing-value detection is `body.match(/\{\{(\w+)\}\}/g)`
(`src/tools/harness.ts:717`); the agent-rules line is dropped by filtering lines containing
`{{agentRules}}` (`:663`); `redTests` is a `{{key}}` gated by a TDD marker (`:699-711`). Replacing
the body with `render()` + `required[]` reimplements every one of those.

The design accounts for exactly **one** of the 18 brief tests in
`src/tools/__tests__/harness.test.ts` — the drift guard at 491-504 — and mis-describes it:
that test asserts the `briefs.md` "## Code graph block" equals `codeGraphSection()` output, a
two-copies-in-sync check whose *purpose disappears* once `briefs.md` is deleted and the server
is the only source. "Becomes one snapshot test per kind" (design.md:119) conflates it with
per-kind field text it never tested.

Meanwhile the real coverage of the "kept" behaviours lives in tests the design never mentions:

- `redTests` is required when a task carries a `- Test:` seam and omitted otherwise
  (373-402) — the design changes the implementer kind to build the red-tests section from
  `authorFiles`/`authorReport` (design.md:113), so this gate's fate is unstated.
- missing-value reporting names **all** missing keys at once (227) — the "kept" behaviour,
  not covered by a render snapshot.
- the agent-rules line is dropped when `agent-rules.md` is absent (243).
- `graph:none` and graph-absent produce byte-identical files (454-475); the hint line drops
  at `graphBehind 0` (439-452); the `## Code graph` section appends for each of five kinds
  (417-437).

Worse, nearly every kind's **value contract changes**: the C6 table gives `drafter`
`phase, docPath, specDir, specStoreRoot, codeRoot, carried`; `adjudicator` `items, phase,
docPath|taskId`; `verifier` `variant, taskIds, files, round, gateResults, scenario`; `reviser`
`phase, D, docPath, specDir, findings, memoryPath, closedByRuling, variant` — none of which is
today's `{title, job}`/`{title, items}`/`{title, job, findings}`. So the 10+ graph/redTests/
missing-value tests do not merely need re-running; they are invalidated and must be rewritten.
Testing Strategy's replacement — "one snapshot per brief kind, append mode and its missing
target" (design.md:235) — exercises render output but none of the conditional behaviours C6
claims to keep. Failure mode: the tasks phase decomposes C6 as "move templates + snapshot
each," silently dropping the TDD-redTests gate, the all-missing-at-once message and the
none-vs-absent byte-identity, and a later verifier flags a behaviour/test mismatch.
Resolve: state which of the existing brief behaviours/tests are ported (and how they are
tested under `render()`), and drop the "drift guard becomes per-kind snapshot" framing.

### R2-2 — The "no usage line" error branch has no discriminant in the `SpawnSources` union (MUST_FIX, carried, Novel)

Error Handling item 1 (design.md:219) names six conditions that produce `SpawnSources.ok: false`
with a `reason`, printed as `sources unknown (<reason>)`: "No `agentId`, no session, invalid id,
no or unreadable transcript, **no usage line**, or no projects directory." But the `SpawnSources`
`ok: false` union enumerates only five reasons (design.md:210):
`'no-agent-id' | 'no-session' | 'invalid-id' | 'missing' | 'unreadable'`.

"No usage line" is a genuinely distinct branch: the C4 flow runs `readFile` then
`breakdownTranscript` (design.md:81), and `breakdownTranscript` "returns null when the text
holds no assistant line with `message.usage`" (C2, design.md:50) — the file was read and parsed
successfully, so `'unreadable'` is semantically wrong, and no member names this case. The design
pins the branch's status/exit (`ok: false`, counted in the header, `success: true`) but leaves
its discriminant unstated, which is a contradiction between the Error Handling enumeration (six
conditions) and the type (five reasons). Per the error-branch lens this is a MUST_FIX. (Secondary:
"no projects directory" also has no explicit mapping; `'missing'` is plausible but unstated.)
Fix: add a reason member (e.g. `'no-usage'`) and map it, or state explicitly that a null
breakdown folds into an existing reason.

## Top risks/gaps
1. Brief-template refactor silently drops coverage for behaviours C6 says it keeps, and
   mis-describes the one test it names (R2-1).
2. `SpawnSources` union cannot represent the "no usage line" branch the design enumerates (R2-2).
3. (Checked, fine) W-column churn in `usage.test.ts` is accounted for ("update existing table
   assertions"); no external `UsageReport` consumer breaks.
4. (Checked, fine) `briefs.md` plugin mirrors are removed by the existing
   `sync-plugin-assets.cjs` deletion path, flagged by `check:plugin-assets` (Req 8.6).
5. (Checked, fine) All three v2 deltas land cleanly; no fix-induced regression.

## Top 3 conclusions to challenge
1. **"`briefAction` keeps its behaviours" (C6, design.md:99).** Challenged: the behaviours are
   implemented by the `{{key}}` scan the refactor deletes, and the Testing Strategy does not
   re-test them. The claim is true only if the design says how each is re-tested under
   `render()` — it does not (R2-1).
2. **"the drift-guard test becomes one snapshot test per kind" (C6, design.md:119).**
   Challenged: that test checks `codeGraphSection` parity, not per-kind text; its purpose
   vanishes with `briefs.md`. Reverse to: delete the drift guard, and separately specify the
   per-kind snapshot and the ported behaviour tests (R2-1).
3. **The `SpawnSources` five-reason union is complete.** Challenged and reversed: Error
   Handling names a sixth branch with no member (R2-2).

## What's missing before acting
- A statement of which existing `briefAction` behaviour tests (redTests TDD gate, all-missing
  message, agent-rules drop, graph none/absent byte-identity, graph-behind-0, per-kind graph
  append) are ported, and how they are tested when templates become `render()` objects (R2-1).
- A `reason` member for the "no usage line" branch, or an explicit fold into an existing one
  (R2-2).

VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 1
MINOR: 0
DESIGN_READY: no
ESCALATE: none
