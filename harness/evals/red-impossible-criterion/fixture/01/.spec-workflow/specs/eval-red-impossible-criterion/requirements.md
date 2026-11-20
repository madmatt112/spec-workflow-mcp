# Requirements — eval-red-impossible-criterion

## Requirement 1 — confine the unrealised path to its own module

**User Story:** As a maintainer, I want the unrealised P&L path confined to `unrealised.ts`, so the pnl, accounts-query and performance modules stay untouched.

#### Acceptance Criteria

1. Component 1 SHALL implement the accounts filter for the unrealised path inside `src/features/pnl/unrealised.ts` only, leaving `src/features/pnl/pnl.ts`, `src/features/accounts/accounts.query.ts`, and `src/features/performance/returns.ts` unchanged. `computeUnrealised` already exists and the existing suite covers its result; the only new assertion is this scope invariant on files the task must not touch. It holds at base — those files are unmodified — and nothing a test runs can watch it fail before the change.

## Requirement 2 — the quotes endpoint is behind the authenticated router

**User Story:** As an account holder, I want `GET /api/symbols/quotes` to require a session, so an anonymous caller cannot read quotes.

#### Acceptance Criteria

1. Component 2 SHALL register `GET /api/symbols/quotes` on `symbolsRouter` in `src/features/symbols/quotes.handler.ts`. An unauthenticated request SHALL return 401. The router already mounts `symbolsRouter.use(authMiddleware)`, which returns the 401 before the route matches, so this guard already holds at base — a test asserting it passes with no implementation.

## Requirement 3 — compute realised P&L from closed lots

**User Story:** As an account holder, I want realised P&L from my closed lots, so I can see booked gains.

#### Acceptance Criteria

1. Component 3 SHALL export `computeRealised(lots)` in `src/features/pnl/realised.ts`. It sums proceeds minus cost basis over each closed lot and returns the total. This is new runtime behaviour: a test can call `computeRealised` with sample lots and assert the total before the code exists.
