---
id: "d-e1bae32a"
status: "deferred"
title: "Controller checkpoint commits unrelated files and crashes on an untracked spec store"
createdAt: "2026-10-30T20:35:57.999Z"
updatedAt: "2026-10-31T17:08:26.842Z"
resolvedAt: null
originSpec: "server-side-match"
originPhase: "requirements"
revisitTrigger: "Before the next controller run on a project with an untracked spec store (jobsync server-side-match is blocked on it now)"
tags: ["controller", "checkpoint", "harness-defect"]
resolution: null
resolvedInSpec: null
supersededBy: null
supersedes: null
owner: "harness"
---

## Context
jobsync keeps .spec-workflow/ in .git/info/exclude; its earlier specs ran on the legacy harness, which never committed the store. Overwatch soft-reset the stray commit (operator's .gitignore edit restored, uncommitted); Matthew chose to track the jobsync store (75d2f99). commitIfChanged already skips when nothing is staged; lintStep uses checkpoint() instead. A crashed phase leaves status running with no step, so the Runs page shows a live run that is dead. (3) Consequence found after the restart: crash recovery re-entered requirements and skipped gate A, because document.ts:753 sets gateAResolved = roundsStarted and the crash happened inside the lint step after gate-a.json was written but before the gate-a wait was created. Requirements were approved after 3 rounds with no operator answers; Matthew accepted the drafter's recommended answers after the fact (2026-10-31). The fix must raise gate A on re-entry when gate-a.json exists and no gate-a wait was ever answered.

## Decision Deferred
Two checkpoint defects, found on jobsync server-side-match run-20261030-200305 (2026-10-30). (1) The requirements-v1 checkpoint (20:10Z) committed the operator's uncommitted .gitignore edit, a file outside the spec store, as "docs(sdd): server-side-match requirements v1" on the project's main. (2) lintStep calls checkpoint() directly (dist/controller/phases/document.js:254 -> ledger.js:165); with the store excluded by .git/info/exclude there was nothing to commit, git commit exited 1, the exception ended the phase, and the run record stayed "running" with no step. Not decided: whether the controller supports a project whose store is untracked (skip checkpoints, keep files on disk) or refuses to launch on one; and the fix for (1): stage only explicit store paths and never `-A` without paths.

## Revisit Criteria
Before the next controller run on a project with an untracked spec store (jobsync server-side-match is blocked on it now)
