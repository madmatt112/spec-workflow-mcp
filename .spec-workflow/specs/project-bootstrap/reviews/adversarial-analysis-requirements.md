# Adversarial Analysis — project-bootstrap/requirements (v1, round 1)

Primary surface: completeness, ambiguity, scope. Fresh lens: wire contracts across the
init → controller boundary (route body, response shape, client state in `.mcp.json`).

## What I checked and how

Read the decomposition entry 24, `codebase-context.md`, and both ends of every cited range
in the worktree code: `multi-server.ts:420-445`/`453-464`, `project-manager.ts:181-343`,
`index.ts:22-156`/`185-331`/`374-387`/`681-686`, `git-utils.ts:194-251`, `workspace-initializer.ts:18-62`,
`run-setup.ts:32-137`, `gate-rules.ts:105-139`, `access.ts:25-28`/`156-180`,
`dashboard-session.ts:1-141`, `merge.ts:47-50`, `sdd-service.sh:22-60`, `SDD-HARNESS.md:246-270`.
**Every citation is accurate** — paths, ranges, signatures and the behaviours claimed
(the `projectPath===workflowRootPath` remember-guard at 240-249, `addProjectByPath` deriving
the store root in the controller's env at 318-343, the `{ projectPath }`-only route body,
`ok: true` health, `DashboardSessionEntry.url`, `CONTROLLER_GH_BIN`, the 5000 default) all
hold. No MUST_FIX from a misstated artifact. The document is scoped tightly to entry 24 and
the Scope-notes section pre-empts the obvious scope drift (npx vs node, dropped items).

The init→controller boundary is the right place to attack, and the document is strong there:
Req 5 AC 4 names *both* code gaps the design must close and AC 6 pins the `{ projectPath }`
invariant. The findings below are the gaps that survived.

## Topics attacked

**A. Req 3 `.mcp.json` — editing an existing config (client state).**
- Stress-test AC 5 against AC 3: a valid `.mcp.json` with no `mcpServers` key.
- Challenge whether "replace only the spec-workflow entry" is reachable from an empty object.
- Probe the "previous entry differs" path when the old entry lacks `command`/`args`.

**B. Req 5 AC 2 controller URL vs Security NFR (secret on the wire).**
- Stress-test "send the secret only to a loopback address" against the session-file URL source.
- Challenge the silent assumption that the dashboard always binds loopback.

**C. Req 6 idempotence vs Req 5 registration exit code.**
- Challenge the unconditional "exit 0 on re-run" when the controller is unreachable.

**D. Scope: detection flags vs the decomposition's command line.**
- Note `--test-command`/`--worktree-setup`/`--merge-method` extend entry 24's `init <repo> [--store]`.

## Findings

### R1-1 (SHOULD_FIX) — Req 3 AC 5 rejects a valid `.mcp.json` that merely lacks `mcpServers`
AC 5: "IF `.mcp.json` exists and is not valid JSON, or its `mcpServers` is not an object THEN
init SHALL … exit 1 without writing any file." A valid file whose `mcpServers` is *absent*
(e.g. `{}` or `{"inputs":[…]}`) has `mcpServers === undefined`, which "is not an object" —
so the literal rule exits 1. That contradicts AC 3's intent ("keep every other key … add the
spec-workflow entry").
**Failure scenario:** operator runs `init` on a repo whose `.mcp.json` is `{}` (or holds only
`inputs`/other servers under a different top-level shape). init prints "not valid JSON / bad
mcpServers" and exits 1, refusing to bootstrap a repo that is perfectly fine. Fix: AC 5 should
scope the error to "`mcpServers` exists and is not an object"; AC 3/AC 1 should state that an
absent `mcpServers` is created.

### R1-2 (SHOULD_FIX) — the secret can leave loopback when the dashboard URL is non-loopback
Security NFR: "init SHALL send the secret only to a loopback address." Req 5 AC 2 takes the
controller URL from the dashboard session file first (`dashboard-session.ts:122-141`), whose
`url` is whatever the dashboard bound. The top-level help (`index.ts:39-42`) documents
`--host <non-localhost>` LAN mode explicitly. The document never says what init does when the
resolved URL is non-loopback.
**Failure scenario:** the dashboard was started with `--host 0.0.0.0`; the session file records
`http://<lan-ip>:5000`; init resolves that URL and POSTs `Authorization: Bearer <secret>` to a
LAN address, breaking its own NFR. Fix: require init to verify the resolved URL is loopback
before sending the secret (fall back to `127.0.0.1:<port>` or fail), and state it.

### R1-3 (SHOULD_FIX) — "re-run exits 0" (Req 6 AC 3) contradicts registration exit 2 (Req 5 AC 7)
Req 6 AC 3 says a second run on an already-set-up repo "SHALL … exit 0," unconditionally. But
init always re-registers (Req 5 AC 1), and Req 5 AC 7 mandates exit 2 if the controller does
not answer.
**Failure scenario:** operator re-runs `init <repo>` while the controller service is stopped;
all files are byte-identical (`kept`, `kept`, `kept`) but registration fails → exit 2, not 0.
A conformance test asserting "idempotent re-run ⇒ exit 0" is then wrong. Fix: qualify AC 3's
exit 0 on a reachable controller, or scope it to the file-write outcome.

### Noted, not raised
- **Scope (MINOR):** `--test-command`/`--worktree-setup`/`--merge-method` extend entry 24's
  `init <repo> [--store]`; the Scope-notes + D8 justify them (operator-passed overrides for the
  non-Node case). Acceptable.
- **Data contract (fine):** AC 4 AC 7's round-trip works — `readAgentRules` needs the
  `worktree-setup` value in a backtick span (`run-setup.ts:88`) and `parseAgentRuleKey` returns
  the full `tdd-test-command` value bare; both match the `SDD-HARNESS.md:255/262` conventions,
  so an implementer following the existing file gets it right.
- **Dispatch order (design):** `init --help` (AC 10) must print init usage, but `main()`
  handles `--help` first (`index.ts:380-384`); the design must dispatch the subcommand before
  the generic help check. AC 1/2/10 pin the observable outcome, so it is testable — a design note.

## Top risks/gaps
1. R1-1 — valid-but-`mcpServers`-less config wrongly rejected.
2. R1-2 — shared secret may be sent off-loopback via the session-file URL.
3. R1-3 — idempotent-re-run exit code contradicts the registration-failure exit code.
4. The init→controller wire field that carries the `--store` root is unnamed (correctly left
   to design, but it is the one thing the whole `--store` story depends on).

## Top 3 conclusions to challenge
1. "init SHALL replace only the spec-workflow entry and keep every other key" assumes a
   well-formed `mcpServers` map already exists — reverse: handle the empty/absent case first.
2. "find the controller at the URL of the live dashboard session file" assumes that URL is
   loopback — it need not be; the secret rule must gate the URL, not trust it.
3. "a second run … SHALL exit 0" assumes the controller is up on the re-run — it may not be.

## What's missing before design
- One sentence each in Req 3 AC 5, the Security NFR / Req 5 AC 2, and Req 6 AC 3 to close the
  three contradictions above. Nothing else blocks design; the boundary gaps (both named in
  Req 5 AC 4) are a clean hand-off to the design phase.

Scratch notes: this file is the full record; no separate scratchpad needed.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 3
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
