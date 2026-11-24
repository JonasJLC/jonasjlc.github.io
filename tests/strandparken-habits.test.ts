import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  completionFromRow, dayRing, detailLine, doneBy, habitColors, habitFromRow, habitToRow, isDueOn, todayCount, validateHabitDraft,
  weekProgress, weekTarget, weeksInARow, type Completion, type Frequency, type Habit, type HabitDraft, type HabitRow,
} from '../src/components/strandparken/lib/habits/model.ts';
import { meets, suggestions, type Rule } from '../src/components/strandparken/lib/habits/rules.ts';

// 2026-11-23 is a Monday; 2026-11-25 a Wednesday.
const MON = '2026-11-23';
const WED = '2026-11-25';

let n = 0;
const habit = (h: Partial<Habit> = {}): Habit => ({
  id: `h${n++}`, owner: 'b', title: 'X', tracking: 'manual', frequency: { kind: 'daily' }, rule: null, color: 'sage', icon: null,
  reminderTime: null, archivedAt: null, createdAt: '2026-01-01T10:00:00Z', ...h,
});
const done = (h: Habit, date: string, by: 'a' | 'b' = 'b', source: Completion['source'] = 'manual'): Completion =>
  ({ habitId: h.id, date, completedBy: by, source });
const daily: Frequency = { kind: 'daily' };
const perWeek = (count: number): Frequency => ({ kind: 'per_week', count });
const weekdays = (...days: number[]): Frequency => ({ kind: 'weekdays', days });

test('weekTarget: daily 7, per week N, weekdays the number of days', () => {
  assert.equal(weekTarget(habit({ frequency: daily })), 7);
  assert.equal(weekTarget(habit({ frequency: perWeek(3) })), 3);
  assert.equal(weekTarget(habit({ frequency: weekdays(1, 3, 5) })), 3);
  assert.equal(weekTarget(habit({ frequency: weekdays(1, 1, 3) })), 2, 'duplicates count once');
});

test('weekTarget ignores when the habit was created: a mid-week habit still targets the whole week', () => {
  assert.equal(weekTarget(habit({ createdAt: '2026-11-26T08:00:00Z' })), 7);
});

test('isDueOn: daily every day, weekdays only those ISO days, per week never', () => {
  const d = habit({ frequency: daily });
  assert.ok(isDueOn(d, MON) && isDueOn(d, '2026-11-29'));
  const w = habit({ frequency: weekdays(1, 3) });
  assert.equal(isDueOn(w, MON), true);
  assert.equal(isDueOn(w, '2026-11-24'), false);
  assert.equal(isDueOn(w, WED), true);
  assert.equal(isDueOn(habit({ frequency: weekdays(7) }), '2026-11-29'), true, 'Sunday is 7');
  assert.equal(isDueOn(habit({ frequency: perWeek(2) }), MON), false);
});

test('weekProgress: dots fill from the left, only this week counts', () => {
  const h = habit({ frequency: perWeek(3) });
  assert.deepEqual(weekProgress(h, [], MON), { done: 0, target: 3, count: 0, dots: [false, false, false] });
  const cs = [done(h, MON), done(h, '2026-11-27'), done(h, '2026-11-22' /* last Sunday */), done(h, '2026-11-30' /* next Monday */)];
  assert.deepEqual(weekProgress(h, cs, MON), { done: 2, target: 3, count: 2, dots: [true, true, false] });
});

test('weekProgress: other habits do not count; more than the target caps done but keeps the true count', () => {
  const h = habit({ frequency: weekdays(1, 2) });
  const other = habit();
  const cs = [done(h, MON), done(h, '2026-11-24'), done(h, WED), done(other, WED)];
  assert.deepEqual(weekProgress(h, cs, MON), { done: 2, target: 2, count: 3, dots: [true, true] });
});

test('weekProgress: a day done twice (two rows) counts once', () => {
  const h = habit({ owner: 'both' });
  const cs = [done(h, MON, 'a'), done(h, MON, 'b')];
  assert.equal(weekProgress(h, cs, MON).count, 1);
});

test('weekProgress across the new year (ISO week 1 starts 29 Dec 2025)', () => {
  const h = habit({ frequency: daily });
  const cs = [done(h, '2025-12-31'), done(h, '2026-01-01'), done(h, '2026-01-04'), done(h, '2026-01-05')];
  assert.equal(weekProgress(h, cs, '2025-12-29').count, 3);
});

test('weekProgress across the daylight-saving change (29 March 2026)', () => {
  const h = habit({ frequency: daily });
  const cs = ['2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30'].map((d) => done(h, d));
  assert.equal(weekProgress(h, cs, '2026-03-23').count, 3);
  assert.equal(weekProgress(h, cs, '2026-03-30').count, 1);
});

test('detailLine: manual habits', () => {
  const d = habit({ frequency: daily });
  assert.equal(detailLine(d, weekProgress(d, [done(d, MON), done(d, WED), done(d, '2026-11-24')], MON), null), 'Hver dag · 3 af 7 denne uge');
  const p3 = habit({ frequency: perWeek(3) });
  assert.equal(detailLine(p3, weekProgress(p3, [done(p3, MON)], MON), null), '3 gange om ugen · 1 af 3 denne uge');
  const p1 = habit({ frequency: perWeek(1) });
  assert.equal(detailLine(p1, weekProgress(p1, [], MON), null), '1 gang om ugen · 0 af 1 denne uge');
  const w = habit({ frequency: weekdays(5, 1, 3) });
  assert.equal(detailLine(w, weekProgress(w, [done(w, MON), done(w, WED)], MON), null), 'Man, ons, fre · 2 af 3 denne uge');
});

test('detailLine: the text shows the capped count ("8 af 7" shows "7 af 7")', () => {
  const w = habit({ frequency: weekdays(1) });
  assert.equal(detailLine(w, weekProgress(w, [done(w, MON), done(w, WED)], MON), null), 'Man · 1 af 1 denne uge');
});

test('detailLine: automatic habits show the value only when it is visible', () => {
  const sleep = habit({ tracking: 'automatic', rule: { metric: 'sleep_score', op: '>', threshold: 75 } });
  const p = { done: 5, target: 7, count: 5, dots: [] as boolean[] };
  assert.equal(detailLine(sleep, p, { value: 82, visible: true }), '82 i nat · 5 af 7 denne uge');
  const steps = habit({ tracking: 'automatic', frequency: perWeek(5), rule: { metric: 'steps', op: '>=', threshold: 8000 } });
  const q = { done: 2, target: 5, count: 2, dots: [] as boolean[] };
  assert.equal(detailLine(steps, q, { value: 6420, visible: true }), '6.420 i dag · 2 af 5 denne uge');
  assert.equal(detailLine(steps, q, { value: 1234567, visible: true }), '1.234.567 i dag · 2 af 5 denne uge');
  assert.equal(detailLine(steps, q, { value: 950, visible: true }), '950 i dag · 2 af 5 denne uge');
  assert.equal(detailLine(steps, q, { value: 6420, visible: false }), 'Automatisk · 2 af 5 denne uge');
  assert.equal(detailLine(steps, q, { value: null, visible: true }), 'Automatisk · 2 af 5 denne uge');
  assert.equal(detailLine(steps, q, null), 'Automatisk · 2 af 5 denne uge');
  const act = habit({ tracking: 'automatic', rule: { metric: 'activity_progress', op: '>=', threshold: 1 } });
  assert.equal(detailLine(act, p, { value: 0.874, visible: true }), '87 % i dag · 5 af 7 denne uge');
});

test('todayCount: due today plus per-week habits not yet at target; done counts those completed today', () => {
  const dailyH = habit({ frequency: daily });
  const wdOn = habit({ frequency: weekdays(3) });
  const wdOff = habit({ frequency: weekdays(4) });
  const pw = habit({ frequency: perWeek(2) });
  const pwAtTarget = habit({ frequency: perWeek(1) });
  const all = [dailyH, wdOn, wdOff, pw, pwAtTarget];
  const cs = [done(dailyH, WED), done(pwAtTarget, MON)];
  assert.deepEqual(todayCount(all, cs, WED, () => true), { done: 1, total: 3 });
  assert.deepEqual(todayCount(all, [...cs, done(pw, WED)], WED, () => true), { done: 2, total: 3 });
});

test('todayCount: a per-week habit that reached its target today stays in both numbers', () => {
  const pw = habit({ frequency: perWeek(1) });
  assert.deepEqual(todayCount([pw], [done(pw, WED)], WED, () => true), { done: 1, total: 1 });
});

test('todayCount: the filter picks Mine or Fælles, archived habits are left out, shared habits count when either did it', () => {
  const mine = habit({ owner: 'b' });
  const shared = habit({ owner: 'both' });
  const gone = habit({ owner: 'b', archivedAt: '2026-11-01T00:00:00Z' });
  const cs = [done(shared, WED, 'a')];
  assert.deepEqual(todayCount([mine, shared, gone], cs, WED, (h) => h.owner === 'b'), { done: 0, total: 1 });
  assert.deepEqual(todayCount([mine, shared, gone], cs, WED, (h) => h.owner === 'both'), { done: 1, total: 1 });
  assert.deepEqual(todayCount([], [], WED, () => true), { done: 0, total: 0 });
});

test('dayRing: completed over due, null when nothing is due or the day is in the future', () => {
  const a = habit(); const b = habit(); const c = habit({ frequency: weekdays(1) });
  const cs = [done(a, WED), done(c, MON)];
  assert.equal(dayRing([a, b], cs, WED, WED), 0.5);
  assert.ok(Math.abs((dayRing([a, b, c], cs, MON, WED) ?? 0) - 1 / 3) < 1e-9, 'Monday: only c done of three due');
  assert.equal(dayRing([c], [], '2026-11-24', WED), null, 'Tuesday: nothing due');
  assert.equal(dayRing([], [], WED, WED), null);
  assert.equal(dayRing([a], [], '2026-11-26', WED), null, 'future');
  assert.equal(dayRing([a], [], WED, WED), 0, 'today with nothing done is an empty fill, not null');
});

test('dayRing: per-week habits add to both sides only when completed that day', () => {
  const a = habit(); const pw = habit({ frequency: perWeek(3) });
  assert.equal(dayRing([a, pw], [], WED, WED), 0);
  assert.equal(dayRing([a, pw], [done(pw, WED)], WED, WED), 0.5);
  assert.equal(dayRing([a, pw], [done(pw, WED), done(a, WED)], WED, WED), 1);
  assert.equal(dayRing([pw], [], WED, WED), null);
});

test('dayRing: a weekdays habit ticked on an off day counts as an extra, never a penalty', () => {
  const w = habit({ frequency: weekdays(1) });
  assert.equal(dayRing([w], [done(w, WED)], WED, WED), 1);
});

test('dayRing: archived habits and days before the habit existed are left out', () => {
  const gone = habit({ archivedAt: '2026-11-20T00:00:00Z' });
  const fresh = habit({ createdAt: '2026-11-25T08:00:00Z' });
  assert.equal(dayRing([gone], [], WED, WED), null);
  assert.equal(dayRing([fresh], [], MON, WED), null, 'Monday is before it was created');
  assert.equal(dayRing([fresh], [], WED, WED), 0);
});

test('dayRing: creation is read as a Copenhagen date (the daylight-saving night)', () => {
  const h = habit({ createdAt: '2026-03-28T23:30:00Z' }); // 00:30 on the 29th in Copenhagen
  assert.equal(dayRing([h], [], '2026-03-28', '2026-03-30'), null);
  assert.equal(dayRing([h], [], '2026-03-29', '2026-03-30'), 0);
});

test('weeksInARow: consecutive full weeks ending last week, plus this week once met', () => {
  const h = habit({ frequency: perWeek(2), createdAt: '2026-09-01T00:00:00Z' });
  const week = (monday: string) => [done(h, monday), done(h, `${monday.slice(0, 8)}${String(Number(monday.slice(8)) + 1).padStart(2, '0')}`)];
  const lastTwo = [...week('2026-11-09'), ...week('2026-11-16')];
  assert.equal(weeksInARow(h, lastTwo, WED), 2);
  assert.equal(weeksInARow(h, [...lastTwo, done(h, MON)], WED), 2, 'this week not yet met');
  assert.equal(weeksInARow(h, [...lastTwo, done(h, MON), done(h, WED)], WED), 3);
  assert.equal(weeksInARow(h, [...week('2026-11-02'), ...week('2026-11-16')], WED), 1, 'a gap ends the run');
  assert.equal(weeksInARow(h, [], WED), 0);
  assert.equal(weeksInARow(h, week(MON), WED), 1, 'only this week');
});

test('weeksInARow: never looks before the week the habit was created', () => {
  const h = habit({ frequency: perWeek(1), createdAt: '2026-11-18T10:00:00Z' });
  assert.equal(weeksInARow(h, [done(h, '2026-11-18'), done(h, '2026-11-10')], WED), 1);
});

test('weeksInARow across the new year', () => {
  const h = habit({ frequency: perWeek(1), createdAt: '2025-10-01T00:00:00Z' });
  const cs = [done(h, '2025-12-24'), done(h, '2025-12-30'), done(h, '2026-01-06')];
  assert.equal(weeksInARow(h, cs, '2026-01-07'), 3);
});

test('weeksInARow counts weekdays habits against their own target', () => {
  const h = habit({ frequency: weekdays(1, 2), createdAt: '2026-01-01T00:00:00Z' });
  const cs = [done(h, '2026-11-16'), done(h, '2026-11-17'), done(h, '2026-11-09')];
  assert.equal(weeksInARow(h, cs, WED), 1);
});

test('doneBy: the person who completed it that day, or null', () => {
  const h = habit({ owner: 'both' });
  assert.equal(doneBy(h, [done(h, WED, 'a')], WED), 'a');
  assert.equal(doneBy(h, [done(h, WED, 'a')], MON), null);
  assert.equal(doneBy(h, [], WED), null);
  assert.equal(doneBy(h, [done(habit(), WED, 'b')], WED), null);
});

const draft = (d: Partial<HabitDraft> = {}): HabitDraft => ({
  title: 'Drik vand', owner: 'b', tracking: 'manual', frequency: daily, rule: null, color: 'sage', icon: null, reminderTime: null, ...d,
});

test('validateHabitDraft: a good draft passes', () => {
  assert.deepEqual(validateHabitDraft(draft()), { ok: true, errors: {} });
  assert.equal(validateHabitDraft(draft({ owner: 'both', frequency: perWeek(7) })).ok, true);
  assert.equal(validateHabitDraft(draft({ frequency: weekdays(1, 7), reminderTime: '07:30', icon: '💧' })).ok, true);
});

test('validateHabitDraft: title is required, trimmed and at most 80 characters', () => {
  assert.equal(validateHabitDraft(draft({ title: '   ' })).errors.title, 'Skriv et navn.');
  assert.equal(validateHabitDraft(draft({ title: 'x'.repeat(81) })).ok, false);
  assert.equal(validateHabitDraft(draft({ title: ` ${'x'.repeat(80)} ` })).ok, true);
});

test('validateHabitDraft: per-week count 1 to 7, whole numbers', () => {
  for (const count of [0, 8, 1.5, -1]) assert.equal(validateHabitDraft(draft({ frequency: perWeek(count) })).ok, false, String(count));
  assert.ok(validateHabitDraft(draft({ frequency: perWeek(0) })).errors.frequency);
});

test('validateHabitDraft: weekdays need at least one valid ISO day', () => {
  assert.ok(validateHabitDraft(draft({ frequency: weekdays() })).errors.frequency);
  assert.equal(validateHabitDraft(draft({ frequency: weekdays(0) })).ok, false);
  assert.equal(validateHabitDraft(draft({ frequency: weekdays(8) })).ok, false);
});

test('validateHabitDraft: automatic needs a valid rule and stays personal; manual has no rule', () => {
  const rule: Rule = { metric: 'steps', op: '>=', threshold: 8000 };
  assert.equal(validateHabitDraft(draft({ tracking: 'automatic', rule })).ok, true);
  assert.ok(validateHabitDraft(draft({ tracking: 'automatic', rule: null })).errors.rule);
  assert.ok(validateHabitDraft(draft({ tracking: 'automatic', rule: { ...rule, threshold: Number.NaN } })).errors.rule);
  assert.ok(validateHabitDraft(draft({ tracking: 'automatic', rule: { ...rule, threshold: -5 } })).errors.rule);
  assert.ok(validateHabitDraft(draft({ tracking: 'automatic', rule, owner: 'both' })).errors.owner);
  assert.ok(validateHabitDraft(draft({ tracking: 'manual', rule })).errors.rule);
});

test('validateHabitDraft: reminder is HH:MM, icon at most 16 characters, colour from the palette', () => {
  assert.ok(validateHabitDraft(draft({ reminderTime: '7:30' })).errors.reminderTime);
  assert.ok(validateHabitDraft(draft({ reminderTime: '25:00' })).errors.reminderTime);
  assert.equal(validateHabitDraft(draft({ reminderTime: '23:59' })).ok, true);
  assert.ok(validateHabitDraft(draft({ icon: '💧'.repeat(17) })).errors.icon);
  assert.equal(validateHabitDraft(draft({ icon: '💧'.repeat(16) })).ok, true);
  assert.ok(validateHabitDraft(draft({ color: 'pink' as never })).errors.color);
});

test('habitColors has literal classes for all eight colours', () => {
  assert.deepEqual(Object.keys(habitColors).sort(), ['clay', 'lavender', 'moss', 'plum', 'rose', 'sage', 'sand', 'sky']);
  assert.equal(habitColors.sage.fill, 'bg-sp-habit-sage');
  assert.equal(habitColors.sky.ink, 'text-sp-habit-sky-ink');
});

test('rows map to habits and back', () => {
  const row: HabitRow = {
    id: 'h1', household_id: 'hh', owner: 'both', title: 'Gå tur', tracking: 'manual', frequency: 'weekdays', per_week_count: null,
    weekdays: [3, 1], reminder_time: '07:30:00', color: 'sky', icon: '🚶', rule: null, archived_at: null,
    created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z', created_by: null,
  };
  const h = habitFromRow(row);
  assert.deepEqual(h.frequency, { kind: 'weekdays', days: [1, 3] });
  assert.equal(h.reminderTime, '07:30');
  assert.equal(h.owner, 'both');
  const back = habitToRow('hh', h);
  assert.deepEqual(back.weekdays, [1, 3]);
  assert.equal(back.per_week_count, null);
  assert.equal(back.frequency, 'weekdays');
  assert.equal(back.reminder_time, '07:30');
  const pw = habitFromRow({ ...row, frequency: 'per_week', per_week_count: 3, weekdays: null });
  assert.deepEqual(pw.frequency, { kind: 'per_week', count: 3 });
  const pwRow = habitToRow('hh', pw);
  assert.equal(pwRow.per_week_count, 3);
  assert.equal(pwRow.weekdays, null);
  const auto = habitFromRow({ ...row, frequency: 'daily', weekdays: null, tracking: 'automatic', owner: 'b', rule: { metric: 'steps', op: '>=', threshold: 8000 } });
  assert.deepEqual(auto.rule, { metric: 'steps', op: '>=', threshold: 8000 });
  assert.deepEqual(habitFromRow({ ...row, frequency: 'daily', weekdays: null }).frequency, { kind: 'daily' });
  assert.equal(habitFromRow({ ...row, color: 'weird' }).color, 'sage', 'an unknown colour falls back');
  assert.deepEqual(
    completionFromRow({ id: 'c', household_id: 'hh', habit_id: 'h1', date: MON, completed_by: 'a', source: 'automatic', created_at: '' }),
    { habitId: 'h1', date: MON, completedBy: 'a', source: 'automatic' },
  );
});

// ---- rules.ts ----

test('meets: >= and > are exact at the threshold', () => {
  const ge: Rule = { metric: 'steps', op: '>=', threshold: 8000 };
  const gt: Rule = { metric: 'sleep_score', op: '>', threshold: 75 };
  assert.equal(meets(ge, { steps: 8000 }), true);
  assert.equal(meets(ge, { steps: 7999 }), false);
  assert.equal(meets(gt, { sleep_score: 75 }), false);
  assert.equal(meets(gt, { sleep_score: 76 }), true);
});

test('meets: missing data is never complete', () => {
  assert.equal(meets({ metric: 'steps', op: '>=', threshold: 0 }, { steps: null }), false);
  assert.equal(meets({ metric: 'steps', op: '>=', threshold: 0 }, {}), false);
  assert.equal(meets({ metric: 'sleep_score', op: '>', threshold: -1 }, { steps: 9999 }), false);
  assert.equal(meets({ metric: 'steps', op: '>=', threshold: 0 }, { steps: Number.NaN }), false);
  assert.equal(meets({ metric: 'steps', op: '>=', threshold: 0 }, { steps: 0 }), true, 'zero is data');
});

test('meets: "Aktivitetsmål nået" is activity_progress >= 1', () => {
  const r: Rule = { metric: 'activity_progress', op: '>=', threshold: 1 };
  assert.equal(meets(r, { activity_progress: 1 }), true);
  assert.equal(meets(r, { activity_progress: 1.4 }), true);
  assert.equal(meets(r, { activity_progress: 0.999 }), false);
});

test('suggestions: the three presets, filtered to the metrics the person has', () => {
  assert.deepEqual(suggestions(['steps', 'sleep_score', 'activity_progress']).map((s) => s.title), ['8.000 skridt', 'Søvnscore over 75', 'Aktivitetsmål nået']);
  assert.deepEqual(suggestions(['sleep_score']), [{ title: 'Søvnscore over 75', rule: { metric: 'sleep_score', op: '>', threshold: 75 } }]);
  assert.deepEqual(suggestions(['steps'])[0].rule, { metric: 'steps', op: '>=', threshold: 8000 });
  assert.deepEqual(suggestions(['activity_progress'])[0].rule, { metric: 'activity_progress', op: '>=', threshold: 1 });
  assert.deepEqual(suggestions([]), []);
});
