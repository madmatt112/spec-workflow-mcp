# Adversarial Analysis — advisor/requirements (v1), round 1

## Scope and method

First review. Read the decomposition entry 25, ADR 0006 (amended 2026-10-26), design §16/§17,
and `codebase-context.md`, then read both ends of every artifact the document cites. Primary
surface: completeness, ambiguity, scope. Fresh lens: **wire contracts across a boundary**
(router, query params, response shapes, client state).

## Delta since the v1 checkpoint (954f0d03) — attacked first

The only change is the lint pass adding `RunStatus, src/controller/state.ts:56-64` to
Requirement 2 AC 1, plus a Revision History line. Verified: `state.ts:56-64` is exactly the
`RunStatus` union and it contains both `'running'` and `'error'`, the two values AC 1's
"stuck runs" clause names. The delta is accurate and clean.

## Citation audit — clean

Every cited artifact was read at both ends of its range and matches the document:
`sddHome` (state-files.ts:26-29), `PrRead` (state.ts:104-128), `WaitRecord.advice?:string`
(state.ts:162-178), `writeJsonAtomic` (state.ts:297-303), `withStoreLock` (state.ts:535-546),
`StepClassification` (step.ts:71-77), `runStep` (step.ts:350), `waitEvents` (waits.ts:61),
`attachAdvice` touches no run (waits.ts:118-126), `enqueue` admission (controller.ts:145-179),
`onWaitChange` ignores advice-only changes (controller.ts:339-362), `mergeByRule` — and its
rule genuinely checks green/mergeable AND the no-attribution trailer via `ATTRIBUTION_PATTERNS`
(merge.ts:252-255, 444-455, 695-778), the `merge: ask` branch (merge.ts:729-753),
`loadOrCreateSecret`/`makeRequireAccess` (access.ts:40-67, 156-180), deferral `owner`
(deferral-storage.ts:150-152), the one-bad-project rule (now-model.ts:1-8), the advice render
(NowPage.tsx:529-539), subcommand routing (index.ts:129-131, 394-398), the watchdog's
separate-process wait (sdd-watchdog.sh:185-201), the drafter tier (agent-profiles.json:14-19),
the deploy (sdd-self-update.sh:1-24). The external claim `claude --remote-control [name]` is
real on 2.1.311 (confirmed via `claude --help`). **No MUST_FIX from a misstated artifact.**

Scope matches decomposition entry 25 and design §16: no scope creep found. The deferred
"watch X" one-shot and the cut transcript/notebook indexing all track the ADR.

## Findings

### R1-1 — SHOULD_FIX (Novel) — two-credential auth contract cited against a single-secret hook

Req 6 AC 4 and Req 7 AC 2, D2, and the Security NFR require **two** credentials with
**different route scopes**: the advisor credential reads and stages but is refused 401 at the
confirm route, and only the operator's browser session confirms. But the cited mechanism is
single-secret with no scope: `isAuthorized(request, secret)` (access.ts:129-137) validates one
`secret`; `makeRequireAccess` (access.ts:156-180) gates every route against that one secret;
`loadOrCreateSecret` (access.ts:40-67) creates one secret file; and design §17 — cited for
alignment — states "There is no second user and no roles." Req 7 AC 2 says the endpoint "SHALL
sit under the access hook (`makeRequireAccess`)" as if no new auth logic is needed, which is in
tension with Req 6 AC 4's per-route credential refusal.

Failure scenario: an implementer wires the advisor MCP endpoint under `makeRequireAccess` with
the only secret the hook knows — the operator secret — so the advisor session holds the operator
secret and the confirm route accepts it. The staged-action guard collapses and a planted source
instruction that stages a merge can be confirmed by the advisor's own credential: the exact hole
D2 exists to close. Fix: state that the access layer gains a second credential and per-route
scope (confirm and login routes reject the advisor credential; the advisor endpoint accepts it),
and note that §17's "no roles" is superseded for the advisor.

### R1-2 — SHOULD_FIX (Novel) — typed second-opinion picks not threaded across the wait boundary

Req 5 AC 2 (D5) makes the second opinion a typed result (per-question pick id + pick + ≤60-word
reason, plus a ≤100-word summary) that attaches to the wait and renders next to each question.
That result must cross four sites that today all carry `advice?: string`: the controller record
(state.ts:176), the server wire (shell/types.ts:151), the browser wire
(dashboard_frontend/types.ts:172), and the render (NowPage.tsx:534, a plain text `DetailText`);
and `attachAdvice(id, advice: string)` (waits.ts:119) takes a string. The document names none of
these new-field changes. AC 8 ("a pre-spec string `advice` SHALL still render") implies the typed
picks are a new field beside `advice`, but that is never stated.

Failure scenario: an implementer adds typed picks to the controller record and server wire but
not the browser wire type or the NowPage render, so the dashboard answer sheet shows nothing (or
only legacy text) for a new second opinion. End-to-end check 2 passes on the attach while AC 2's
"show the picks next to each question" is silently unmet. Fix: name the new field and require it
at the record, both wire types, `attachAdvice`'s signature, and the render.

### R1-3 — SHOULD_FIX (Novel) — "the home event log" is an undefined sink with a conflicting write mechanism

Req 5 AC 6 (`advisor.opinion`), Req 6 AC 5 (`advisor.action`) and Req 10 AC 5 (push-failure)
each write a row to "the home event log," but no requirement defines it: no path in the home, no
row schema, no `v: 1`, and it is absent from the Reliability NFR's enumerated new-home-records
list (staged action, pushed-id list, search-index metadata, sources, push config). No such log
exists in code today — the per-run `harness-events.jsonl` lives in `/tmp` scratch, not the home.
It is an append log written by the controller (and push failures may originate from separate
processes), yet the only cited write helper is whole-file `writeJsonAtomic` (state.ts:297-303),
which rewrites the entire file and cannot append safely across concurrent writers.

Failure scenario: three ACs claim a durable audit trail, but with no defined append-safe sink an
implementer either invents an ad-hoc format or funnels `advisor.action` through `writeJsonAtomic`
and races/overwrites concurrent rows — losing the audit record the staged-action guard depends on.
Fix: define the home event log as a home record (path, JSONL row schema with `v: 1`, append
semantics) and add it to the Reliability list.

## Top 5 risks/gaps

1. R1-1 — the staged-action security guard rests on a credential separation the cited access
   layer cannot express (single secret, "no roles").
2. R1-2 — the typed second-opinion result is not required across all four boundary sites, so the
   dashboard can silently fail to show picks.
3. R1-3 — the `advisor.opinion`/`advisor.action`/push-failure audit log is undefined and its one
   cited write helper cannot append.
4. Req 5 AC 5 / D9 refuse a second opinion "above the controller's threshold," but no usage
   threshold is defined or cited; and Req 2 AC 1's "two usage windows" are never named. (MINOR —
   a value safely left to design/config.)
5. Req 10 AC 1+AC 2 require a push for cross-process waits where `waitEvents` never fires, but
   name no detection trigger; well-specified at requirements altitude, design must pick a
   controller-side non-`waitEvents` trigger that does not reintroduce polling. (MINOR.)

## Top 3 conclusions to challenge

1. "The endpoint SHALL sit under the access hook (`makeRequireAccess`)" (Req 7 AC 2) reads as
   "reuse the existing gate." Reverse it: the gate must be extended to a second credential with
   per-route scope, or the whole D2 guard is unenforceable. State the extension.
2. "SHALL attach its typed result to the wait" (Req 5 AC 1) assumes the `advice` channel already
   carries structure. It carries a `string` at every hop. The typed shape is a new cross-boundary
   contract and should be specified as one.
3. "write one `advisor.action` row to the home event log" (Req 6 AC 5) assumes a home event log
   exists. It does not. Define it before any AC writes to it.

## What's missing before acting on this document

- A definition of the advisor credential's provenance and the per-route scope map (which routes
  accept it, which refuse it), and an explicit note that §17 "no roles" is superseded.
- The new wait field for typed picks, named and threaded through record → both wire types →
  `attachAdvice` → render.
- The home event log as a first-class home record (path, schema, append semantics) in the
  Reliability NFR list.
- The usage threshold Req 5 AC 5 refuses against, and the names of the "two usage windows."

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 3
MINOR: 2
DESIGN_READY: no
ESCALATE: none
```
