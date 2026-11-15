import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PlanEntry } from '../src/components/strandparken/lib/madplan/model.ts';
import type { Recipe } from '../src/components/strandparken/lib/recipes/model.ts';
import {
  groupLines, guessCategoryId, guessCategoryName, isEmptyPlan, mergeRows, planGeneration, rowFor,
  type GroceryCategory, type ShoppingRow,
} from '../src/components/strandparken/lib/shopping/model.ts';

const cats = ['Frugt & grønt', 'Kød & fisk', 'Mejeri & æg', 'Kolonial', 'Andet'].map((name, position) => ({ id: `c${position}`, name, position })) as GroceryCategory[];

const ing = (id: string, name: string, amount: number | null, unit: string | null) =>
  ({ id, name, amount, unit, scales: true, position: 0, note: null, grocery_category_id: null, canonical_name: null }) as Recipe['ingredients'][number];
const recipe = (id: string, title: string, ingredients: Recipe['ingredients'], base = 4): Recipe => ({ id, title, base_servings: base, ingredients } as Recipe);
const entry = (id: string, date: string, recipe_id: string | null, servings = 4) => ({ id, date, recipe_id, servings, free_text: null, idea_id: null }) as PlanEntry;

let n = 0;
const stored = (w: Partial<ShoppingRow> & Pick<ShoppingRow, 'name'>): ShoppingRow =>
  ({ id: `r${n++}`, canonical_name: null, amount: null, unit: null, grocery_category_id: null, status: 'active', source: 'manual', plan_entry_id: null, recipe_id: null, ...w }) as ShoppingRow;

const pasta = recipe('p', 'Pasta', [ing('1', 'Spaghetti', 400, 'g'), ing('2', 'Løg', 2, null)]);
const chili = recipe('c', 'Chili', [ing('3', 'Løg', 1, null), ing('4', 'Hakket oksekød', 500, 'g')]);

/** What the app stores when the person keeps everything in the review. */
function runReview(plan: ReturnType<typeof planGeneration>, rows: ShoppingRow[], have: string[] = []) {
  const out = [...rows];
  for (const r of plan.review) for (const w of r.wanted) {
    out.push(stored({ ...rowFor('h', w, have.includes(w.canonicalName) ? 'have' : 'active') } as unknown as ShoppingRow));
  }
  for (const w of plan.add) out.push(stored(rowFor('h', w) as unknown as ShoppingRow));
  return out.filter((r) => !plan.remove.includes(r.id)).map((r) => {
    const u = plan.update.find((x) => x.id === r.id);
    return u ? { ...r, amount: u.amount, unit: u.unit } : r;
  });
}

test('categories are guessed from the name, with Andet as the fallback', () => {
  assert.equal(guessCategoryName('Hakket oksekød'), 'Kød & fisk');
  assert.equal(guessCategoryName('Letmælk'), 'Mejeri & æg');
  assert.equal(guessCategoryName('Løg'), 'Frugt & grønt');
  assert.equal(guessCategoryName('Noget ukendt'), 'Andet');
  assert.equal(guessCategoryId('Spaghetti', cats), 'c3');
  assert.equal(guessCategoryId('Spaghetti', []), null);
});

test('the same ingredient from two dishes is one line with a summed amount and both dish names', () => {
  const rows = [
    stored({ name: 'Løg', canonical_name: 'løg', amount: 2, recipe_id: 'p' }),
    stored({ name: 'løg', canonical_name: 'løg', amount: 1, recipe_id: 'c' }),
  ];
  const lines = mergeRows(rows, (id) => (id === 'p' ? 'Pasta' : 'Chili'));
  assert.equal(lines.length, 1);
  assert.equal(lines[0].amount, 3);
  assert.deepEqual(lines[0].dishes, ['Pasta', 'Chili']);
});

test('compatible units merge (g + kg), incompatible units stay separate', () => {
  const merged = mergeRows([stored({ name: 'Mel', amount: 500, unit: 'g' }), stored({ name: 'Mel', amount: 1, unit: 'kg' })]);
  assert.equal(merged.length, 1);
  assert.deepEqual([merged[0].amount, merged[0].unit], [1.5, 'kg']);
  const separate = mergeRows([stored({ name: 'Tomat', amount: 500, unit: 'g' }), stored({ name: 'Tomat', amount: 3, unit: 'stk' })]);
  assert.equal(separate.length, 2);
});

test('have and cleared rows are not shown; a line is ticked only when all its rows are', () => {
  const lines = mergeRows([
    stored({ name: 'Salt', status: 'have' }), stored({ name: 'Mælk', status: 'cleared' }),
    stored({ name: 'Løg', amount: 1, status: 'checked' }), stored({ name: 'Løg', amount: 1, status: 'active' }),
  ]);
  assert.deepEqual(lines.map((l) => l.name), ['Løg']);
  assert.equal(lines[0].checked, false);
});

test('groups follow store-walk order and ticked lines sink to the bottom of their group', () => {
  const lines = mergeRows([
    stored({ name: 'Æbler', grocery_category_id: 'c0', status: 'checked' }), stored({ name: 'Agurk', grocery_category_id: 'c0' }),
    stored({ name: 'Mælk', grocery_category_id: 'c2' }), stored({ name: 'Mystisk' }),
  ]);
  const groups = groupLines(lines, cats);
  assert.deepEqual(groups.map((g) => g.name), ['Frugt & grønt', 'Mejeri & æg', 'Andet']);
  assert.deepEqual([...groups[0].open, ...groups[0].done].map((l) => l.name), ['Agurk', 'Æbler']);
});

test('first run asks about every planned recipe; amounts follow persons', () => {
  const plan = planGeneration([entry('e1', '2026-11-16', 'p', 2)], [pasta], [], cats);
  assert.equal(plan.review.length, 1);
  assert.equal(plan.review[0].wanted.find((w) => w.canonicalName === 'spaghetti')?.amount, 200);
  assert.equal(plan.review[0].wanted.find((w) => w.canonicalName === 'løg')?.categoryId, 'c0');
});

test('generating twice in a row changes nothing', () => {
  const entries = [entry('e1', '2026-11-16', 'p')];
  const after = runReview(planGeneration(entries, [pasta], [], cats), []);
  assert.ok(isEmptyPlan(planGeneration(entries, [pasta], after, cats)));
});

test('"har hjemme" is remembered per day: a second run does not ask again', () => {
  const entries = [entry('e1', '2026-11-16', 'p')];
  const after = runReview(planGeneration(entries, [pasta], [], cats), [], ['løg']);
  assert.equal(mergeRows(after).length, 1);
  assert.ok(isEmptyPlan(planGeneration(entries, [pasta], after, cats)));
});

test('a new day goes through the review; existing days are left alone', () => {
  const e1 = entry('e1', '2026-11-16', 'p');
  const first = runReview(planGeneration([e1], [pasta, chili], [], cats), []);
  const plan = planGeneration([e1, entry('e2', '2026-11-17', 'c')], [pasta, chili], first, cats);
  assert.deepEqual(plan.review.map((r) => r.entry.id), ['e2']);
  assert.deepEqual([plan.add.length, plan.update.length, plan.remove.length], [0, 0, 0]);
});

test('a removed day takes its unticked ingredients with it, never ticked ones', () => {
  const entries = [entry('e1', '2026-11-16', 'p'), entry('e2', '2026-11-17', 'c')];
  let rows = runReview(planGeneration(entries, [pasta, chili], [], cats), []);
  // Spaghetti of e1 is bought; then e2 is removed from the plan (the database nulls the link).
  rows = rows.map((r) => (r.canonical_name === 'hakket oksekød' ? { ...r, plan_entry_id: null } : r.canonical_name === 'løg' && r.plan_entry_id === 'e2' ? { ...r, plan_entry_id: null, status: 'checked' as const } : r));
  const plan = planGeneration([entries[0]], [pasta, chili], rows, cats);
  const removed = rows.filter((r) => plan.remove.includes(r.id)).map((r) => r.canonical_name);
  assert.deepEqual(removed, ['hakket oksekød']);
});

test('changing persons updates unticked amounts but never ticked ones', () => {
  const rows = runReview(planGeneration([entry('e1', '2026-11-16', 'p', 4)], [pasta], [], cats), []);
  rows[0] = { ...rows[0], status: 'checked' }; // spaghetti bought
  const plan = planGeneration([entry('e1', '2026-11-16', 'p', 2)], [pasta], rows, cats);
  assert.deepEqual(plan.update.map((u) => u.amount), [1]); // løg 2 → 1; spaghetti untouched
});

test('free-text dinners and recipes missing from the list produce nothing', () => {
  const plan = planGeneration([entry('e1', '2026-11-16', null), entry('e2', '2026-11-17', 'gone')], [pasta], [], cats);
  assert.ok(isEmptyPlan(plan));
});
