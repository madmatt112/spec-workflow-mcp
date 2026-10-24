import { grade as tasksLabelsCanonical } from './tasks-labels-canonical.js';
import { grade as reportFlag } from './report-flag.js';
import { grade as itemStatus } from './item-status.js';
import { grade as noAttributionTrailer } from './no-attribution-trailer.js';
import { grade as noNewCommit } from './no-new-commit.js';
import { grade as cleanTree } from './clean-tree.js';
import { grade as newCommitCount } from './new-commit-count.js';
import { grade as repoUnchanged } from './repo-unchanged.js';
import { grade as itemCommitOnBranch } from './item-commit-on-branch.js';
import { grade as noCommitTouches } from './no-commit-touches.js';
import type { Grader } from './shared.js';

export type { FixtureView, GradeInput, GradeResult, Grader } from './shared.js';

/** The grader registry (Component 5): `GRADERS[name].grade(input, args)`. */
export const GRADERS: Record<string, Grader> = {
  'tasks-labels-canonical': { grade: tasksLabelsCanonical },
  'report-flag': { grade: reportFlag },
  'item-status': { grade: itemStatus },
  'no-attribution-trailer': { grade: noAttributionTrailer },
  'no-new-commit': { grade: noNewCommit },
  'clean-tree': { grade: cleanTree },
  'new-commit-count': { grade: newCommitCount },
  'repo-unchanged': { grade: repoUnchanged },
  'item-commit-on-branch': { grade: itemCommitOnBranch },
  'no-commit-touches': { grade: noCommitTouches },
};
