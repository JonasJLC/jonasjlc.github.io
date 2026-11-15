import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDays, dayOfMonth, isIsoDate, isoWeek, longDate, mondayOf, todayIso, weekDays, weekdayShort } from '../src/components/strandparken/lib/madplan/dates.ts';
import { cleanFreeText, dishOf, entryOn, type PlanEntry } from '../src/components/strandparken/lib/madplan/model.ts';
import type { Recipe } from '../src/components/strandparken/lib/recipes/model.ts';

test('week starts on Monday and has seven days', () => {
  assert.equal(mondayOf('2026-11-15'), '2026-11-09'); // a Sunday
  assert.equal(mondayOf('2026-11-09'), '2026-11-09');
  assert.equal(mondayOf('2026-11-12'), '2026-11-09');
  assert.deepEqual(weekDays('2026-11-09'), ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
});

test('date arithmetic crosses months, years and daylight saving', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-10-24', 2), '2026-10-26'); // clocks go back 25 Oct 2026
  assert.equal(addDays('2026-11-09', 7), '2026-11-16');
});

test('ISO week numbers', () => {
  assert.equal(isoWeek('2026-11-09'), 46);
  assert.equal(isoWeek('2026-11-15'), 46);
  assert.equal(isoWeek('2026-01-01'), 1);
  assert.equal(isoWeek('2026-12-31'), 53);
  assert.equal(isoWeek('2027-01-01'), 53);
  assert.equal(isoWeek('2027-01-04'), 1);
});

test('"today" is the date in Copenhagen, not UTC', () => {
  assert.equal(todayIso(new Date('2026-11-15T23:30:00Z')), '2026-11-16'); // 00:30 in Copenhagen
  assert.equal(todayIso(new Date('2026-07-01T21:59:00Z')), '2026-07-01');
  assert.equal(todayIso(new Date('2026-07-01T22:00:00Z')), '2026-07-02');
});

test('labels', () => {
  assert.equal(weekdayShort('2026-11-09'), 'Man');
  assert.equal(weekdayShort('2026-11-15'), 'Søn');
  assert.equal(dayOfMonth('2026-11-09'), 9);
  assert.equal(longDate('2026-11-09'), 'mandag 9. november');
  assert.ok(isIsoDate('2026-02-28'));
  assert.ok(!isIsoDate('2026-02-30'));
  assert.ok(!isIsoDate('hej'));
});

const entry = (over: Partial<PlanEntry>): PlanEntry => ({
  calendar_event_id: null, calendar_synced_at: null, created_at: '', created_by: null, date: '2026-11-09', free_text: null,
  household_id: 'h', id: 'e1', idea_id: null, recipe_id: null, servings: 2, updated_at: '', ...over,
});
const recipe = { id: 'r1', title: 'Lasagne' } as Recipe;

test('a plan entry shows its recipe, its free text, or a fallback', () => {
  assert.deepEqual(dishOf(entry({ recipe_id: 'r1' }), [recipe]), { title: 'Lasagne', recipe, imagePath: null });
  assert.equal(dishOf(entry({ recipe_id: 'gone' }), [recipe]).recipe, null);
  assert.equal(dishOf(entry({ free_text: 'Rester' }), []).title, 'Rester');
});

test('entryOn finds the day', () => {
  const list = [entry({ id: 'a', date: '2026-11-09' }), entry({ id: 'b', date: '2026-11-10' })];
  assert.equal(entryOn(list, '2026-11-10')?.id, 'b');
  assert.equal(entryOn(list, '2026-11-11'), null);
});

test('free text is trimmed and collapsed', () => {
  assert.equal(cleanFreeText('  Mad   hos  mor '), 'Mad hos mor');
  assert.equal(cleanFreeText('   '), '');
});
