# Adversarial Analysis — advisor/design (v1, Round 1)

First review. Attacked the deltas (v1 lint pass: 0 fixed, 65 citation-identifier
rejections — spot-checked ~10 of the rejection buckets against the tree, all sound)
and then the whole document against the decomposition entry (spec 25) and the real
codebase. Verified ~40 code citations end-to-end; library-capability claims probed
against the installed tree.

## What I verified clean (so the loop is not kept alive on noise)

- **Library-capability claims (C3, C10) all hold against the installed versions.**
  `@modelcontextprotocol/sdk` is 1.27.1 and `fastify` 5.8.1 — exactly what C3 cites.
  `StreamableHTTPServerTransport` with `sessionIdGenerator: undefined` and
  `transport.handleRequest(req, res, req.body)` is the SDK's own documented stateless
  pattern (streamableHttp.d.ts:33-43,107); `reply.hijack()` is a real FastifyReply
  method (types/reply.d.ts:62). `claude --version` is 2.1.311 and `--settings`, `-n`,
  `--remote-control [name]`, `--session-id`, `--append-system-prompt-file`,
  `--mcp-config`, `--strict-mcp-config` are all in its `--help`.
- **Error-branch shapes (retro P3) are pinned.** Every race loser names a status +
  discriminant: second opinion 404/409 `not-open`/409 `running`/409 `usage-window`
  (C7); staged action 409 "not `staged`" (C8). The store-escape case is an MCP tool
  error (no HTTP status applies). No unpinned race loser carried into tasks.
- **StepUsage mapping (C7 ↔ Data Models) is exact.** The `advisor.opinion` row's five
  fields (input, output, cacheRead, cacheWrite5m, cacheWrite1h) match `StepUsage`
  (ledger.ts:34-40).
- **Tally inputs are grounded.** `spawn.end` rows carry a top-level `spec` (ledger.ts
  write() prefix, line 101) and `agent`; retro findings really are `- **F…` lines
  under `##` headings (verified lean-orchestrators/retrospective.md); document.ts:375
  writes `result.subtype ?? 'ok'`, so D14's "counts as unknown" is sound.
- **Access model (C2) is consistent.** `isAuthorized` (129-137), login (194-203) and
  the loopback exemption (166-171, defeated by `/api/controller/`) are all cited
  correctly; the advisor-secret-is-no-credential-elsewhere claim holds.

## Topics attacked

### 1. C7 — "the threshold is the controller's (`controller.ts:85-86`)"

- **Challenge the line range.** `controller.ts:85-86` is `this.opts = opts;` and
  `this.slots = opts.slots ?? …`. The window threshold is assigned at **87-88**
  (`this.windowThreshold = opts.windowThreshold ?? …`) and read in `windowBlock` at
  line 385. The cited lines contain no threshold. → **R1-1**.
- **Stress-test the companion citation.** C7 cites `windowBlock` as 373-388; the method
  is 375-390 (373 is the section comment, 389-390 is the `return { blocked, resumeAt }`
  the range drops). Fold the correction into R1-1.
- Everything else in C7 (`usageBlock()` returning the `{ blocked; resumeAt? }` shape,
  `runStep` at 350, strict mcp-config at 372-374, Controller.active/no-slot) checks out.

### 2. Data Models — the three central read-tool responses are not pinned

- **Challenge the completeness claim.** Req 7 AC 1 and Reqs 2/3/4 reference `summary`,
  `tallies` and `search` as tool responses. Data Models (104-130) pins WaitOpinion,
  StagedAction, SourcesFile, PushConfig, PushedFile, AdvisorSession and HomeEvent —
  but **not** `AdvisorSummary`, `Tallies` or the search `Hit`. They live only as prose
  in C4/C5/C6.
- **Stress-test `Tallies` specifically.** Req 3 AC 3 ⇒ "label the column a floor"; C5
  ⇒ "that column carries `floor: true`". But the `Tallies` return structure is never
  given: what a bucket/row/column is, whether it is keyed `week → {role→tokens,
  spec→tokens, classification→count, category→count}`, and where `floor: true` hangs.
  An implementer cannot write the tool's output or its test fake from this. → **R1-2**.
- **Stress-test the `Hit`.** C6 lists hit fields in prose (project, path, startLine,
  endLine, kind, date) but omits score/`meaning` fields the fusion and the
  text-only/indexing fallbacks clearly produce; pin the full shape.
- `WaitOpinion` and `StagedAction`, the two requirement-referenced objects that *are*
  pinned, are correct and complete — so the gap is specifically the code-built
  state-of-the-world trio.

### 3. C8 — the no-run merge executor's `mergeByRule` call

- **Challenge the argument list.** `mergeByRule(target: MergeTarget, deps)`
  (merge.ts:695) needs a full `MergeTarget` (merge.ts:542-551): `pr`, `runId`,
  `projectId`, `spec`, `questionId`, `label`. C8 supplies `pr`, `runId` and `merge:
  'auto'` only; `questionId`, `label`, `spec`, `projectId` are unstated. With
  `merge: 'auto'` the ask-branch (729-753) is skipped, so these feed only
  `PrRead.kind` (`questionId === MERGE_QUESTION_ID`) and the reasons text — cosmetic,
  not a correctness hole, which is why this is a note not a blocker.
- **Stress-test the `ledger` dep.** `MergeStageDeps.ledger` is required and
  `mergeByRule` calls `prMerged`/`note`/reads `path`. C8 says deps are "rooted at
  `advisor/actions/id/`" but never says a synthetic `openRunLedger` backs it; that
  ledger's `prMerged` row then lands outside any `specs/*/harness-events.jsonl`, so the
  merge is invisible to tallies. Implementable but under-told.
- The D7 path (a run's PR under `ask` → `answerWait('merge')`) and the merge-rule
  citations (695-778, 729-753, 136-150, 160-163) are all accurate.

## Top risks / gaps

1. **R1-1 (MUST_FIX, Novel).** `controller.ts:85-86` miscited for the usage-window
   threshold (it is 87-88); `windowBlock` range 373-388 should be 375-390. Wrong line
   range on a load-bearing reuse claim.
2. **R1-2 (SHOULD_FIX, Novel).** `AdvisorSummary`, `Tallies` and search `Hit` — the
   three read-tool responses Reqs 2/3/4/7 reference — are not pinned in Data Models;
   `Tallies` in particular has no structure for the `floor: true` column Req 3 AC 3
   mandates. Rework/divergent test-fake risk.
3. **No-run merge executor (MINOR, Novel).** C8 omits the required `MergeTarget` fields
   and the synthetic `ledger` backing `MergeStageDeps`; cosmetic under `auto` but will
   be guessed at in tasks.
4. **mcp.json `headers` probe (MINOR, Novel).** C10 asserts "the `headers` key is
   probed" but cites no probe and the scope-note probe list omits it (lists only Ollama
   shape and Bash deny-rule form). The capability is real for Claude Code http servers;
   either cite it or add it to the task-phase probe list.
5. **Second-opinion rate-limit feedback (MINOR, Novel).** The opinion `runStep` is not
   scheduled through the controller and C7 does not wire `onRateLimit`; its token spend
   never updates `rate-limit.json`, so a window the opinion itself pushes over is unseen
   until the next scheduled step. Accept-and-note is fine, but say so.

## Top 3 conclusions to challenge or reverse

1. **"the threshold is the controller's (`85-86`)"** — reverse the citation to 87-88.
   As written a verifier lands on `this.opts`/`this.slots` and the reuse claim looks
   unsupported.
2. **"Data Models — Illustrative — verify against the test fake."** — this licence does
   not cover the three *response* objects a requirement names. Pin `AdvisorSummary`,
   `Tallies`, `Hit` (or at minimum the `Tallies` floor/column shape) before tasks, or
   the test fake becomes the de-facto spec.
3. **C8 deploy "from the package root"** — not a defect given the checkout-runtime
   model (scripts/ ships only in the checkout, not the npm `files` set), but the design
   should say "the checkout root" so a reader does not expect `scripts/` in an installed
   package. Verify, keep, reword.

## What's missing before acting on this document

- Fix R1-1 and pin the `Tallies` shape (R1-2) — both are prerequisites for the tasks
  phase to write `tallies.ts`/`summary.ts` and their fakes.
- Name the `Tallies` return type and the `Hit` type in Data Models (or state the exact
  fields the test fake asserts).
- Decide and record: is the mcp.json `headers` key a design-closed probe or a
  task-phase probe? Add it to the scope note either way.
- One line on the no-run merge's `MergeTarget`/synthetic-ledger so tasks do not guess.

## Verdict block

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 1
MINOR: 3
DESIGN_READY: no
ESCALATE: none
```

`converged` requires MUST_FIX = 0 and SHOULD_FIX = 0; R1-1 (MUST) and R1-2 (SHOULD)
keep it open.
