---
id: "d-afcd942d"
status: "resolved"
title: "fixture.test.ts leaves-no-parent test is not concurrency-safe (diffs global os.tmpdir)"
createdAt: "2026-10-24T03:43:27.397Z"
updatedAt: "2026-10-26T13:41:52.649Z"
resolvedAt: "2026-10-26T13:41:52.649Z"
originSpec: "harness-evals"
originPhase: "implementation"
revisitTrigger: "When fixture.test.ts or any eval test is next touched, or when full-suite flakiness is triaged. Fix: assert the fixture's own parent path is absent (scope to the eval-fixture- prefix or capture f.parent before the throw), not diff the global os.tmpdir listing."
tags: ["info-finding", "test-isolation", "flaky-test"]
resolution: "Fixed by PR #177 (harness-evals retro P4): the leaves-no-parent test now scopes to the eval-fixture- prefix instead of diffing the global os.tmpdir listing."
resolvedInSpec: "harness-evals"
supersededBy: null
supersedes: null
owner: "harness"
---

## Context
Found at the end-to-end verification gate (HEAD ce8b6ecd). Production buildFixture is correct: on error it rmSync(parent, recursive+force) at src/evals/fixture.ts:73, removing its own mkdtemp parent; the test passes deterministically in isolation (7/7, 3x) and meets task 5 success criteria. Non-blocking: no existing test regressed (the 5 other full-suite failures reproduce identically at merge-base d8be9cd3). The defect is only in the test cleanup check.

## Decision Deferred
The new test src/evals/__tests__/fixture.test.ts:196-213 snapshots the whole shared os.tmpdir() before/after buildFixture and asserts no new entry appears. Under vitest parallel workers, sibling eval tests create eval-fixture-*/fixture-case-* dirs in the same tmpdir between snapshots, so it fails intermittently (full suite and scoped npx vitest run src/evals, ~1 in 6 group runs). Not fixed in this spec.

## Revisit Criteria
When fixture.test.ts or any eval test is next touched, or when full-suite flakiness is triaged. Fix: assert the fixture's own parent path is absent (scope to the eval-fixture- prefix or capture f.parent before the throw), not diff the global os.tmpdir listing.
