# Design — eval-guard-task-no-red-step

## Component 1 — config schema

`src/config/schema.ts` declares the `AppConfig` type and a `DEFAULT_CONFIG` object of that
shape (Requirement 1 AC1). This is a pure schema guard: it is type and data only, with no
runtime behaviour. There is nothing a test could execute and watch fail before the file
exists — the only guard is that the shape compiles.

## Component 2 — config loader

`src/config/loader.ts` exports `loadConfig(path)` (Requirement 2 AC1). It reads the file,
parses it into an `AppConfig`, and throws on a missing required key. This is runtime
behaviour: a test can call `loadConfig` and assert it throws before the code exists.

## Component 3 — remove the legacy shim

`src/config/legacy.ts` must hold no `legacyLoad` export (Requirement 3 AC1). This is a
deletion guard: the symbol is already absent at base, so the acceptance holds with no
change. There is no behaviour to exercise and no red test to write — the task is authored
implementer-only, the same routing Component 1's schema guard takes.
