import test from 'node:test';
import assert from 'node:assert/strict';
import { forecast, checkReading, replaceMeter, Cycle } from './forecast';

const base: Cycle = { opening: { date: '2026-10-01', value: 1000 }, readings: [], endDate: '2026-10-31', carriedUnits: 0 };
const withR = (c: Cycle, date: string, value: number): Cycle => ({ ...c, readings: [...c.readings, { date, value }] });

test('no readings -> asks for one', () => {
  assert.deepEqual(forecast(base, '2026-10-10'), { ok: false, reason: 'no-readings' });
});
test('projection: 100 units in 10 days, 20 days left -> 300', () => {
  const f = forecast(withR(base, '2026-10-11', 1100), '2026-10-11');
  assert.ok(f.ok); assert.equal(f.used, 100); assert.equal(f.projected, 300); assert.equal(f.status, 'over-risk');
  assert.equal(f.confidence, 'Medium'); assert.equal(f.dailyBudget, 5);
});
test('exactly 200 projected is not over; upper range makes it watch', () => {
  const f = forecast(withR(base, '2026-10-16', 1100), '2026-10-16'); // 100 used in 15d, 15 left -> 200
  assert.ok(f.ok); assert.equal(f.projected, 200); assert.equal(f.status, 'watch');
});
test('safe when the upper range stays under 200', () => {
  const f = forecast(withR(base, '2026-10-16', 1050), '2026-10-16');
  assert.ok(f.ok); assert.equal(f.projected, 100); assert.equal(f.status, 'safe');
});
test('already over once used > 200, no budget', () => {
  const f = forecast(withR(base, '2026-10-20', 1210), '2026-10-20');
  assert.ok(f.ok); assert.equal(f.status, 'already-over'); assert.equal(f.dailyBudget, null);
});
test('early cycle is Low; stale reading is flagged and downgraded', () => {
  const e = forecast(withR(base, '2026-10-04', 1030), '2026-10-04'); assert.ok(e.ok); assert.equal(e.confidence, 'Low');
  const s = forecast(withR(base, '2026-10-11', 1060), '2026-10-25'); assert.ok(s.ok); assert.equal(s.outdated, true); assert.equal(s.confidence, 'Low');
});
test('same-day reading cannot give a rate', () => {
  assert.deepEqual(forecast(withR(base, '2026-10-01', 1005), '2026-10-01'), { ok: false, reason: 'same-day' });
});
test('validation', () => {
  const c = withR(base, '2026-10-10', 1100);
  assert.equal(checkReading(c, { date: '2026-10-12', value: 1150 }, '2026-10-12').ok, true);
  const lower = checkReading(c, { date: '2026-10-12', value: 900 }, '2026-10-12');
  assert.ok(!lower.ok && lower.kind === 'lower');
  const fut = checkReading(c, { date: '2026-11-20', value: 1500 }, '2026-10-12');
  assert.ok(!fut.ok && fut.kind === 'future');
  const bad = checkReading(c, { date: '2026-02-31', value: 1200 }, '2026-10-12');
  assert.ok(!bad.ok && bad.kind === 'invalid');
  const neg = checkReading(c, { date: '2026-10-12', value: -5 }, '2026-10-12');
  assert.ok(!neg.ok && neg.kind === 'invalid');
});
test('meter replacement: new baseline, old units carried, meters never subtracted', () => {
  const c = withR(base, '2026-10-10', 1090);
  const r = replaceMeter(c, 1095, { date: '2026-10-12', value: 3 });
  assert.equal(r.opening.value, 3); assert.equal(r.carriedUnits, 95); assert.equal(r.readings.length, 0);
  const f = forecast(withR(r, '2026-10-22', 53), '2026-10-22'); // 50 on new meter in 10d, 9 left
  assert.ok(f.ok); assert.equal(f.used, 145); assert.equal(f.projected, 145 + 5 * 9);
});
