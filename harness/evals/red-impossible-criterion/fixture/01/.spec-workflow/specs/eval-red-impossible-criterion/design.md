# Design — eval-red-impossible-criterion

## Component 1 — confine the unrealised path

`src/features/pnl/unrealised.ts` holds the accounts filter for the unrealised path
(Requirement 1 AC1). `computeUnrealised` already exists and the existing suite covers its
result; this change only re-homes the filter. The acceptance is a scope invariant:
`src/features/pnl/pnl.ts`, `src/features/accounts/accounts.query.ts` and
`src/features/performance/returns.ts` are left unchanged. A scope invariant names files the
task must not touch — it holds at base, where those files are unmodified, and no test can
watch it go red before the change. This is red-impossible: author the task implementer-only,
with no `- Test:` seam.

## Component 2 — quotes endpoint behind the authenticated router

`src/features/symbols/quotes.handler.ts` registers `GET /api/symbols/quotes` on
`symbolsRouter` (Requirement 2 AC1). The router already mounts
`symbolsRouter.use(authMiddleware)`, so an unauthenticated request is answered 401 by the
router-wide middleware before the route matches. The acceptance — anonymous caller gets a
401 — is therefore guaranteed at base, before the handler exists: a test written against it
passes with no implementation. This is red-impossible: author the task implementer-only, with
no `- Test:` seam, the same routing Component 1's scope guard takes.

## Component 3 — compute realised P&L

`src/features/pnl/realised.ts` exports `computeRealised(lots)` (Requirement 3 AC1). It sums
proceeds minus cost basis over the closed lots and returns the total. This is new runtime
behaviour: a test can call `computeRealised` with sample lots and assert the total before the
code exists, so this task carries a `- Test:` seam and is routed through the test author —
the contrast that shows the red-impossible routing applies only to Components 1 and 2.
