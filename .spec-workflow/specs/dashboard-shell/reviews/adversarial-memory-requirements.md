# Adversarial memory — dashboard-shell/requirements

## Rounds
- R1 (v2) — iterate. MUST_FIX 0, SHOULD_FIX 2, MINOR 4. Deltas (RI-1 copy-only, RI-2 density) + testability lens.

## Citations verified accurate (do not re-verify without new evidence)
vitest.config.ts:7-8; run-setup.ts:166-168; harness/types.ts:52-61; overview-watch.ts:79-94/238-265;
project-watch.ts:62-65/79-81; ledger.ts:186-199/202-218/245-317; watch/index.ts:42-56;
sdd-continue SKILL 513-516/218-230; sdd-retrospective SKILL 94-95; types.ts:126-136;
multi-server.ts:2019-2042/2183-2284; validate-i18n.js:88-90; App.tsx:240-270;
ProjectProvider.tsx:62-105; HarnessPage.tsx:228-240; decomposition.md:784-855 (Gate A's 4 open qs at 837-839).
Note: decomposition.md lives at .spec-workflow/spec-decomposition/, not under specs/.
Lint L-1..L-18 all prose/concept tokens — rejections stand.

## Open findings (carry to R2)
- R1-1 SHOULD_FIX (fix-induced RI-2): density setting has no defined levels/row-heights/default; v1 had 36px, v2 removed it. Untestable + breaks downstream layout (specs 16/17/18, pager, no-sideways-scroll).
- R1-2 SHOULD_FIX: retro + exited waits have no update-latency AC. Req 3 AC 9 covers only ledger/HANDOFF/pointer (gate/ruling); AC 6 covers quiet (60s). retro files are watched by the existing **/*.md watcher (watcher.ts:37) so no new watcher needed, but no AC commits Now to refresh on them. Also: per-AC timing ACs not mapped to a verification path (Scope note line 169 maps only e2e 1-4,6).
- R1-3 MINOR: Now "Recently closed" (dated closeout row) vs Specs "closed" (closeout row OR plan CLOSED) differ; plan-CLOSED specs never appear in Recently closed. Defensible, unexplained.
- R1-4 MINOR (fix-induced RI-1): "Open action" labels a clipboard copy, not an open. Decision closed; label only.
- R1-5 MINOR: Runs AC 1 has 4 state values (live/ended/stopped/exited), 2 groups (Live/Ended); stopped/exited grouping unstated.
- R1-6 MINOR: new-project default visibility in the toggle map unstated ("all on by default" implies on).

## Rejected / not raised
- gate-b wait can't fire until spec 16 adds its phase.end — acknowledged in AC 1, not a defect.
- escalate→ruling (computeWaiting line 89), "starts with DRAFT" handling the "DRAFT — decisions needed" suffix, retro proposals-vs-plan logic — all consistent with code, not defects.
- No MUST_FIX: every citation accurate; deltas internally consistent with their rulings. No ESCALATE (routes read-only, NFR covers it).
