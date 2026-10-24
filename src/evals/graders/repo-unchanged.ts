import { grade as gradeNoNewCommit } from './no-new-commit.js';
import { grade as gradeCleanTree } from './clean-tree.js';
import type { GradeInput, GradeResult } from './shared.js';

/** Passes when `repo`'s HEAD equals its base and the tree is clean (Component 5). */
export function grade(input: GradeInput, args: Record<string, unknown>): GradeResult {
  const noNewCommit = gradeNoNewCommit(input, args);
  if (!noNewCommit.pass) {
    return noNewCommit;
  }
  const cleanTree = gradeCleanTree(input, args);
  if (!cleanTree.pass) {
    return cleanTree;
  }
  return { pass: true, reason: `${String(args.repo)} is unchanged from its base` };
}
