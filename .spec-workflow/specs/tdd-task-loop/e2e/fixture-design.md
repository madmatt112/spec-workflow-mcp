# Design Document — tdd-fixture

## Overview

A minimal ES-module code root with one shipped helper (`clampPercent`) and one
helper still to add (`toPercentLabel`). The three tasks map one-to-one onto the
loop's three branches. Tests run under `node --test`, matching the scratch
store's `tdd-test-command: node --test {files}`.

## Code root layout

- `package.json` — `"type": "module"`, a `test` script running `node --test`.
- `src/clamp.js` — exports `clampPercent(n)`: returns `0` below `0`, `100` above
  `100`, otherwise `n`. The behaviour task 3 asserts already exists here.
- `src/labels.js` — at the base, a stub `toPercentLabel` that returns
  `String(fraction)`; task 1 replaces it with the real label.
- `src/__tests__/` — the two `node --test` files the marked tasks name.
- `README.md` — the file task 2 documents.

## Components

### Component 1 — clampPercent (exists at base)

`clampPercent(150)` returns `100`. Task 3's test asserts this and therefore
passes on the base, which is the `RED-IMPOSSIBLE` branch.

### Component 2 — toPercentLabel (stub at base, finished by task 1)

`toPercentLabel(fraction)` returns `` `${Math.round(fraction * 100)}%` ``.
A stub with the wrong behaviour at the base, so task 1's test imports fine and
fails on an assertion until the implementer replaces it.

### Component 3 — README (task 2)

A docs-only change: task 2 adds a Usage section naming `clampPercent`. No test
seam, no source change, so the phase spawns no author for it.

## Testing Strategy

Each marked task names one `node --test` file under `src/__tests__/`. The base
outcome is honest-red for task 1 and pass (red-impossible) for task 3.
