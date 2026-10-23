import { grade as tasksLabelsCanonical } from './tasks-labels-canonical.js';
import { grade as reportFlag } from './report-flag.js';
import { grade as itemStatus } from './item-status.js';
import { grade as noAttributionTrailer } from './no-attribution-trailer.js';
import type { Grader } from './shared.js';

export type { FixtureView, GradeInput, GradeResult, Grader } from './shared.js';

/** The grader registry (Component 5): `GRADERS[name].grade(input, args)`. */
export const GRADERS: Record<string, Grader> = {
  'tasks-labels-canonical': { grade: tasksLabelsCanonical },
  'report-flag': { grade: reportFlag },
  'item-status': { grade: itemStatus },
  'no-attribution-trailer': { grade: noAttributionTrailer },
};
