import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tonightCard } from '../src/components/strandparken/lib/home/tonight.ts';
import type { PlanEntry } from '../src/components/strandparken/lib/madplan/model.ts';
import type { Recipe } from '../src/components/strandparken/lib/recipes/model.ts';
import type { Idea } from '../src/components/strandparken/lib/ideas/model.ts';
import { placeholderFor } from '../src/components/strandparken/lib/recipes/placeholder.ts';
import { dayTagFor, filterLabel, forIds, linesFor, missingForHome, missingHref, missingLabel } from '../src/components/strandparken/lib/home/missing.ts';
import { mergeRows, type GroceryCategory, type ShoppingRow } from '../src/components/strandparken/lib/shopping/model.ts';

const today = '2026-11-20'; // a Friday

const entry = (over: Partial<PlanEntry>): PlanEntry => ({
  calendar_event_id: null, calendar_synced_at: null, created_at: '', created_by: null, date: today, free_text: null,
  household_id: 'h', id: 'e1', idea_id: null, recipe_id: null, servings: 2, updated_at: '', ...over,
});

const recipe = {
  id: 'r1', title: 'Quesadillas med oksekød', total_minutes: 25, image_path: 'r1.jpg', thumb_path: 'r1-thumb.jpg', category_id: 'c1', tags: ['mexicansk'],
} as unknown as Recipe;
const idea = { id: 'i1', title: 'Fiskefrikadeller', tags: ['fisk'], image_path: null } as unknown as Idea;
const categories = [{ id: 'c1', name: 'Aftensmad' }];
const empty = { kind: 'empty', weekdayLong: 'fredag', href: '#madplan/2026-11-20/dag' };

test('a recipe tonight links to the recipe and shows time and persons', () => {
  const card = tonightCard([entry({ recipe_id: 'r1' })], [recipe], [], {}, today, categories);
  assert.equal(card.kind, 'planned');
  if (card.kind !== 'planned') return;
  assert.equal(card.title, 'Quesadillas med oksekød');
  assert.equal(card.href, '#opskrifter/r1');
  assert.equal(card.meta, '25 min · 2 pers.');
  assert.equal(card.label, 'I aften: Quesadillas med oksekød, 25 min, 2 personer');
  assert.deepEqual(card.placeholder, placeholderFor({ title: recipe.title, category: 'Aftensmad', tags: ['mexicansk'] }));
});

test('without a total time the meta line is persons only', () => {
  const card = tonightCard([entry({ recipe_id: 'r1', servings: 4 })], [{ ...recipe, total_minutes: null }], [], {}, today);
  assert.equal(card.kind === 'planned' && card.meta, '4 pers.');
  assert.equal(card.kind === 'planned' && card.label, 'I aften: Quesadillas med oksekød, 4 personer');
});

test('one person is singular in the label', () => {
  const card = tonightCard([entry({ free_text: 'Rester', servings: 1 })], [], [], {}, today);
  assert.equal(card.kind === 'planned' && card.meta, '1 pers.');
  assert.equal(card.kind === 'planned' && card.label, 'I aften: Rester, 1 person');
});

test("an idea or free text opens today's Madplan sheet and shows persons only", () => {
  for (const e of [entry({ idea_id: 'i1' }), entry({ free_text: 'Takeaway' })]) {
    const card = tonightCard([e], [recipe], [idea], {}, today);
    assert.equal(card.kind, 'planned');
    if (card.kind !== 'planned') continue;
    assert.equal(card.href, '#madplan/2026-11-20/dag');
    assert.equal(card.meta, '2 pers.');
  }
  const ideaCard = tonightCard([entry({ idea_id: 'i1' })], [], [idea], {}, today);
  assert.equal(ideaCard.kind === 'planned' && ideaCard.title, 'Fiskefrikadeller');
});

test("nothing planned tonight is the empty state, and only today's entry counts", () => {
  assert.deepEqual(tonightCard([], [], [], {}, today), empty);
  assert.deepEqual(tonightCard([entry({ date: '2026-11-21', recipe_id: 'r1' })], [recipe], [], {}, today), empty);
});

test('the photo is the thumbnail, else the full photo, else none', () => {
  const pick = (photos: Record<string, string>) => {
    const card = tonightCard([entry({ recipe_id: 'r1' })], [recipe], [], photos, today);
    return card.kind === 'planned' ? card.photo : 'not planned';
  };
  assert.equal(pick({ 'r1.jpg': 'https://x/full', 'r1-thumb.jpg': 'https://x/thumb' }), 'https://x/thumb');
  assert.equal(pick({ 'r1.jpg': 'https://x/full' }), 'https://x/full');
  assert.equal(pick({}), undefined);
});

// ---------------------------------------------------------------------------------------------------------------
// Idé 8: Mangler at handle

const tomorrowIso = '2026-11-21';
const carbonara = { ...recipe, id: 'r2', title: 'Carbonara' } as unknown as Recipe;
const cats = [
  { id: 'veg', name: 'Frugt & grønt', position: 1 },
  { id: 'dairy', name: 'Mejeri & æg', position: 2 },
  { id: 'dry', name: 'Kolonial', position: 3 },
] as unknown as GroceryCategory[];
let rowN = 0;
const row = (over: Partial<ShoppingRow> & Pick<ShoppingRow, 'name'>): ShoppingRow =>
  ({
    id: `s${rowN++}`, canonical_name: null, amount: null, unit: null, grocery_category_id: null, status: 'active',
    source: 'plan', plan_entry_id: 'e1', recipe_id: 'r1', ...over,
  }) as ShoppingRow;
const tonightEntry = entry({ id: 'e1', recipe_id: 'r1' });
const tomorrowEntry = entry({ id: 'e2', date: tomorrowIso, recipe_id: 'r2' });
const plan = [tonightEntry, tomorrowEntry];
const tonightRows = () => [
  row({ name: 'Tortilla', grocery_category_id: 'dry' }),
  row({ name: 'Lime', grocery_category_id: 'veg' }),
  row({ name: 'Creme fraiche', grocery_category_id: 'dairy' }),
  row({ name: 'Avocado', grocery_category_id: 'veg', status: 'checked' }),
];
const tomorrowRows = () =>
  ['Spaghetti', 'Bacon', 'Æg', 'Parmesan'].map((name) => row({ name, plan_entry_id: 'e2', recipe_id: 'r2' }));

test('tonight counts the unbought lines and names the first three in store-walk order', () => {
  const m = missingForHome(tonightRows(), plan, [recipe, carbonara], cats, today);
  assert.equal(m.tonight?.count, 3);
  assert.deepEqual(m.tonight?.names, ['Lime', 'Creme fraiche', 'Tortillas']);
  assert.equal(m.tonight?.more, 0);
  assert.equal(m.tonight?.ready, false);
});

test('more than three lines name three and count the rest', () => {
  const rows = ['Lime', 'Avocado', 'Tomat', 'Løg', 'Koriander'].map((name) => row({ name }));
  const m = missingForHome(rows, plan, [recipe], cats, today);
  assert.equal(m.tonight?.names.length, 3);
  assert.equal(m.tonight?.more, 2);
  assert.equal(m.tonight?.count, 5);
});

test('everything for tonight ticked, or at home, is "Klar til i aften"', () => {
  const ticked = tonightRows().map((r) => ({ ...r, status: 'checked' }));
  assert.equal(missingForHome(ticked, plan, [recipe], cats, today).tonight?.ready, true);
  const have = tonightRows().map((r) => ({ ...r, status: 'have' }));
  const m = missingForHome(have, plan, [recipe], cats, today).tonight;
  assert.deepEqual([m?.ready, m?.notOnList, m?.count], [true, false, 0]);
});

test('pantry basics are not counted', () => {
  const m = missingForHome([row({ name: 'Salt' }), row({ name: 'Lime' })], plan, [recipe], cats, today);
  assert.deepEqual([m.tonight?.count, m.tonight?.names], [1, ['Lime']]);
});

test('a day with nothing planned, or with free text or an idea, has no line', () => {
  assert.deepEqual(missingForHome(tonightRows(), [], [recipe], cats, today), { tonight: null, tomorrow: null });
  const other = [entry({ id: 'e1', free_text: 'Rester' }), entry({ id: 'e2', date: tomorrowIso, idea_id: 'i1' })];
  assert.deepEqual(missingForHome(tonightRows(), other, [recipe], cats, today), { tonight: null, tomorrow: null });
});

test('manual and recipe-only rows are not counted', () => {
  const rows = [
    row({ name: 'Lime' }),
    row({ name: 'Lime', source: 'manual', plan_entry_id: null, recipe_id: null }),
    row({ name: 'Lime', source: 'recipe', plan_entry_id: null }),
  ];
  assert.equal(missingForHome(rows, plan, [recipe], cats, today).tonight?.count, 1);
});

test('the same ingredient tonight and tomorrow counts once in each line', () => {
  const rows = [row({ name: 'Løg' }), row({ name: 'løg', plan_entry_id: 'e2', recipe_id: 'r2' })];
  const m = missingForHome(rows, plan, [recipe, carbonara], cats, today);
  assert.deepEqual([m.tonight?.count, m.tomorrow?.count], [1, 1]);
});

test("tomorrow's line carries the recipe title and count", () => {
  const m = missingForHome(tomorrowRows(), plan, [recipe, carbonara], cats, today);
  assert.deepEqual([m.tomorrow?.title, m.tomorrow?.count, m.tomorrow?.ready], ['Carbonara', 4, false]);
});

test('a planned recipe without rows on the list is "Ikke på listen endnu"', () => {
  const m = missingForHome(tomorrowRows(), plan, [recipe, carbonara], cats, today);
  assert.deepEqual([m.tonight?.notOnList, m.tonight?.ready], [true, false]);
});

test('a moved meal (same id, new date) takes its rows along', () => {
  const moved = [entry({ id: 'e1', date: tomorrowIso, recipe_id: 'r1' })];
  const m = missingForHome(tonightRows(), moved, [recipe], cats, today);
  assert.equal(m.tonight, null);
  assert.equal(m.tomorrow?.count, 3);
});

test('the card label reads both lines, and the link names only meals on the list', () => {
  const rows = [row({ name: 'Lime', grocery_category_id: 'veg' }), row({ name: 'Avocado', grocery_category_id: 'veg' }), ...tomorrowRows()];
  const m = missingForHome(rows, plan, [recipe, carbonara], cats, today);
  assert.equal(missingLabel(m), 'Mangler at handle: til i aften 2 varer, avocado og lime. Til i morgen, carbonara, 4 varer.');
  assert.equal(missingHref(m), '#lister/indkob?for=e1,e2');
  const notYet = missingForHome(tomorrowRows(), plan, [recipe, carbonara], cats, today);
  assert.equal(missingHref(notYet), '#lister/indkob?for=e2');
  assert.match(missingLabel(notYet), /^Mangler at handle: til i aften ikke på listen endnu\./);
  const ready = missingForHome(tonightRows().map((r) => ({ ...r, status: 'checked' })), [tonightEntry], [recipe], cats, today);
  assert.equal(missingLabel(ready), 'Mangler at handle: klar til i aften.');
});

test('?for= filters Indkøb to lines with a row for those meals, and the banner names the days', () => {
  const lines = mergeRows([...tonightRows(), ...tomorrowRows(), row({ name: 'Mælk', source: 'manual', plan_entry_id: null, recipe_id: null })]);
  assert.deepEqual(forIds(new URLSearchParams('for=e2, ')), ['e2']);
  assert.deepEqual(forIds(new URLSearchParams('')), []);
  assert.equal(linesFor(lines, ['e2']).length, 4);
  assert.ok(!linesFor(lines, ['e1', 'e2']).some((l) => l.name === 'Mælk'));
  const dates: Record<string, string> = { e1: today, e2: tomorrowIso, e3: '2026-11-23' };
  const dateOf = (id: string) => dates[id] ?? null;
  assert.equal(filterLabel(['e1', 'e2'], dateOf, today), 'Viser varer til i aften og i morgen');
  assert.equal(filterLabel(['e1'], dateOf, today), 'Viser varer til i aften');
  assert.equal(filterLabel(['e3'], dateOf, today), 'Viser varer til mandag');
  assert.equal(filterLabel(['zz'], dateOf, today), 'Viser varer til de valgte måltider');
});

test('day tags: I dag, the short weekday within six days, else day/month, none for manual or past rows', () => {
  const dates: Record<string, string> = { past: '2026-11-19', now: today, thu: '2026-11-26', far: '2026-11-27', sat: '2026-11-21' };
  const dateOf = (id: string) => dates[id] ?? null;
  const tag = (...ids: (string | null)[]) => {
    const [line] = mergeRows(ids.map((id) => row({ name: 'Lime', plan_entry_id: id })));
    return dayTagFor(line, dateOf, today);
  };
  assert.equal(tag('now'), 'I dag');
  assert.equal(tag('sat'), 'Lør');
  assert.equal(tag('thu'), 'Tor');
  assert.equal(tag('far'), '27/11');
  assert.equal(tag('far', 'sat'), 'Lør');
  assert.equal(tag('past'), null);
  assert.equal(tag(null), null);
  assert.equal(tag('past', 'thu'), 'Tor');
});
