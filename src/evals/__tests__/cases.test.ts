import { describe, it, expect } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { loadCase, listCaseIds, casesRoot } from '../case.js';
import { buildFixture, disposeFixture } from '../fixture.js';
import { renderCaseBriefs } from '../render.js';
import { harnessHandler } from '../../tools/harness.js';
import { GRADERS } from '../graders/index.js';

// Design Component 13 (harness/evals/), R1 AC5, R5 AC1: this task ships the spec's
// remaining two seed cases — closeout-landing-root, closeout-reversing-proposal —
// alongside task 11's drafter-test-seam-label, test-author-precommit-hook and
// test-author-trailer, so cases.test.ts now validates all five cases under
// harness/evals/ without a model: the id is listed, loadCase succeeds, the role file
// exists, the fixture builds, every brief renders with no missing key, and every
// named grader resolves in the registry (design Testing Strategy, "Case validation
// (src/evals/__tests__/cases.test.ts, R1 AC5)"). For a close-out case the batch
// brief's rendered text must also name the rendered closeout-standing brief's own
// path (design Component 3 post-condition 2, "closeout-batch's standing names the
// rendered closeout-standing"; tasks.md task 12 Prompt, "render closeout-standing
// then closeout-batch with standing wired"). Each test reaches the module only
// through loadCase/buildFixture/renderCaseBriefs/listCaseIds, never a case.json parsed
// by hand. R5 AC3 and R5 AC4's live/base results are a pending verification-evidence.md
// check, not asserted here.

const SEED_IDS = [
  'closeout-landing-root',
  'closeout-reversing-proposal',
  'drafter-test-seam-label',
  'test-author-precommit-hook',
  'test-author-trailer',
];
const REPO_ROOT = resolve(casesRoot(), '..', '..');

describe('the seed cases (design Component 13)', () => {
  // Pre-condition: harness/evals/ holds exactly the five case directories this spec
  // ships (task 11's three plus this task's two close-out cases), each with a
  // case.json.
  // Test: listCaseIds().
  // Observable result: the returned array equals the five seed ids, sorted.
  // Expected-value source: tasks.md task 12 Prompt, "listCaseIds() returns exactly the
  // five seed ids"; requirements.md R5 AC1 (the cases this spec ships).
  it('lists exactly the five seed case ids', () => {
    expect(listCaseIds()).toEqual([...SEED_IDS].sort());
  });

  for (const id of SEED_IDS) {
    // Pre-condition: harness/evals/<id>/case.json names a role with a registered report
    // schema, a fixture whose commit trees exist on disk under the case directory, and
    // only graders registered in GRADERS. For a close-out case, its briefs list a
    // `closeout-standing` entry before a `closeout-batch` entry whose `wire` map points
    // `standing` at it.
    // Test: loadCase(id), then buildFixture(c, caseDir) and renderCaseBriefs(c, f,
    // scratch, harnessHandler) on the loaded case.
    // Observable result: loadCase returns without throwing; harness/agents/<role>.md
    // exists on disk; buildFixture returns a Fixture without throwing; renderCaseBriefs
    // resolves every brief the case names (one rendered text per brief template) without
    // throwing RenderError; every grader name the case lists is a key of GRADERS; for a
    // close-out case, the rendered `closeout-batch` text names the rendered
    // `closeout-standing` brief's own absolute path.
    // Expected-value source: design.md Testing Strategy, "Case validation
    // (src/evals/__tests__/cases.test.ts, R1 AC5): every case loads, its role file
    // exists, its fixture builds, every brief renders with no missing key, every grader
    // resolves. No model."; tasks.md task 11 Prompt (the per-id checklist); design.md
    // Component 3 post-condition 2 and tasks.md task 12 Prompt (the standing-wired
    // check for a close-out case).
    it(`${id}: loads, its role file exists, its fixture builds, its briefs render, its graders resolve`, async () => {
      const caseDir = join(casesRoot(), id);

      const c = loadCase(id);

      expect(existsSync(join(REPO_ROOT, 'harness', 'agents', `${c.role}.md`))).toBe(true);

      const f = buildFixture(c, caseDir);
      const scratch = mkdtempSync(join(tmpdir(), `eval-cases-scratch-${id}-`));
      try {
        const { texts } = await renderCaseBriefs(c, f, scratch, harnessHandler);
        expect(Object.keys(texts).length).toBe(c.briefs.length);

        for (const grader of c.graders) {
          expect(GRADERS[grader.name]).toBeDefined();
        }

        if (c.phase === 'closeout') {
          const standingEntry = c.briefs.find((b) => b.template === 'closeout-standing');
          expect(standingEntry).toBeDefined();
          const standingPath = resolve(join(scratch, standingEntry!.file));
          expect(texts['closeout-batch']).toContain(standingPath);
        }
      } finally {
        disposeFixture(f);
        rmSync(scratch, { recursive: true, force: true });
      }
    });
  }
});
