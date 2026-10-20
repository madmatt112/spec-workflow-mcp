# Adversarial Analysis — project-bootstrap/requirements (v2, round 2)

Primary surface: completeness, ambiguity, scope. Deltas attacked first (the three R1 fixes),
then one fresh lens: does the resolved controller URL the fixes rely on actually carry the
value they assume.

## What I checked and how

Read the v2 Revision History and the `## Changes since 23c669d` diff first. The v2 delta
touched exactly four ACs: Req 3 AC 3 + AC 5 (R1-1), Req 5 AC 2 (R1-2), Req 6 AC 3 (R1-3).
I re-verified the one new citation the delta added (`src/index.ts:39-42`, the `--host`
help — accurate) and traced the mechanism the R1-2 fix depends on to ground truth in the
review worktree tree:
- `src/dashboard/multi-server.ts:346-360` — the dashboard binds `host: this.bindAddress`
  (the `--host` value) at `:349`, but writes the session URL as a hardcoded
  `http://localhost:${this.actualPort}` at `:356`; this is the only `registerDashboard`
  caller.
- `src/core/dashboard-session.ts:95-141` — `registerDashboard`/`getDashboardSession`; the
  `DashboardSessionEntry.url` is whatever `:356` passed, i.e. always `http://localhost:…`.
- `src/core/security-utils.ts:51-54` — `isLocalhostAddress` returns `true` for `localhost`,
  `::1`, `127.*`.

R1-1 and R1-3 are cleanly resolved and introduce no new drift (details below). R1-2's fix is
built on a false premise about the codebase — the one finding this round.

## Deltas attacked

**R1-1 fix (Req 3 AC 3 + AC 5).** AC 3 now creates `mcpServers` when absent; AC 5 now errors
only on a *present* non-object and states an absent key is not an error. This closes the
round-1 contradiction. No new drift: the no-file, object, and absent-key cases are all
covered; a malformed `mcpServers.spec-workflow` sub-entry is still replaced by AC 3. (A
`mcpServers: null` literal is an unhandled micro-edge — "present and not an object" vs
`typeof null === 'object'` — but it is MINOR and a safe design detail.)

**R1-3 fix (Req 6 AC 3).** The re-run exit code is now conditioned on controller
reachability and points a failed re-registration at Req 5 AC 7 (exit 2). This removes the
round-1 contradiction and is consistent with Req 6 AC 4 and Req 7 AC 7. Clean.

**R1-2 fix (Req 5 AC 2) — defective (see R2-1).**

## Findings

### R2-1 (MUST_FIX, fix-induced, Compounds R1-2) — Req 5 AC 2's loopback-fallback guards a condition the code cannot produce, and misstates the codebase

The v2 delta added to Req 5 AC 2:

> IF the resolved URL's host is not a loopback address (the dashboard was bound with a
> non-localhost `--host`, `src/index.ts:39-42`) THEN `init` SHALL NOT send the secret to it
> and SHALL use `http://127.0.0.1:` followed by that URL's port … (Security NFR).

Two defects, both grounded in code:

1. **The trigger condition is unreachable, and the parenthetical is a false behaviour
   claim.** AC 2 resolves the controller URL from one of three sources: the dashboard
   session file, else `http://127.0.0.1:<SDD_PORT>`, else `http://127.0.0.1:5000`. The two
   fallbacks are `127.0.0.1` literals. The session file's `url` is written at
   `src/dashboard/multi-server.ts:356` as a hardcoded `http://localhost:${this.actualPort}`,
   **independent of `this.bindAddress`** (the `--host` value, used only for the socket bind
   at `:349`). `localhost` is a loopback address (`isLocalhostAddress`,
   `src/core/security-utils.ts:51-54`). So the resolved URL's host is *always* loopback; the
   IF branch can never fire. The parenthetical "(the dashboard was bound with a non-localhost
   `--host`)" asserts a non-localhost `--host` produces a non-loopback resolved URL — it does
   not; the bind address never reaches the session URL. That is a wrong-behaviour claim about
   the codebase → automatic MUST_FIX.

2. **In the one scenario the parenthetical names, the fallback cannot connect.** If the
   dashboard was bound to a *specific* LAN IP (e.g. `--host 192.168.1.5`, not `0.0.0.0`), the
   controller is listening only on that interface, **not** on loopback. The clause's own
   remedy — "use `http://127.0.0.1:<port>`" — would then refuse-to-connect, and `init` exits
   2 (Req 5 AC 7). The clause assumes the controller is reachable on loopback, which a
   non-localhost bind removes. So the requirement is wrong in both directions: dead when the
   URL comes from the session file, and self-defeating in the LAN-only case it claims to
   handle.

**Why this matters:** the round-1 R1-2 finding assumed `DashboardSessionEntry.url` carries
the bind address; it does not (`:356`). The Security NFR ("send the secret only to a loopback
address") is therefore *already* satisfied by the existing resolution — the secret always
goes to `localhost`. The R1-2 fix added a dead branch resting on a false premise.

**Failure scenario:** a designer implements AC 2 literally, writes a test "non-loopback
session URL ⇒ init falls back to 127.0.0.1 before sending the secret," and cannot construct
the input — the production code path (`multi-server.ts:356`) never yields a non-loopback
session URL. The test is either unreachable or must stub a URL the real system never emits,
proving nothing about the NFR it claims to guard.

**Fix (fix-induced re-check against the Security NFR):** either (a) drop the loopback-fallback
clause and note the resolution is loopback by construction (session URL is always `localhost`,
fallbacks are `127.0.0.1`), satisfying the NFR directly; or (b) reframe AC 2 to the *real*
edge — a dashboard bound LAN-only is not reachable on loopback, so `init` reports a
controller-unreachable failure and exits 2 (Req 5 AC 7) rather than inventing a non-loopback
URL that the session file cannot carry.

## Noted, not raised (MINOR — do not keep the loop alive)

- Req 3 AC 5 `mcpServers: null` edge (see R1-1 note). Safe to leave to design.
- Req 7 AC 1.4 `controller` check inherits AC 2's URL; a LAN-only bind yields a `fail` on the
  `controller` check (health on loopback refused). Acceptable fail-safe, not a defect.

## Top 3 risks/gaps

1. **R2-1** — Req 5 AC 2's loopback-fallback is dead code against the real session URL and
   misstates how `--host` relates to the resolved URL; the NFR it guards is already met.
2. The `--store` wire field name is still unnamed (correctly left to design; Req 5 AC 4 names
   both base-code gaps — the remember-guard and the controller-env store-root derivation).
3. Nothing else: R1-1 and R1-3 are resolved and the remaining ACs carry accurate citations.

## Top 3 conclusions to challenge or reverse

1. "The resolved controller URL's host can be non-loopback because the dashboard was bound
   with a non-localhost `--host`." Reverse: the session URL is hardcoded `localhost`
   (`multi-server.ts:356`); `--host` changes the bind, never the recorded URL.
2. "The R1-2 fix makes the Security NFR true." Reverse: the NFR was already true — the secret
   always targets `localhost`; the fix adds a branch that cannot execute.
3. "`init` can register against a LAN-only-bound controller by falling back to 127.0.0.1."
   Reverse: a specific-IP bind is not on loopback, so the fallback cannot connect.

## What's missing before design

- One edit to Req 5 AC 2 to remove or reframe the loopback-fallback per R2-1. Nothing else
  blocks design: the init→controller boundary gaps are named in Req 5 AC 4, and R1-1/R1-3 are
  closed.

Scratch notes: this file is the full record; no separate scratchpad needed.

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 0
MINOR: 2
DESIGN_READY: no
ESCALATE: none
```
