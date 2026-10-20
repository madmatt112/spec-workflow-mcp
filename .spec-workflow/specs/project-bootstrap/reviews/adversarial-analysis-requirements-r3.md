# Adversarial Analysis — project-bootstrap/requirements (v3, round 3)

Primary surface: completeness, ambiguity, scope. Fresh lens: none (per prompt).
Scope this round: fix-induced re-check of R2-1 only — confirm Req 5 AC 2's
loopback-fallback was dropped/reframed against the Security NFR without
re-introducing a secret-off-loopback path or breaking the doctor checks that
reference AC 2's URL.

## What I checked and how

Read the v3 Revision History line and the `## Changes since edd1f66` diff first.
The v3 delta touches exactly one AC — Req 5 AC 2 — plus the Revision History and
the lint-pass line. R2-1 (v2) asked to drop or reframe AC 2's dead
loopback-fallback IF clause. The delta took option (a) from the R2 fix note:
deleted the IF clause, replaced it with a loopback-by-construction statement.

I re-verified every citation the new AC 2 sentence makes, both ends of each
range, in the review worktree tree:

- `src/dashboard/multi-server.ts:349-356` — `:349` binds `host: this.bindAddress`
  (the `--host` value); `:356` writes `const dashboardUrl =
  \`http://localhost:${this.actualPort}\``. The URL is a hardcoded `localhost`,
  independent of the bind address. The cited range brackets both the bind and the
  URL write — accurate support for "written as localhost … independent of the
  `--host` bind."
- `src/core/security-utils.ts:51-54` — `isLocalhostAddress` returns `true` for
  `localhost`, `::1`, `127.*`. Accurate.
- `src/core/dashboard-session.ts:122-141` — `getDashboardSession` returns the
  stored `DashboardSessionEntry`, whose `url` is whatever `registerDashboard`
  (`:95-104`) was passed, i.e. always the `http://localhost:…` of `:356`. Accurate.
- `scripts/sdd-service.sh:33` — `PORT="${SDD_PORT:-5000}"`. The service default is
  5000. Accurate.

## Fix-induced re-check — R2-1 (resolved)

The v2 AC 2 read:

> IF the resolved URL's host is not a loopback address (the dashboard was bound
> with a non-localhost `--host`) THEN `init` SHALL NOT send the secret to it and
> SHALL use `http://127.0.0.1:` … (Security NFR).

R2-1 ruled this a MUST_FIX: the IF branch is unreachable (the session URL is a
hardcoded `localhost`, the two fallbacks are `127.0.0.1` literals), and the
parenthetical falsely tied `--host` to the resolved URL host.

The v3 AC 2 now reads:

> … The resolved URL's host is loopback by construction: the session file's URL
> is written as `http://localhost:` and the port, independent of the dashboard's
> `--host` bind (`src/dashboard/multi-server.ts:349-356`), and `localhost` is a
> loopback address … the two fallbacks are `127.0.0.1` literals. `init` therefore
> sends the secret only to a loopback host (Security NFR).

This is correct and matches ground truth on every clause:
- Dead IF clause removed — no unreachable requirement remains.
- No secret-off-loopback path re-introduced. All three URL sources resolve to a
  loopback host (`localhost` or `127.0.0.1`), so the Security NFR ("send the
  secret only to a loopback address") holds by construction, directly, without a
  branch that cannot execute.
- Doctor checks unbroken. Req 7 AC 1.4 (`controller`) and the `registered` check
  still consume "the URL of Requirement 5 AC 2"; the resolution logic (session
  file, else `127.0.0.1:SDD_PORT`, else `:5000`) is unchanged, only the dead
  branch is gone. Both checks still have a URL to hit.

R2-1 is resolved. No new drift introduced by the delta.

## Noted, not raised (MINOR — does not keep the loop alive)

- **LAN-only bind unreachability (carried, already acceptable).** If the dashboard
  is bound to a specific non-loopback interface (`--host 192.168.1.5`), the server
  listens only there, while the session file still records `http://localhost:…`.
  `init` would then POST to a loopback port nothing listens on → connection
  refused → exit 2 (Req 5 AC 7), and the `controller` check fails. R2 already
  noted this as an acceptable fail-safe; the v3 fix note chose option (a)
  knowingly. The AC 7 failure line names `scripts/sdd-service.sh install` as the
  remedy, which is mildly imprecise in this one edge (the controller is running,
  just not on loopback), but this is a deliberate out-of-scope operator choice and
  a wording nicety at most. No change needed.

## Top risks/gaps (short doc → 3)

1. None at MUST_FIX or SHOULD_FIX. R2-1 is cleanly resolved; the delta's four
   citations all verify.
2. The LAN-only bind edge above remains a MINOR, already-accepted fail-safe.
3. No other AC references the deleted clause; no contradiction was opened
   elsewhere by the delta.

## Top conclusions to challenge or reverse

- None this round. The one claim the delta asserts — "the resolved URL's host is
  loopback by construction" — is true against `multi-server.ts:356`,
  `security-utils.ts:51-54`, and the two `127.0.0.1` fallbacks. The reversal R2
  demanded (that `--host` never reaches the recorded URL) is exactly what the v3
  text now states.

## What's missing before design

- Nothing. R1-1, R1-3 (v1) and R2-1 (v2) are all resolved; the init→controller
  boundary gaps are named in Req 5 AC 4; all cited artifacts verify. Design-ready.

Scratch notes: this file is the full record; no separate scratchpad needed.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 1
DESIGN_READY: yes
ESCALATE: none
```
