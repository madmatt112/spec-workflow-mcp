import { describe, it, expect, vi } from 'vitest';
import { computeFolds } from '../project-folding.js';
import type { FoldCandidate } from '../project-folding.js';

// Contract for src/dashboard/project-folding.ts (design.md C2; task 2 _Prompt;
// Requirements 1.1, 1.2, 1.3, 1.9). Reached only through
// computeFolds(candidates, classify, onError?).
//
// Criterion "AC1 folds into the main-tree parent":
//   Pre-condition: a linked worktree candidate whose classified mainTree
//   equals another candidate's projectPath, and that candidate's
//   workflowRootPath equals the worktree's own workflowRootPath.
//   Test: computeFolds([main, worktree], classify).
//   Observable result: the Map has worktree.projectId -> main.projectId;
//   classify was called exactly once, with the worktree's projectPath.
//   Expected-value source: design C2 post-condition 3 ("folds there (R1
//   AC1)"); the _Prompt's AC1 success line.
//
// Criterion "AC2 folds into the store's own project":
//   Pre-condition: a linked worktree whose classified mainTree matches no
//   candidate, and a candidate's projectPath and workflowRootPath both equal
//   the worktree's workflowRootPath.
//   Test: computeFolds([store, worktree], classify).
//   Observable result: the Map has worktree.projectId -> store.projectId.
//   Expected-value source: design C2 post-condition 3 ("else ... folds there
//   (R1 AC2)"); the _Prompt's AC2 success line.
//
// Criterion "AC2 is refused when that project's workflowRootPath differs":
//   Pre-condition: as above, but the path-matching candidate's own
//   workflowRootPath differs from the worktree's workflowRootPath (a
//   different store), and that candidate is itself not linked.
//   Test: computeFolds([otherStore, worktree], classify).
//   Observable result: the Map has no entry for the worktree.
//   Expected-value source: requirements.md R1 AC2 ("a listed project has a
//   workspace equal to the entry's workflow root AND a workflow root equal
//   to the entry's workflow root", v2's R1-5 close of the wrong-store fold);
//   the _Prompt's matching success line.
//
// Criterion "AC3 leaves a worktree with no parent unfolded":
//   Pre-condition: a linked worktree matching neither AC1 nor AC2.
//   Test: computeFolds([worktree], classify).
//   Observable result: the Map has no entry for the worktree.
//   Expected-value source: design C2 post-condition 3 ("else it is not in
//   the map (R1 AC3)").
//
// Criterion "AC9 — a separate-store main checkout that classify calls not
// linked is not folded":
//   Pre-condition: a candidate whose two paths differ (so classify runs) but
//   classify reports it not linked, even though another candidate's paths
//   would otherwise satisfy AC2's parent test exactly.
//   Test: computeFolds([temptingParent, mainCheckout], classify).
//   Observable result: the Map has no entry for the checkout; classify was
//   called with its projectPath.
//   Expected-value source: requirements.md R1 AC9; design C2 post-condition 2
//   ("Parents are drawn only from candidates that are not linked worktrees"),
//   which gates the AC1/AC2 tests on linkage before any path comparison.
//
// Criterion "a linked candidate is never a parent":
//   Pre-condition: candidate P's own projectPath and workflowRootPath are
//   exactly what AC1 needs to treat it as a parent of candidate C (P.path ==
//   C.mainTree, P.workflowRootPath == C.workflowRootPath), but P is itself a
//   linked worktree.
//   Test: computeFolds([child, p], classify).
//   Observable result: the Map has no entry for C.
//   Expected-value source: design C2 post-condition 2 ("so a linked worktree
//   never becomes a parent and folds never chain").
//
// Criterion "classify is not called for an equal-path candidate":
//   Pre-condition: a candidate whose projectPath equals its workflowRootPath.
//   Test: computeFolds([plain], classify).
//   Observable result: classify was never invoked.
//   Expected-value source: design C2 post-condition 1 ("never when they are
//   equal"); the _Prompt body ("never for equal paths").
//
// Criterion "a throw leaves the entry unfolded and reaches onError":
//   Pre-condition: a linked-path candidate whose classify call throws.
//   Test: computeFolds([worktree], classify, onError).
//   Observable result: the Map has no entry for the candidate; onError was
//   called once with its projectId and the thrown error.
//   Expected-value source: design C2 post-condition 4; the _Prompt body
//   ("the candidate is not in the map and the optional trailing onError gets
//   its id and the error").

function candidate(projectId: string, projectPath: string, workflowRootPath: string): FoldCandidate {
  return { projectId, projectPath, workflowRootPath };
}

describe('computeFolds', () => {
  it('folds a linked worktree into the parent whose project path is its main tree (AC1)', () => {
    const main = candidate('main', '/repo/main', '/repo/main');
    const worktree = candidate('wt', '/repo/wt', '/repo/main');
    const classify = vi.fn((workspacePath: string) => {
      if (workspacePath === worktree.projectPath) {
        return { linked: true, mainTree: main.projectPath };
      }
      throw new Error(`unexpected classify call: ${workspacePath}`);
    });

    const folds = computeFolds([main, worktree], classify);

    expect(folds.get('wt')).toBe('main');
    expect(classify).toHaveBeenCalledTimes(1);
    expect(classify).toHaveBeenCalledWith(worktree.projectPath);
  });

  it("folds a linked worktree into the store's own project when no main-tree parent matches (AC2)", () => {
    const store = candidate('store', '/repo/store', '/repo/store');
    const worktree = candidate('wt', '/repo/wt', '/repo/store');
    const classify = vi.fn((workspacePath: string) => {
      if (workspacePath === worktree.projectPath) {
        return { linked: true, mainTree: '/no/such/path' };
      }
      throw new Error(`unexpected classify call: ${workspacePath}`);
    });

    const folds = computeFolds([store, worktree], classify);

    expect(folds.get('wt')).toBe('store');
  });

  it('refuses the AC2 fallback when the path-matching project is on a different store', () => {
    const otherStore = candidate('other', '/repo/store', '/repo/other-root');
    const worktree = candidate('wt', '/repo/wt', '/repo/store');
    const classify = vi.fn((workspacePath: string) => {
      if (workspacePath === worktree.projectPath) {
        return { linked: true, mainTree: '/no/such/path' };
      }
      // otherStore: not linked, so it is parent-eligible by linkage alone —
      // isolating the workflowRootPath mismatch as the reason it is refused.
      return { linked: false, mainTree: null };
    });

    const folds = computeFolds([otherStore, worktree], classify);

    expect(folds.has('wt')).toBe(false);
  });

  it('leaves a worktree with no matching parent unfolded (AC3)', () => {
    const worktree = candidate('wt', '/repo/wt', '/repo/store');
    const classify = vi.fn(() => ({ linked: true, mainTree: '/no/such/path' }));

    const folds = computeFolds([worktree], classify);

    expect(folds.has('wt')).toBe(false);
  });

  it('does not fold a separate-store main checkout that classify reports as not linked (AC9)', () => {
    // A tempting AC2 match: a candidate whose projectPath and workflowRootPath
    // both equal the checkout's workflowRootPath, exactly satisfying AC2's
    // parent test on paths alone.
    const temptingParent = candidate('parent', '/hosted/store', '/hosted/store');
    const mainCheckout = candidate('tradr', '/hosted/code', '/hosted/store');
    const classify = vi.fn((workspacePath: string) => {
      if (workspacePath === mainCheckout.projectPath) {
        return { linked: false, mainTree: null };
      }
      throw new Error(`unexpected classify call: ${workspacePath}`);
    });

    const folds = computeFolds([temptingParent, mainCheckout], classify);

    expect(folds.has('tradr')).toBe(false);
    expect(classify).toHaveBeenCalledWith(mainCheckout.projectPath);
  });

  it("never treats a linked candidate as another candidate's parent", () => {
    const child = candidate('child', '/repo/wt-child', '/repo/store');
    const linkedPathMatch = candidate('p2', '/repo/p2main', '/repo/store');
    const classify = vi.fn((workspacePath: string) => {
      if (workspacePath === child.projectPath) {
        return { linked: true, mainTree: linkedPathMatch.projectPath };
      }
      if (workspacePath === linkedPathMatch.projectPath) {
        return { linked: true, mainTree: null };
      }
      throw new Error(`unexpected classify call: ${workspacePath}`);
    });

    const folds = computeFolds([child, linkedPathMatch], classify);

    expect(folds.has('child')).toBe(false);
  });

  it('never calls classify for an equal-path candidate', () => {
    const plain = candidate('plain', '/repo/plain', '/repo/plain');
    const classify = vi.fn(() => ({ linked: true, mainTree: '/irrelevant' }));

    computeFolds([plain], classify);

    expect(classify).not.toHaveBeenCalled();
  });

  it('leaves a candidate unfolded and reports the error when classify throws', () => {
    const worktree = candidate('wt', '/repo/wt', '/repo/main');
    const error = new Error('git exploded');
    const classify = vi.fn(() => {
      throw error;
    });
    const onError = vi.fn();

    const folds = computeFolds([worktree], classify, onError);

    expect(folds.has('wt')).toBe(false);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('wt', error);
  });
});
