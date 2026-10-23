import { describe, it, expect } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { loadCase, listCaseIds, casesRoot } from '../case.js';
import { buildFixture, disposeFixture } from '../fixture.js';
import { renderCaseBriefs } from '../render.js';
import { harnessHandler } from '../../tools/harness.js';
import { GRADERS } from '../graders/index.js';

// Design Component 13 (harness/evals/), R1 AC5, R5 AC1: this task ships three of the
// spec's five seed cases — drafter-test-seam-label, test-author-precommit-hook,
// test-author-trailer — and cases.test.ts validates every case under harness/evals/
// without a model: the id is listed, loadCase succeeds, the role file exists, the
// fixture builds, every brief renders with no missing key, and every named grader
// resolves in the registry (design Testing Strategy, "Case validation
// (src/evals/__tests__/cases.test.ts, R1 AC5)"). Each test reaches the module only
// through loadCase/buildFixture/renderCaseBriefs/listCaseIds, never a case.json parsed
// by hand. R5 AC4's base pass of the two test-author cases through a live step is a
// pending verification-evidence.md check, not asserted here.

const SEED_IDS = ['drafter-test-seam-label', 'test-author-precommit-hook', 'test-author-trailer'];
const REPO_ROOT = resolve(casesRoot(), '..', '..');

describe('the seed cases (design Component 13)', () => {
  // Pre-condition: harness/evals/ holds at least the three case directories this task
  // ships, each with a case.json.
  // Test: listCaseIds().
  // Observable result: the returned array contains all three seed ids.
  // Expected-value source: tasks.md task 11 Prompt, "it also asserts the three ids are
  // listed"; requirements.md R5 AC1 (the cases this spec ships).
  it('lists all three seed case ids', () => {
    expect(listCaseIds()).toEqual(expect.arrayContaining(SEED_IDS));
  });

  for (const id of SEED_IDS) {
    // Pre-condition: harness/evals/<id>/case.json names a role with a registered report
    // schema, a fixture whose commit trees exist on disk under the case directory, and
    // only graders registered in GRADERS.
    // Test: loadCase(id), then buildFixture(c, caseDir) and renderCaseBriefs(c, f,
    // scratch, harnessHandler) on the loaded case.
    // Observable result: loadCase returns without throwing; harness/agents/<role>.md
    // exists on disk; buildFixture returns a Fixture without throwing; renderCaseBriefs
    // resolves every brief the case names (one rendered text per brief template) without
    // throwing RenderError; every grader name the case lists is a key of GRADERS.
    // Expected-value source: design.md Testing Strategy, "Case validation
    // (src/evals/__tests__/cases.test.ts, R1 AC5): every case loads, its role file
    // exists, its fixture builds, every brief renders with no missing key, every grader
    // resolves. No model."; tasks.md task 11 Prompt (the per-id checklist).
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
      } finally {
        disposeFixture(f);
        rmSync(scratch, { recursive: true, force: true });
      }
    });
  }
});
