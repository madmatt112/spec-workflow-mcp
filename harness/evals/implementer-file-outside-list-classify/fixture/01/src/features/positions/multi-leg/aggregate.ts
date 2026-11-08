import type { Position } from './model.js';

// Sums a position's legs into one total.
export function oldAggregate(position: Position): number {
  return position.legs.reduce((total, leg) => total + leg.quantity * leg.price, 0);
}
