import { describe, it, expect, beforeAll } from 'vitest';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// Contract for dashboard-board task 7 (design C8 "Project enable state";
// Requirements 1.6, 1.7).
//
// `enable.ts` lives under `src/dashboard_frontend/`, which the root
// `tsconfig.json` excludes (`:20`) and `vitest.config.ts` excludes from the
// run (`:9`). A static `import` of it from this file (under `src/dashboard`,
// which IS in the root program) pulls the frontend file into that program
// and fails `npx tsc --noEmit` with TS2835, because the frontend has no
// tsconfig of its own to resolve against. The module is instead loaded at
// runtime with `await import(pathToFileURL(...).href)`, a computed
// specifier TypeScript does not try to resolve statically, and cast to a
// hand-written type below (task 7 _Prompt, same pattern as
// `deploy-view.test.ts:12-17`).

const HERE = dirname(fileURLToPath(import.meta.url));
const FE = join(HERE, '..', '..', '..', 'dashboard_frontend', 'src', 'modules');

type EnableModule = {
  isEnabled: (id: string, name: string, off: string[], on: string[]) => boolean;
  toggled: (id: string, name: string, off: string[], on: string[]) => { off: string[]; on: string[] };
  DEFAULT_OFF_NAMES: readonly string[];
};

describe('enable.ts (src/dashboard_frontend/src/modules/projects/enable.ts)', () => {
  let enable: EnableModule;

  beforeAll(async () => {
    enable = (await import(pathToFileURL(join(FE, 'projects', 'enable.ts')).href)) as EnableModule;
  });

  // Criterion "An id in `on` is enabled even when also in `off` and even
  // when named `sdd-fixture`" (design C8 "An id in `on` is enabled, else an
  // id in `off` is disabled, else ..."; task 7 Success).
  //   Pre-condition: id 'p1', name 'sdd-fixture', present in both `off` and
  //   `on`.
  //   Test: isEnabled('p1', 'sdd-fixture', ['p1'], ['p1']).
  //   Observable result: true.
  //   Expected-value source: design C8's post-condition order — `on` is
  //   checked first, so it wins over `off` and over the `DEFAULT_OFF_NAMES`
  //   fallback.
  it('treats an id in `on` as enabled even when also in `off` and even when named sdd-fixture', () => {
    expect(enable.isEnabled('p1', 'sdd-fixture', ['p1'], ['p1'])).toBe(true);
  });

  // Criterion "an id in `off` only is disabled" (design C8 "... else an id
  // in `off` is disabled ..."; task 7 Success).
  //   Pre-condition: id 'p2' present in `off` only, named a project other
  //   than sdd-fixture.
  //   Test: isEnabled('p2', 'tradr', ['p2'], []).
  //   Observable result: false.
  //   Expected-value source: design C8's post-condition's `off` branch.
  it('treats an id in `off` only as disabled', () => {
    expect(enable.isEnabled('p2', 'tradr', ['p2'], [])).toBe(false);
  });

  // Criterion "an unset `sdd-fixture` is disabled" (design C8 "... else the
  // project is enabled unless its name is in `DEFAULT_OFF_NAMES`"; task 7
  // Success; Requirement 1.7 "the operator has never set the project
  // `sdd-fixture` ... it SHALL be off").
  //   Pre-condition: id 'p3' named 'sdd-fixture', absent from both `off`
  //   and `on`.
  //   Test: isEnabled('p3', 'sdd-fixture', [], []).
  //   Observable result: false.
  //   Expected-value source: `DEFAULT_OFF_NAMES = ['sdd-fixture']` (design
  //   C8) feeding the unset-fallback branch.
  it('treats an unset sdd-fixture as disabled', () => {
    expect(enable.isEnabled('p3', 'sdd-fixture', [], [])).toBe(false);
  });

  // Criterion "any other unset project, each tradr entry included, is
  // enabled (D24)" (design C8 post-condition's unset-fallback branch;
  // design D24 "Both tradr entries default to on"; task 7 Success;
  // Requirement 1.7 "Every other unset project SHALL stay on").
  //   Pre-condition: two project ids named for the two tradr entries, plus
  //   one named for an unrelated project, all absent from both `off` and
  //   `on`.
  //   Test: isEnabled for each of the three.
  //   Observable result: true for all three.
  //   Expected-value source: the literal "any other unset project ...
  //   is enabled" clause, cross-checked against D24's "both tradr entries
  //   default to on".
  it('treats any other unset project as enabled, including both tradr entries', () => {
    expect(enable.isEnabled('tradr-1', 'tradr', [], [])).toBe(true);
    expect(enable.isEnabled('tradr-2', 'tradr-fixture', [], [])).toBe(true);
    expect(enable.isEnabled('p4', 'some-other-project', [], [])).toBe(true);
  });

  // Criterion "`toggled` on an unset `sdd-fixture` puts its id in `on`"
  // (design C8 "`toggled` flips the current value by moving the id into
  // the other list"; task 7 Success; Requirement 1.7's "stay on across
  // reloads once turned on").
  //   Pre-condition: id 'p3' named 'sdd-fixture', absent from both `off`
  //   and `on` (disabled, per the unset-fallback branch).
  //   Test: toggled('p3', 'sdd-fixture', [], []).
  //   Observable result: { off: [], on: ['p3'] }.
  //   Expected-value source: the task Success line's literal "puts its id
  //   in on" clause.
  it('puts the id in `on` when toggling an unset sdd-fixture', () => {
    expect(enable.toggled('p3', 'sdd-fixture', [], [])).toEqual({ off: [], on: ['p3'] });
  });

  // Criterion "`toggled` on an enabled project puts its id in `off` and
  // removes it from `on`" (design C8 "`toggled` flips the current value by
  // moving the id into the other list"; task 7 Success).
  //   Pre-condition: id 'p4' named 'tradr', currently enabled because it is
  //   listed in `on`.
  //   Test: toggled('p4', 'tradr', [], ['p4']).
  //   Observable result: { off: ['p4'], on: [] } — 'p4' moves into `off`
  //   and is removed from `on`.
  //   Expected-value source: the task Success line's literal "puts its id
  //   in off and removes it from on" clause.
  it('puts the id in `off` and removes it from `on` when toggling an enabled project', () => {
    expect(enable.toggled('p4', 'tradr', [], ['p4'])).toEqual({ off: ['p4'], on: [] });
  });

  // Criterion "toggling twice returns the first answer" (task 7 Success).
  //   Pre-condition: id 'p3' named 'sdd-fixture', absent from both `off`
  //   and `on` (the first `isEnabled` answer is false, R1 AC 7).
  //   Test: isEnabled before any toggle; `toggled` once; isEnabled on the
  //   result; `toggled` again on that result; isEnabled on the final
  //   result.
  //   Observable result: the first and final `isEnabled` answers are both
  //   false, even though the middle answer is true.
  //   Expected-value source: the task Success line's literal "toggling
  //   twice returns the first answer" clause.
  it('returns to the first isEnabled answer after toggling twice', () => {
    const first = enable.isEnabled('p3', 'sdd-fixture', [], []);
    expect(first).toBe(false);

    const afterOne = enable.toggled('p3', 'sdd-fixture', [], []);
    expect(enable.isEnabled('p3', 'sdd-fixture', afterOne.off, afterOne.on)).toBe(true);

    const afterTwo = enable.toggled('p3', 'sdd-fixture', afterOne.off, afterOne.on);
    expect(enable.isEnabled('p3', 'sdd-fixture', afterTwo.off, afterTwo.on)).toBe(first);
  });
});
