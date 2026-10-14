import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDue } from '../lib.js';

test('no date, before default time -> today', () => {
  assert.equal(resolveDue({ now: new Date(2026, 9, 12, 10, 0) }), '2026-10-12 20:30');
});
test('no date, after default time -> tomorrow', () => {
  assert.equal(resolveDue({ now: new Date(2026, 9, 12, 21, 0) }), '2026-10-13 20:30');
});
test('exactly at time -> tomorrow', () => {
  assert.equal(resolveDue({ now: new Date(2026, 9, 12, 20, 30) }), '2026-10-13 20:30');
});
test('month rollover', () => {
  assert.equal(resolveDue({ time: '08:00', now: new Date(2026, 9, 31, 9, 0) }), '2026-11-01 08:00');
});
test('explicit date and time', () => {
  assert.equal(resolveDue({ date: '2026-12-01', time: '07:15' }), '2026-12-01 07:15');
});
test('bad inputs rejected', () => {
  assert.throws(() => resolveDue({ time: '8:30pm' }));
  assert.throws(() => resolveDue({ time: '24:00' }));
  assert.throws(() => resolveDue({ date: '2026/12/01' }));
});
