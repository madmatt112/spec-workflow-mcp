# Adversarial Analysis — advisor/requirements (v2), round 2

## Scope and method

Second review. Read the rolling memory, the round-1 analysis, `codebase-context.md`,
ADR 0006 and design §16/§17, then attacked the v1→v2 delta first (the three accepted
round-1 fixes), re-reading both ends of every artifact the delta re-cites. Primary
surface: completeness, ambiguity, scope. Fresh lens for this round: none (per prompt);
applied a data-lifecycle/failure-mode spot-check the round-1 memory flagged.

## Delta since v1 (d9747dca) — attacked first

The v2 delta is: Introduction/Alignment wording tightened; D1–D13 condensed; one
duplicate Scope note removed; and the three round-1 fixes — Req 7 AC 2 (R1-1), Req 5
AC 2 (R1-2), Reliability home event log (R1-3). All three are the correct resolution of
the unresolved round-1 findings, and every artifact the delta re-cites was read at both
ends and matches.

### R1-1 fix — Req 7 AC 2, two-credential per-route scope — RESOLVED, accurate

The AC now says the hook is "extended with a second credential … the advisor
credential, distinct from the operator secret (`loadOrCreateSecret`,
`src/controller/access.ts:40-67`)" with per-route scope, and that the endpoint "SHALL
sit under `/api/controller/` so a loopback read still needs the credential."

Verified against `src/controller/access.ts`:
- `makeRequireAccess` spans 156-180 ✓; `loadOrCreateSecret` spans 40-67 ✓.
- The cited loopback exemption is real: line 171 `if (isRead && !underController &&
  isLoopback(request.ip)) return;`, with `underController` computed at line 168. The
  range 166-171 contains both; accurate (if slightly broad — 166 is the adjacent
  non-API-read exemption).
- The fix is mechanically correct: for a path under `/api/controller/`,
  `underController` is true, so line 171's `!underController` guard is false, the
  exemption is skipped, and control falls to line 174 `if (isAuthorized(request,
  secret)) return;` — a loopback read of the advisor endpoint therefore requires the
  credential. The hole the round-1 memory flagged is closed.
- `/api/login`/`/api/logout` are exempt from the hook (line 164) and login compares the
  body `{ secret }` only against the operator secret (lines 197-203), so the advisor
  credential naturally 401s at login — consistent with the AC's "the login route
  refuses it."

§17's "no roles" is explicitly superseded for the advisor; the extension is stated at
the right altitude (contract, not mechanism). No defect introduced.

### R1-2 fix — Req 5 AC 2, typed `opinion` field — RESOLVED, accurate

The AC now names a new wait field `opinion` beside the legacy `advice` string and
threads it through every boundary site. Verified:
- `WaitRecord` is `src/controller/state.ts:162-178`, `advice?: string` at line 176 ✓.
- `attachAdvice(id: string, advice: string)` at `src/controller/waits.ts:118-126` — the
  signature genuinely takes a `string` today ✓.
- Server wire `advice?: string` at `src/dashboard/shell/types.ts:151` ✓; browser wire
  `advice?: string` at `src/dashboard_frontend/src/modules/shell/types.ts:172` ✓.
- Render `NowPage.tsx:534` is `<DetailText heading={'Advice'} body={wait.advice} />` —
  plain text, as the AC states ✓.

Consistent with AC 7 (failure keeps earlier advice) and AC 8 (pre-spec string `advice`
still renders). No defect introduced.

### R1-3 fix — Reliability home event log — RESOLVED, accurate

The event log is now `events.jsonl` in the home: JSONL, each row `v: 1` + time + `type`
(`advisor.opinion`, `advisor.action`, `push.failure`), appended one line at a time, not
through `writeJsonAtomic`. Verified `writeJsonAtomic` at `state.ts:297-303` is temp-file
+ rename — it rewrites the whole file and truly cannot append across processes, so the
AC's reasoning is correct. The three writing criteria (Req 5 AC 6, Req 6 AC 5, Req 10
AC 5) and the row types line up exactly. The second Reliability bullet's atomic-record
list correctly excludes the event log (handled by the first bullet) — no contradiction.

## Spot-checks on the fresh lens (data lifecycle / failure modes) — no new finding

- **Credential provenance / injection.** The advisor credential's creation and how the
  session obtains it are not spelled out mechanically, but the Security NFR requires it
  to exist (0600 in the home, cited to `loadOrCreateSecret`) and Req 6 AC 4 states "the
  credential the advisor session holds." Existence and possession are required; the
  create/inject mechanism is design altitude. Not a requirements gap.
- **Confirm route.** Referenced by Req 6 AC 3/4/7 and Req 7 AC 2 but never defined as
  its own AC. Its behaviour (operator-session only, refuses the advisor credential) is
  fully pinned by Req 6 AC 4 + Req 7 AC 2, and it is deliberately absent from the Req 7
  AC 1 advisor-tool list because the advisor must not confirm. Adequately covered.
- **Event-log append atomicity** (O_APPEND / per-line size bound for cross-process
  safety) is a design/config choice, same class the orchestrator already ruled out of
  requirements altitude in v2. Not re-raised.
- Usage threshold and the "two usage windows" names: rejected in v2 (Revision History);
  not re-raised.

## Findings

None. The delta is a clean, faithful resolution of all three round-1 SHOULD_FIX
findings; every re-cited artifact matches the code at both ends; no new contradiction,
false claim, or unimplementable requirement was introduced.

## Top risks/gaps

None open. The three round-1 risks (credential scope, typed-pick threading, undefined
event log) are each resolved by the v2 delta and verified against the code.

## What's missing before acting on this document

Nothing at requirements altitude. The remaining open items (advisor-credential
create/inject mechanism, the confirm route's concrete path, event-log O_APPEND/line-size
bound, the usage threshold value and window names) are all design-phase decisions and
are correctly left out here.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 0
DESIGN_READY: yes
ESCALATE: none
```
