---
id: "d-aaf54e29"
status: "deferred"
title: "A run launched on the store project gates the store repo and leaves the code branch without a PR"
createdAt: "2026-11-03T20:54:16.223Z"
updatedAt: "2026-11-03T20:54:16.223Z"
resolvedAt: null
originSpec: "ca-acb-pool-perf"
originPhase: "implementation"
revisitTrigger: "Next swm harness batch; before the next tradr launch, check the run's project is jw-DAU9PDsLBNYBp"
tags: ["controller", "launcher", "harness-defect"]
resolution: null
resolvedInSpec: null
supersededBy: null
supersedes: null
owner: "harness"
---

## Context
Earlier tradr runs (tax-lots, ca-acb-pooling) used jw-DAU9PDsLBNYBp and worked. Escalation w-4cb0a215 was ruled by listing the spec-store prefix on task 7 (a workaround). The code branch must get its PR by hand after this run. Related: d-c3c57b89 (no-PR path on a project with a remote).

## Decision Deferred
ca-acb-pool-perf (run-20261102-213332) was launched on project oKR9i6DO6z4bVtZ1 ("tradr-hosted") instead of jw-DAU9PDsLBNYBp ("tradr-hosted · tradr"), so its codeRoot is the tradr-hosted main checkout while the code is on branch ca-acb-pool-perf in /home/mcf/repo/tradr/.claude/worktrees/ca-acb-pool-perf. Every pick head stayed 221b225, the task 7 gate diffed the spec store (file-outside-list on seven store paths), and pushAndOpenPr will see the default branch and note "nothing pushed, no PR", so the code branch gets no PR and no merge stage. Not decided: hide or refuse the store-only project in the launcher when a linked code project exists, or derive codeRoot from the store's agent-rules.

## Revisit Criteria
Next swm harness batch; before the next tradr launch, check the run's project is jw-DAU9PDsLBNYBp
