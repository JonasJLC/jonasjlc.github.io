import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDays, dayOfMonth, isIsoDate, isoWeek, longDate, mondayOf, todayIso, weekDays, weekdayLong, weekdayShort } from '../src/components/strandparken/lib/madplan/dates.ts';
import { applyOutcome, dayOfDroppable, dropOutcome, edgeWeek, moveMessage } from '../src/components/strandparken/lib/madplan/drag.ts';
import { cleanFreeText, dishOf, entryOn, type PlanEntry } from '../src/components/strandparken/lib/madplan/model.ts';
import type { Recipe } from '../src/components/strandparken/lib/recipes/model.ts';
import { placeholderFor } from '../src/components/strandparken/lib/recipes/placeholder.ts';
import type { Idea } from '../src/components/strandparken/lib/ideas/model.ts';

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
  assert.deepEqual(dishOf(entry({ recipe_id: 'r1' }), [recipe]), { title: 'Lasagne', recipe, imagePath: null, thumbPath: null, placeholder: placeholderFor({ title: 'Lasagne' }) });
  const withPhoto = { ...recipe, image_path: 'h/r/a.jpg', thumb_path: 'h/r/a-thumb.jpg' };
  assert.equal(dishOf(entry({ recipe_id: 'r1' }), [withPhoto]).thumbPath, 'h/r/a-thumb.jpg');
  assert.equal(dishOf(entry({ recipe_id: 'r1' }), [withPhoto]).imagePath, 'h/r/a.jpg');
  assert.equal(dishOf(entry({ recipe_id: 'gone' }), [recipe]).recipe, null);
  assert.equal(dishOf(entry({ free_text: 'Rester' }), []).title, 'Rester');
});

test('a plan entry carries the placeholder for its dish', () => {
  const tagged = { ...recipe, category_id: 'c1', tags: ['hurtig', 'pasta'] } as Recipe;
  const cats = [{ id: 'c1', name: 'Aftensmad' }];
  assert.deepEqual(dishOf(entry({ recipe_id: 'r1' }), [tagged], [], cats).placeholder, { tone: 'honey', icon: 'wheat' });
  const plain = { ...recipe, category_id: 'c1', tags: [] } as Recipe;
  assert.deepEqual(dishOf(entry({ recipe_id: 'r1' }), [plain], [], cats).placeholder, { tone: 'clay', icon: 'utensils' });
  assert.deepEqual(dishOf(entry({ recipe_id: 'r1' }), [plain]).placeholder, placeholderFor({ title: 'Lasagne' })); // no categories passed
  const idea = { id: 'i1', title: 'Fiskefrikadeller', tags: ['fisk'] } as Idea;
  assert.deepEqual(dishOf(entry({ idea_id: 'i1' }), [], [idea]).placeholder, { tone: 'sky', icon: 'fish' });
  assert.equal(dishOf(entry({ free_text: 'Takeaway' }), []).placeholder.icon, 'hamburger');
  assert.deepEqual(dishOf(entry({ free_text: 'Biksemad' }), []).placeholder, placeholderFor({ title: 'Biksemad' }));
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

test('weekdayLong is the lower-case weekday name', () => {
  assert.equal(weekdayLong('2026-11-27'), 'fredag');
  assert.equal(weekdayLong('2026-11-23'), 'mandag');
  assert.equal(weekdayLong('2026-11-29'), 'søndag');
});

test('dropOutcome: own day or outside a day does nothing', () => {
  const week = [entry({ id: 'a', date: '2026-11-24' })];
  assert.deepEqual(dropOutcome('2026-11-24', '2026-11-24', week), { kind: 'none' });
  assert.deepEqual(dropOutcome('2026-11-24', null, week), { kind: 'none' });
});

test('dropOutcome: an empty day is a move, a planned day is a swap', () => {
  const week = [entry({ id: 'a', date: '2026-11-24' }), entry({ id: 'b', date: '2026-11-27' })];
  assert.deepEqual(dropOutcome('2026-11-24', '2026-11-26', week), { kind: 'move', to: '2026-11-26' });
  assert.deepEqual(dropOutcome('2026-11-24', '2026-11-27', week), { kind: 'swap', with: week[1] });
});

test('dropOutcome: another week works the same, given that week', () => {
  const next = [entry({ id: 'c', date: '2026-12-02' })];
  assert.deepEqual(dropOutcome('2026-11-24', '2026-12-01', next), { kind: 'move', to: '2026-12-01' });
  assert.deepEqual(dropOutcome('2026-11-24', '2026-12-02', next), { kind: 'swap', with: next[0] });
});

test('moveMessage', () => {
  assert.equal(moveMessage('move', '2026-11-27'), 'Flyttet til fredag');
  assert.equal(moveMessage('swap', '2026-11-27', 'Tacos'), 'Byttet med Tacos');
});

test('droppable ids', () => {
  assert.equal(dayOfDroppable('day:2026-11-27'), '2026-11-27');
  assert.equal(dayOfDroppable('week:next'), null);
  assert.equal(dayOfDroppable(null), null);
  assert.equal(edgeWeek('week:next', '2026-11-23'), '2026-11-30');
  assert.equal(edgeWeek('week:prev', '2026-11-23'), '2026-11-16');
  assert.equal(edgeWeek('day:2026-11-27', '2026-11-23'), null);
});

test('applyOutcome updates the list optimistically', () => {
  const a = entry({ id: 'a', date: '2026-11-24' });
  const b = entry({ id: 'b', date: '2026-11-27' });
  const moved = applyOutcome([a, b], a, { kind: 'move', to: '2026-11-26' });
  assert.deepEqual(moved.map((e) => [e.id, e.date]), [['a', '2026-11-26'], ['b', '2026-11-27']]);
  const swapped = applyOutcome([a, b], a, { kind: 'swap', with: b });
  assert.deepEqual(swapped.map((e) => [e.id, e.date]), [['b', '2026-11-24'], ['a', '2026-11-27']]);
  // Moving into the shown week from another week adds the entry; the list stays in date order.
  const into = applyOutcome([b], entry({ id: 'x', date: '2026-11-17' }), { kind: 'move', to: '2026-11-25' });
  assert.deepEqual(into.map((e) => [e.id, e.date]), [['x', '2026-11-25'], ['b', '2026-11-27']]);
  assert.deepEqual(applyOutcome([a, b], a, { kind: 'none' }), [a, b]);
});
