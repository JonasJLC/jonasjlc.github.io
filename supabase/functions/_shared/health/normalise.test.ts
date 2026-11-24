// Run: deno test --node-modules-dir=none --no-lock --allow-env supabase/functions
import assert from 'node:assert/strict';
import { addDays, copenhagenDate, copenhagenHour, count, cycleDay, day, goal, hasValues, isIsoDate, progress, score } from './normalise.ts';

const at = new Date('2026-11-20T06:00:00Z');

Deno.test('out-of-range values become null, never 0', () => {
  assert.equal(score(82), 82);
  assert.equal(score(101), null);
  assert.equal(score(-1), null);
  assert.equal(score('80'), null);
  assert.equal(score(null), null);
  assert.equal(count(9000.4), 9000);
  assert.equal(count(-5), null);
  assert.equal(count(500_000), null);
  assert.equal(goal(0), null);
  assert.equal(goal(10_000), 10_000);
});

Deno.test('a provider 0 sleep score (no sleep recorded) becomes null', () => {
  assert.equal(score(0), null);
  assert.equal(day('oura', '2026-11-20', { sleep_score: 0 }, at).sleep_score, null);
});

Deno.test('progress is done / goal, may exceed 1, and is null for a goal of 0 or less', () => {
  assert.equal(progress(250, 500), 0.5);
  assert.equal(progress(750, 500), 1.5);
  assert.equal(progress(1, 3), 0.333);
  assert.equal(progress(100, 0), null);
  assert.equal(progress(100, -5), null);
  assert.equal(progress(null, 500), null);
});

Deno.test('cycle day: start day is 1, no start gives null, more than 60 days gives null', () => {
  assert.equal(cycleDay('2026-11-20', ['2026-11-20']), 1);
  assert.equal(cycleDay('2026-11-20', ['2026-11-01', '2026-10-01']), 20);
  assert.equal(cycleDay('2026-11-20', []), null);
  assert.equal(cycleDay('2026-11-20', ['2026-11-21']), null);
  assert.equal(cycleDay('2026-11-20', ['2026-09-21']), null); // day 61
  assert.equal(cycleDay('2026-11-20', ['2026-09-22']), 60);
  assert.equal(cycleDay('2026-03-30', ['2026-03-29']), 2); // across the DST change
});

Deno.test('dates are Copenhagen calendar days', () => {
  assert.equal(copenhagenDate(new Date('2026-11-19T23:30:00Z')), '2026-11-20');
  assert.equal(copenhagenDate(new Date('2026-07-19T22:30:00Z')), '2026-07-20');
  assert.equal(copenhagenHour(new Date('2026-11-20T06:30:00Z')), 7);
  assert.equal(copenhagenHour(new Date('2026-07-20T05:30:00Z')), 7);
  assert.equal(addDays('2026-11-20', -7), '2026-11-13');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(isIsoDate('2026-11-20'), true);
  assert.equal(isIsoDate('2026-02-30'), false);
  assert.equal(isIsoDate('20-11-2026'), false);
});

Deno.test('a day keeps a unit only with a goal, and an empty day has no values', () => {
  const d = day('garmin', '2026-11-20', { activity_goal_unit: 'steps', steps: 4000 }, at);
  assert.equal(d.activity_goal_unit, null);
  assert.equal(d.last_synced_at, at.toISOString());
  assert.equal(hasValues(d), true);
  assert.equal(hasValues(day('oura', '2026-11-20', {}, at)), false);
});
