// Run: deno test --node-modules-dir=none --no-lock --allow-env supabase/functions
import assert from 'node:assert/strict';
import { fakeHabitsDb, fakeHealthDb } from '../_shared/fakes.ts';
import { day } from '../_shared/health/normalise.ts';
import type { Who } from '../_shared/health/db.ts';
import type { SourceId } from '../_shared/health/types.ts';
import { meets as clientMeets, type Rule as ClientRule } from '../../../src/components/strandparken/lib/habits/rules.ts';
import { completeHabits, evaluateHabits, meets, mergeDays, type Rule } from './habits.ts';

const NOW = new Date('2026-11-20T06:30:00Z'); // 07:30 on 2026-11-20 in Copenhagen
const RANGE = { from: '2026-11-13', to: '2026-11-20' };
const camilla: Who = { householdId: 'h1', person: 'a' };
const jonas: Who = { householdId: 'h1', person: 'b' };
const steps8000: Rule = { metric: 'steps', op: '>=', threshold: 8000 };

function setup() {
  const health = fakeHealthDb(() => NOW.getTime());
  const db = fakeHabitsDb(health);
  const addHabit = (who: Who, rule: Rule, id = `${who.person}-${db.habits.length}`, createdAt = '2026-11-01T10:00:00Z') => {
    db.habits.push({ ...who, id, rule, createdAt });
    return id;
  };
  const addDay = (who: Who, date: string, values: Parameters<typeof day>[2], source: SourceId = 'oura') =>
    health.upsertDays(who, [day(source, date, values, NOW)]);
  return { health, db, addHabit, addDay };
}

Deno.test('8 200 steps completes an "8.000 skridt" habit, 7 900 does not', async () => {
  const { db, addHabit, addDay } = setup();
  const id = addHabit(camilla, steps8000);
  await addDay(camilla, '2026-11-19', { steps: 8200 });
  await addDay(camilla, '2026-11-18', { steps: 7900 });
  assert.equal(await evaluateHabits(db, camilla, RANGE, NOW), 1);
  assert.deepEqual(db.completions, [{ householdId: 'h1', habitId: id, date: '2026-11-19', person: 'a' }]);
});

Deno.test('every day in the range that meets the rule gets a completion, today included', async () => {
  const { db, addHabit, addDay } = setup();
  addHabit(camilla, steps8000);
  for (const d of ['2026-11-13', '2026-11-17', '2026-11-20']) await addDay(camilla, d, { steps: 9000 });
  await addDay(camilla, '2026-11-12', { steps: 9000 }); // before the range
  assert.equal(await evaluateHabits(db, camilla, RANGE, NOW), 3);
  assert.deepEqual(db.completions.map((c) => c.date), ['2026-11-13', '2026-11-17', '2026-11-20']);
});

Deno.test('running again adds nothing (idempotent)', async () => {
  const { db, addHabit, addDay } = setup();
  addHabit(camilla, steps8000);
  await addDay(camilla, '2026-11-19', { steps: 8200 });
  assert.equal(await evaluateHabits(db, camilla, RANGE, NOW), 1);
  assert.equal(await evaluateHabits(db, camilla, RANGE, NOW), 0);
  assert.equal(db.completions.length, 1);
});

Deno.test('missing data completes nothing, and zero is not a hidden pass', async () => {
  const { db, addHabit, addDay } = setup();
  addHabit(camilla, { metric: 'sleep_score', op: '>', threshold: 75 });
  addHabit(camilla, { metric: 'steps', op: '>=', threshold: 0 }, 'zero-ok');
  await addDay(camilla, '2026-11-19', { steps: null, sleep_score: null });
  assert.equal(await evaluateHabits(db, camilla, RANGE, NOW), 0);
  await addDay(camilla, '2026-11-18', { steps: 0 });
  assert.equal(await evaluateHabits(db, camilla, RANGE, NOW), 1, 'only the >= 0 rule, because zero steps is data');
});

Deno.test('a later, lower value does not remove a completion', async () => {
  const { db, addHabit, addDay } = setup();
  addHabit(camilla, steps8000);
  await addDay(camilla, '2026-11-20', { steps: 8100 });
  await evaluateHabits(db, camilla, RANGE, NOW);
  await addDay(camilla, '2026-11-20', { steps: 100 }); // the source corrected the day
  assert.equal(await evaluateHabits(db, camilla, RANGE, NOW), 0);
  assert.equal(db.completions.length, 1);
});

Deno.test('never the future, and never before the habit was created', async () => {
  const { db, addHabit, addDay } = setup();
  const id = addHabit(camilla, steps8000, 'late', '2026-11-18T10:00:00Z');
  for (const d of ['2026-11-16', '2026-11-18', '2026-11-19', '2026-11-21']) await addDay(camilla, d, { steps: 9000 });
  assert.equal(await evaluateHabits(db, camilla, { from: '2026-11-13', to: '2026-11-22' }, NOW), 2);
  assert.deepEqual(db.completions.map((c) => `${c.habitId} ${c.date}`), [`${id} 2026-11-18`, `${id} 2026-11-19`]);
});

Deno.test('a habit created just after midnight in Copenhagen counts from that Copenhagen date', async () => {
  const { db, addHabit, addDay } = setup();
  addHabit(camilla, steps8000, 'night', '2026-11-18T23:30:00Z'); // 00:30 on the 19th
  await addDay(camilla, '2026-11-18', { steps: 9000 });
  await addDay(camilla, '2026-11-19', { steps: 9000 });
  assert.equal(await evaluateHabits(db, camilla, RANGE, NOW), 1);
  assert.equal(db.completions[0].date, '2026-11-19');
});

Deno.test('only the person\'s own habits are completed, from their own data', async () => {
  const { db, addHabit, addDay } = setup();
  addHabit(camilla, steps8000, 'cam');
  const jon = addHabit(jonas, steps8000, 'jon');
  await addDay(camilla, '2026-11-19', { steps: 9000 });
  await addDay(jonas, '2026-11-19', { steps: 100 });
  assert.equal(await evaluateHabits(db, jonas, RANGE, NOW), 0, 'Jonas walked 100 steps; Camilla\'s data is not his');
  assert.equal(await evaluateHabits(db, camilla, RANGE, NOW), 1);
  assert.deepEqual(db.completions.map((c) => [c.habitId, c.person]), [['cam', 'a']]);
  assert.ok(jon);
});

Deno.test('no automatic habits means no reads of health data', async () => {
  const { db } = setup();
  assert.equal(await evaluateHabits(db, camilla, RANGE, NOW), 0);
});

Deno.test('activity_progress >= 1 is "Aktivitetsmål nået"', async () => {
  const { db, addHabit, addDay } = setup();
  addHabit(camilla, { metric: 'activity_progress', op: '>=', threshold: 1 });
  await addDay(camilla, '2026-11-19', { activity_progress: 1.2, activity_goal: 500, activity_goal_unit: 'kcal' });
  await addDay(camilla, '2026-11-18', { activity_progress: 0.9, activity_goal: 500, activity_goal_unit: 'kcal' });
  assert.equal(await evaluateHabits(db, camilla, RANGE, NOW), 1);
  assert.equal(db.completions[0].date, '2026-11-19');
});

Deno.test('two sources: the first with a value wins, per metric (oura, garmin, manual)', () => {
  const merged = mergeDays([
    { date: '2026-11-19', source: 'garmin', steps: 9000, sleep_score: 60 },
    { date: '2026-11-19', source: 'oura', steps: null, sleep_score: 80 },
    { date: '2026-11-18', source: 'garmin', steps: 5000 },
    { date: '2026-11-18', source: 'oura', steps: 2000 },
  ]);
  assert.deepEqual(merged.get('2026-11-19'), { sleep_score: 80, steps: 9000 });
  assert.deepEqual(merged.get('2026-11-18'), { steps: 2000 });
});

Deno.test('completeHabits never throws: a habit problem does not fail the health sync', async () => {
  const { db, addHabit } = setup();
  addHabit(camilla, steps8000);
  db.broken = true;
  const log = console.error;
  console.error = () => {};
  try {
    assert.equal(await completeHabits(db, camilla, RANGE, NOW), 0);
  } finally {
    console.error = log;
  }
});

Deno.test('meets matches the client copy (rules.ts) on a grid of values, ops and thresholds', () => {
  const values = [null, undefined, Number.NaN, -1, 0, 0.5, 0.999, 1, 1.4, 74, 75, 76, 7999, 8000, 8001];
  const metrics = ['steps', 'sleep_score', 'activity_progress'] as const;
  for (const metric of metrics) {
    for (const op of ['>=', '>'] as const) {
      for (const threshold of [0, 1, 75, 8000]) {
        for (const v of values) {
          const rule = { metric, op, threshold };
          const dayValues = { [metric]: v };
          assert.equal(meets(rule, dayValues), clientMeets(rule as ClientRule, dayValues), JSON.stringify({ rule, v }));
        }
      }
    }
  }
});
