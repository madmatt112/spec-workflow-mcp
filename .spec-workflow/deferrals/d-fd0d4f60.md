---
id: "d-fd0d4f60"
status: "resolved"
title: "dashboard-shell live checks 1-4 need an operator pre-merge session in a rebuilt dashboard"
createdAt: "2026-10-07T06:06:16.675Z"
updatedAt: "2026-10-08T21:10:17.464Z"
resolvedAt: "2026-10-08T21:10:17.464Z"
originSpec: "dashboard-shell"
originPhase: "implementation"
revisitTrigger: "Before merging the dashboard-shell PR: an operator rebuilds (npm run build) and restarts the dashboard with the four registered projects and runs decomposition checks 1-4."
tags: ["verification", "dashboard-shell"]
resolution: "Overwatch ran checks 1-4 on 2026-10-07; 1, 2, 4 passed. Check 3 was partial (enabled Launch not pressed); Matthew accepted it as partial on 2026-10-08 and the Launch press is carried as d-40df3cdb."
resolvedInSpec: "dashboard-shell"
supersededBy: null
supersedes: null
---

## Context
The completion-gate e2e scenario has six checks. Checks 5 (removed routes gone; build, tsc, test green) and 6 (no sideways scroll at 1000/375 px) were verified in-process this run (build/tsc/test all green; worktree-shell.spec.ts 8/8). Checks 1-4 assert live multi-project dashboard behaviour (Now page with two live runs plus idle project plus closed specs, live gate-A wait within 5s without reload; run page matching --watch with a following Ledger tab; Launch card launch and its disabled reason during a live run; Specs panel of a closed spec with two runs, phase table and files). These need a rebuilt, restarted dashboard with the four registered projects and live runs, which the running harness session cannot stand up (G2 operator pre-merge session). They are tracked as four `- (N) pending` lines in .spec-workflow/specs/dashboard-shell/verification-evidence.md.

## Decision Deferred
The live half of the end-to-end verification (decomposition checks 1-4) was not run this session; only the in-process half (checks 5-6) was.

## Revisit Criteria
In a rebuilt, restarted dashboard with the four registered projects: (1) Now lists both live runs with phase and detail, the idle project with its routed spec, the last seven days' closed specs, and a phase.end result gate-a appended to a ledger surfaces under waiting-on-you within 5s with no reload; (2) the run page matches --watch on the same store with the Ledger tab following; (3) Launch from a card starts a headless run and shows its disabled reason while a run is live; (4) the Specs panel of a closed spec shows its two runs, phase table and files. Record each line in verification-evidence.md as passed when confirmed.
