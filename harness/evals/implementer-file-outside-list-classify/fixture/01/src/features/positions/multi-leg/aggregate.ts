import type { Position } from './model.js';

// The real aggregate helper the task must edit; it lives outside the task's File list,
// so a fix that edits it draws a file-outside-list verdict.
//
// This comment still names the removed `oldAggregate` symbol, so a root-walking scrub
// grep over the feature root (FE_ROOT) for `oldAggregate` matches here too — and this
// file is off the task's File list, so scrubbing the comment is also off-list.
export function aggregateLegs(position: Position): number {
  return position.legs.reduce((total, leg) => total + leg.quantity * leg.price, 0);
}
