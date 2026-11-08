export interface Leg {
  quantity: number;
  price: number;
}

export interface Position {
  legs: Leg[];
}

export { aggregateLegs } from './aggregate.js';
