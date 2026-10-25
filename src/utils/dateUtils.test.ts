import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getCalendarDaysElapsed,
  isValidDateString,
  parseDateString,
  parseLocalDateString,
} from './dateUtils';

test('counts Day 0 and following local calendar days consistently', () => {
  const dayZero = parseLocalDateString('2026-10-13');
  const dayOne = parseLocalDateString('2026-10-14');
  assert.equal(getCalendarDaysElapsed('2026-10-13', dayZero), 0);
  assert.equal(getCalendarDaysElapsed('2026-10-13', dayOne), 1);
});

test('rejects malformed and impossible dates', () => {
  assert.equal(isValidDateString('2026-02-30'), false);
  assert.equal(isValidDateString('13-10-2026'), false);
  assert.throws(() => parseDateString('2026-02-30'), RangeError);
});

test('parses a date-only value without shifting its local calendar fields', () => {
  const parsed = parseLocalDateString('2026-10-13');
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 9);
  assert.equal(parsed.getDate(), 13);
});
