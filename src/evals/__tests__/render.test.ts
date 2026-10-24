import { describe, it, expect } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { renderCaseBriefs, RenderError } from '../render.js';
import type { EvalCase, EvalBrief } from '../case.js';
import type { Fixture } from '../fixture.js';
import { harnessHandler } from '../../tools/harness.js';
import { COMMIT_SCRIPT } from '../../controller/phases/closeout.js';

// Design Component 3 (src/evals/render.ts), R1 AC2, requirements D1:
// renderCaseBriefs(c, f, scratch, handler) renders every brief a case names from the build
// under evaluation, through the real `harnessHandler` (the brief action,
// src/tools/harness.ts:617-842), the same call shape the live implementation and close-out
// phases use. Each test builds its own fixture root and scratch directory with mkdtempSync
// and reaches the renderer only through `renderCaseBriefs`, never a module-private helper.

function baseCase(phase: EvalCase['phase'], briefs: EvalBrief[]): EvalCase {
  return {
    id: 'render-test-case',
    role: 'sdd-implementer',
    phase,
    spec: 'eval-render-test-case',
    turnCap: 100,
    evidence: 'docs/example.md:1-2',
    briefs,
    fixture: { commits: [] },
    graders: [],
  };
}

function makeRoots(): { f: Fixture; scratch: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), 'eval-render-root-'));
  const scratch = mkdtempSync(join(tmpdir(), 'eval-render-scratch-'));
  return {
    f: { root, parent: root, bases: {} },
    scratch,
    cleanup: () => {
      rmSync(root, { recursive: true, force: true });
      rmSync(scratch, { recursive: true, force: true });
    },
  };
}

describe('renderCaseBriefs(c, f, scratch, handler)', () => {
  // Pre-condition: one brief entry (template `gate-a`) whose `docPath` value carries both
  // placeholders in one string.
  // Test: renderCaseBriefs(c, f, scratch, harnessHandler).
  // Observable result: the rendered text contains the literal fixture root in place of
  // `{{fixture}}` and the literal scratch directory in place of `{{scratch}}`.
  // Expected-value source: design.md Component 3 post-condition 1, "In every `values`
  // string, `{{fixture}}` becomes `f.root` and `{{scratch}}` becomes `scratch`, before
  // render." (design.md:55); tasks.md task 6 Prompt, "both placeholders are substituted".
  it('substitutes {{fixture}} and {{scratch}} in every brief value', async () => {
    const { f, scratch, cleanup } = makeRoots();
    const c = baseCase('document', [
      { template: 'gate-a', file: 'gate-a.md', values: { docPath: `root {{fixture}} and scratch {{scratch}} done` } },
    ]);

    const { texts } = await renderCaseBriefs(c, f, scratch, harnessHandler);

    expect(texts['gate-a']).toContain(`root ${f.root} and scratch ${scratch} done`);

    cleanup();
  });

  // Pre-condition: a `closeout-standing` entry followed by a `closeout-batch` entry whose
  // `wire` map points its `standing` key at the earlier `closeout-standing` template.
  // Test: renderCaseBriefs(c, f, scratch, harnessHandler).
  // Observable result: the batch brief's rendered text names the standing brief's own
  // rendered absolute path (`Read \`<path>\` first and obey it.`,
  // src/tools/brief-templates.ts:1505).
  // Expected-value source: design.md Component 3 post-condition 2, "An entry's `wire` map
  // ... sets `values[key]` to the output path of the earlier brief of that template, so
  // `closeout-batch`'s `standing` names the rendered `closeout-standing`" (design.md:56);
  // tasks.md task 6 Prompt, "the batch text names the standing brief's rendered path".
  it("wires the standing brief's rendered path into the batch brief text", async () => {
    const { f, scratch, cleanup } = makeRoots();
    const c = baseCase('closeout', [
      { template: 'closeout-standing', file: 'standing.md', values: { commitScript: '{{scratch}}/closeout-commit.sh' } },
      {
        template: 'closeout-batch',
        file: 'batch.md',
        values: {
          cls: 'code', batch: '1', root: '{{fixture}}', landing: 'the fixture root',
          commitHow: 'the commit script', checks: 'none', items: 'none',
        },
        wire: { standing: 'closeout-standing' },
      },
    ]);

    const { texts } = await renderCaseBriefs(c, f, scratch, harnessHandler);

    const standingPath = resolve(join(scratch, 'standing.md'));
    expect(texts['closeout-batch']).toContain(`Read \`${standingPath}\` first and obey it.`);

    cleanup();
  });

  // Pre-condition: a closeout-phase case (one `closeout-standing` entry); the handler is a
  // spy that, on its first call, checks whether `scratch/closeout-commit.sh` already exists.
  // Test: renderCaseBriefs(c, f, scratch, spyHandler).
  // Observable result: on the first handler call the script already exists at mode 755 with
  // the exact `COMMIT_SCRIPT` text — the write happened before any brief rendered.
  // Expected-value source: design.md Component 3 post-condition 4, "For a `closeout` case,
  // `scratch/closeout-commit.sh` (mode 755) is written first from `COMMIT_SCRIPT`
  // (`src/controller/phases/closeout.ts:196-206`), which this spec exports unchanged"
  // (design.md:58); tasks.md task 6 Prompt, "a close-out case writes `closeout-commit.sh`
  // with mode 755 and the `COMMIT_SCRIPT` text before rendering".
  it('writes closeout-commit.sh at mode 755 with the COMMIT_SCRIPT text before any brief renders', async () => {
    const { f, scratch, cleanup } = makeRoots();
    const scriptPath = join(scratch, 'closeout-commit.sh');
    let scriptReadyBeforeFirstRender = false;
    let sawFirstCall = false;
    const spyHandler: typeof harnessHandler = async (args, context) => {
      if (!sawFirstCall) {
        sawFirstCall = true;
        scriptReadyBeforeFirstRender =
          existsSync(scriptPath) &&
          readFileSync(scriptPath, 'utf-8') === COMMIT_SCRIPT &&
          (statSync(scriptPath).mode & 0o777) === 0o755;
      }
      return harnessHandler(args, context);
    };
    const c = baseCase('closeout', [
      { template: 'closeout-standing', file: 'standing.md', values: { commitScript: scriptPath } },
    ]);

    await renderCaseBriefs(c, f, scratch, spyHandler);

    expect(sawFirstCall).toBe(true);
    expect(scriptReadyBeforeFirstRender).toBe(true);

    cleanup();
  });

  // Pre-condition: a `document`-phase case with one `gate-a` brief entry whose values omit
  // the template's only required key, `docPath`.
  // Test: renderCaseBriefs(c, f, scratch, harnessHandler).
  // Observable result: the call throws `RenderError`, and its message equals the brief
  // action's own missing-value message (src/tools/harness.ts:737-745) naming the missing
  // key and the template's required list.
  // Expected-value source: design.md Component 3 post-condition 3, "A failure throws
  // `RenderError` with the action's message" (design.md:57); tasks.md task 6 Prompt, "a
  // missing required key throws `RenderError` carrying the action's message".
  it("throws RenderError carrying the brief action's message for a missing required key", async () => {
    const { f, scratch, cleanup } = makeRoots();
    const c = baseCase('document', [
      { template: 'gate-a', file: 'gate-a.md', values: {} },
    ]);

    let thrown: unknown;
    try {
      await renderCaseBriefs(c, f, scratch, harnessHandler);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(RenderError);
    expect((thrown as Error).message).toBe(
      "brief: required value 'docPath' missing; no file written. Template 'gate-a' requires: 'docPath'",
    );

    cleanup();
  });

  // Pre-condition: the same `closeout-standing` then `closeout-batch` case as the wiring
  // test above.
  // Test: renderCaseBriefs(c, f, scratch, harnessHandler).
  // Observable result: `texts` holds exactly one entry per rendered template, each equal to
  // the text written to that brief's file on disk, and `launchBrief` equals the absolute
  // path of the last entry's rendered file (the batch brief), not the standing one.
  // Expected-value source: design.md Component 3 post-condition 5, "The last brief is the
  // launch brief; `texts` maps each template to its rendered text, for the selector"
  // (design.md:59); tasks.md task 6 Prompt, "`texts` covers each template and the last
  // brief is the launch brief".
  it('maps texts to each rendered template and returns the last brief as the launch brief', async () => {
    const { f, scratch, cleanup } = makeRoots();
    const c = baseCase('closeout', [
      { template: 'closeout-standing', file: 'standing.md', values: { commitScript: '{{scratch}}/closeout-commit.sh' } },
      {
        template: 'closeout-batch',
        file: 'batch.md',
        values: {
          cls: 'code', batch: '1', root: '{{fixture}}', landing: 'the fixture root',
          commitHow: 'the commit script', checks: 'none', items: 'none',
        },
        wire: { standing: 'closeout-standing' },
      },
    ]);

    const { launchBrief, texts } = await renderCaseBriefs(c, f, scratch, harnessHandler);

    expect(Object.keys(texts).sort()).toEqual(['closeout-batch', 'closeout-standing']);
    expect(texts['closeout-standing']).toBe(readFileSync(join(scratch, 'standing.md'), 'utf-8'));
    expect(texts['closeout-batch']).toBe(readFileSync(join(scratch, 'batch.md'), 'utf-8'));
    expect(launchBrief).toBe(resolve(join(scratch, 'batch.md')));

    cleanup();
  });
});
