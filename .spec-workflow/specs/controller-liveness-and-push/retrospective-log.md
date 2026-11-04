# Retrospective log — controller-liveness-and-push

## 2026-11-04T03:14:45Z · implementation · task 1 · gotcha
task 1 closed: 0 fix round(s), outcome gate
Evidence: task 1 · mark run-20261103-172257 0031dd94
Cost: 1 implementer spawn(s)

## 2026-11-04T03:24:32Z · implementation · task 2 · gotcha
task 2 closed: 0 fix round(s), outcome pass
Evidence: task 2 · mark run-20261103-172257 399c01f8
Cost: 1 implementer spawn(s)

## 2026-11-04T03:29:33Z · implementation · task 3 · doc-gap
red-impossible: covered at base by step.test.ts:155-157 (branch: fires for tool_use, exact-array equality) and :359 (branch: does not fire for non-tool_use, exact-array equality over a stream mixing system/rate_limit_event/user/tool_result with only 2 tool_use blocks)","redImpossible":"some","retro":"Stub-claude.mjs always emits valid JSON objects with trailing newlines, so it can't produce blank/non-JSON/scalar/no-newline lines needed for (b)(c)(d). Wrote a tiny runtime-only \"raw claude\" script per test (via writeFileSync into mkdtemp, not committed to scripts/) that echoes exact bytes to stdout, to drive the line parser precisely without touching any non-test path."}
Evidence: task 3 · mark run-20261103-172257 2a0b5e4e
Cost: 1 spawn

## 2026-11-04T03:31:07Z · implementation · task 3 · gotcha
task 3 closed: 0 fix round(s), outcome gate
Evidence: task 3 · mark run-20261103-172257 c0858d7a
Cost: 1 implementer spawn(s)

## 2026-11-04T03:48:37Z · implementation · task 4 · gotcha
task 4 closed: 0 fix round(s), outcome gate
Evidence: task 4 · mark run-20261103-172257 3a6fcf39
Cost: 1 implementer spawn(s)

## 2026-11-04T03:55:09Z · implementation · task 5 · gotcha
task 5 closed: 0 fix round(s), outcome gate
Evidence: task 5 · mark run-20261103-172257 45eed5b3
Cost: 1 implementer spawn(s)

## 2026-11-04T04:08:06Z · implementation · task 6 · gotcha
task 6 closed: 0 fix round(s), outcome pass
Evidence: task 6 · mark run-20261103-172257 7a5c0df3
Cost: 1 implementer spawn(s)

## 2026-11-04T04:32:37Z · implementation · task 7 · gotcha
task 7 closed: 0 fix round(s), outcome pass
Evidence: task 7 · mark run-20261103-172257 761eed67
Cost: 1 implementer spawn(s)

## 2026-11-04T04:48:11Z · implementation · task 8 · doc-gap
red-impossible: kill-retry (runs.ts RUN_FRESH_RETRY, step.ts classify) + drivenRuns() (task 7) already hold; no exact existing assertion names the combo, so wrote a regression-guard test (liveness-e2e.test.ts) per P10 — it passed green at base, committed as a guard, not counted red. 12/13 tests genuinely RED (7 TypeError on missing redrive, 5 assertion/timeout failures against current recover/reattach/start behaviour). No regressions in 36 pre-existing tests across both files. No pre-commit hook present."}
Evidence: task 8 · mark run-20261103-172257 00489bd6
Cost: 1 spawn

## 2026-11-04T04:52:42Z · implementation · task 8 · gotcha
task 8 closed: 0 fix round(s), outcome gate
Evidence: task 8 · mark run-20261103-172257 fd1fa387
Cost: 1 implementer spawn(s)
