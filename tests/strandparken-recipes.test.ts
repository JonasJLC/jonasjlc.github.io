import assert from 'node:assert/strict';
import test from 'node:test';
import { filterRecipes, tagsInUse } from '../src/components/strandparken/lib/recipes/filter.ts';
import { cleanTags, emptyDraft, parseAmount, parseSteps, validateDraft, type Recipe } from '../src/components/strandparken/lib/recipes/model.ts';
import { formatAmount, formatQuantity, kitchenRound, scaleIngredient } from '../src/components/strandparken/lib/recipes/scale.ts';
import { parseHash, subPath } from '../src/components/strandparken/lib/routes.ts';

const ing = (name: string, amount: number | null, unit: string | null, scales = true) => ({ amount, unit, name, scales });

test('doubling keeps round numbers and rounds grams to steps of 5', () => {
  assert.equal(scaleIngredient(ing('mel', 250, 'g'), 4, 8), 500);
  assert.equal(scaleIngredient(ing('smør', 75, 'g'), 4, 3), 55); // 56.25 → 55
  assert.equal(scaleIngredient(ing('ost', 150, 'g'), 4, 5), 190); // 187.5 → 190
});

test('small gram amounts round to whole grams, then halves', () => {
  assert.equal(kitchenRound(7.4, 'g', 'gær'), 7);
  assert.equal(kitchenRound(2.3, 'g', 'safran'), 2.5);
});

test('eggs stay whole, never zero', () => {
  assert.equal(scaleIngredient(ing('æg', 2, null), 4, 6), 3);
  assert.equal(scaleIngredient(ing('æg', 1, 'stk'), 4, 1), 1);
  assert.equal(scaleIngredient(ing('æg', 3, null), 4, 5), 4); // 3.75
});

test('spoons go in quarters, deciliters in quarters, other counts in halves', () => {
  assert.equal(scaleIngredient(ing('salt', 1, 'tsk'), 4, 3), 0.75);
  assert.equal(scaleIngredient(ing('kanel', 1, 'tsk'), 4, 1), 0.25);
  assert.equal(scaleIngredient(ing('fløde', 2, 'dl'), 4, 5), 2.5);
  assert.equal(scaleIngredient(ing('løg', 1, 'stk'), 4, 6), 1.5);
  assert.equal(scaleIngredient(ing('hvidløg', 3, 'fed'), 4, 8), 6);
});

test('ingredients that do not scale, or have no amount, stay as written', () => {
  assert.equal(scaleIngredient(ing('salt', 1, 'tsk', false), 4, 8), 1);
  assert.equal(scaleIngredient(ing('peber', null, null), 4, 8), null);
});

test('scaling to the base number of persons changes nothing', () => {
  assert.equal(scaleIngredient(ing('mel', 237, 'g'), 4, 4), 237);
});

test('amounts are shown with a Danish comma and kitchen fractions', () => {
  assert.equal(formatAmount(1500), '1500');
  assert.equal(formatAmount(1.5), '1½');
  assert.equal(formatAmount(0.25), '¼');
  assert.equal(formatAmount(2.75), '2¾');
  assert.equal(formatAmount(2.3), '2,3');
  assert.equal(formatAmount(null), '');
  assert.equal(formatQuantity(250, 'g'), '250 g');
  assert.equal(formatQuantity(3, null), '3');
  assert.equal(formatQuantity(null, 'g'), '');
});

test('amount input accepts comma and point, blank is none, junk is invalid', () => {
  assert.equal(parseAmount('1,5'), 1.5);
  assert.equal(parseAmount('1.5'), 1.5);
  assert.equal(parseAmount(' '), null);
  assert.equal(parseAmount('abc'), undefined);
  assert.equal(parseAmount('-2'), undefined);
  assert.equal(parseAmount('0'), undefined);
});

test('steps from jsonb: objects and strings, blanks dropped, odd data tolerated', () => {
  assert.deepEqual(parseSteps([{ text: ' Rør ' }, 'Bag', { text: '' }, 3, null]), [{ text: 'Rør' }, { text: 'Bag' }]);
  assert.deepEqual(parseSteps(null), []);
  assert.deepEqual(parseSteps({}), []);
});

test('tags are lower-case, unique and without #', () => {
  assert.deepEqual(cleanTags(['Hurtig', '#hurtig', ' ', 'Vegetar']), ['hurtig', 'vegetar']);
});

test('a draft needs a title and sane numbers', () => {
  assert.equal(validateDraft({ ...emptyDraft(), title: 'Brød' }).length, 0);
  assert.equal(validateDraft(emptyDraft())[0].field, 'title');
  assert.ok(validateDraft({ ...emptyDraft(), title: 'x', baseServings: 0 }).some((p) => p.field === 'servings'));
  assert.ok(validateDraft({ ...emptyDraft(), title: 'x', totalMinutes: '1t' }).some((p) => p.field === 'minutes'));
  assert.ok(validateDraft({ ...emptyDraft(), title: 'x', sourceUrl: 'javascript:alert(1)' }).some((p) => p.field === 'source'));
  const bad = validateDraft({ ...emptyDraft(), title: 'x', ingredients: [{ key: 'a', amount: 'meget', unit: '', name: 'mel', note: '', scales: true }] });
  assert.equal(bad[0].field, 'amount');
  assert.equal(bad[0].index, 0);
});

const recipe = (over: Partial<Recipe> & { title: string }): Recipe => ({
  archived_at: null, base_servings: 4, category_id: 'c1', created_at: '2026-01-01', created_by: null, descriptor: null,
  household_id: 'h', id: over.title, image_path: null, nutrition: null, original_text: null, source_url: null, steps: [],
  tags: [], thumb_path: null, total_minutes: null, updated_at: '2026-01-01', ingredients: [], ...over,
});
const withIng = (name: string) => ({ name }) as Recipe['ingredients'][number];

const all = [
  recipe({ title: 'Lasagne', tags: ['hurtig'], ingredients: [withIng('hakket oksekød')] }),
  recipe({ title: 'Brød', category_id: 'c2', tags: ['bagning', 'hurtig'], ingredients: [withIng('mel'), withIng('gær')] }),
  recipe({ title: 'Gammel ret', archived_at: '2026-02-01' }),
  recipe({ title: 'Rødgrød', category_id: 'c2', ingredients: [withIng('jordbær')] }),
];
const none = { categoryId: null, tag: null, query: '' };

test('archived recipes are never listed', () => {
  assert.deepEqual(filterRecipes(all, none).map((r) => r.title), ['Lasagne', 'Brød', 'Rødgrød']);
});

test('category, tag, title and ingredient each find a recipe', () => {
  assert.deepEqual(filterRecipes(all, { ...none, categoryId: 'c2' }).map((r) => r.title), ['Brød', 'Rødgrød']);
  assert.deepEqual(filterRecipes(all, { ...none, tag: 'bagning' }).map((r) => r.title), ['Brød']);
  assert.deepEqual(filterRecipes(all, { ...none, query: 'lasa' }).map((r) => r.title), ['Lasagne']);
  assert.deepEqual(filterRecipes(all, { ...none, query: 'gær' }).map((r) => r.title), ['Brød']);
  assert.deepEqual(filterRecipes(all, { ...none, query: 'oksekød' }).map((r) => r.title), ['Lasagne']);
});

test('every word must match, case does not matter, filters combine', () => {
  assert.deepEqual(filterRecipes(all, { ...none, query: 'BRØD mel' }).map((r) => r.title), ['Brød']);
  assert.deepEqual(filterRecipes(all, { ...none, query: 'brød oksekød' }), []);
  assert.deepEqual(filterRecipes(all, { categoryId: 'c2', tag: 'hurtig', query: '' }).map((r) => r.title), ['Brød']);
});

test('tags in use are counted without archived recipes', () => {
  assert.deepEqual(tagsInUse([...all, recipe({ title: 'x', archived_at: 'y', tags: ['skjult'] })]), ['hurtig', 'bagning']);
});

test('sub paths in the hash: the view still parses and the rest is decoded', () => {
  assert.equal(parseHash('#opskrifter/abc'), 'opskrifter');
  assert.deepEqual(subPath('#opskrifter/abc/rediger'), ['abc', 'rediger']);
  assert.deepEqual(subPath('#opskrifter'), []);
  assert.deepEqual(subPath('#opskrifter/ny?x=1'), ['ny']);
  assert.deepEqual(subPath('#opskrifter/a%20b'), ['a b']);
});
