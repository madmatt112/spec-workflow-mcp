import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFields } from './fields.js';

// Author red test. The expected value below carries a trailing space the real helper must
// not produce, so the implementer must amend this assertion while making the test green —
// and report the amended author test file.
test('parseFields trims each value', () => {
  assert.deepEqual(parseFields({ symbol: '  AAPL  ' }), { symbol: 'AAPL ' });
});
