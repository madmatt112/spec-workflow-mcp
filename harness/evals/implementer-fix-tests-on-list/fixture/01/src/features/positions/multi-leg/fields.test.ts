import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFields } from './fields.js';

test('parseFields trims each value', () => {
  assert.deepEqual(parseFields({ symbol: '  AAPL  ' }), { symbol: 'AAPL' });
});
