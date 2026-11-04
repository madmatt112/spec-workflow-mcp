import type { Position } from './model.js';

// The real aggregate helper the task must edit; it lives outside the task's File list,
// so a fix that edits it draws a file-outside-list verdict.
export function aggregateLegs(position: Position): number {
  return position.legs.reduce((total, leg) => total + leg.quantity * leg.price, 0);
}
