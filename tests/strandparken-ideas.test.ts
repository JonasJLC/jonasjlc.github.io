import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalog, cleanIdea, dinnerCategoryId, ideaProblem, type Idea } from '../src/components/strandparken/lib/ideas/model.ts';
import { dishOf, type PlanEntry } from '../src/components/strandparken/lib/madplan/model.ts';
import type { Recipe } from '../src/components/strandparken/lib/recipes/model.ts';

const recipe = (id: string, title: string, over: Partial<Recipe> = {}) => ({ id, title, tags: [], category_id: 'din', archived_at: null, created_at: '2026-11-01T00:00:00Z', ingredients: [], ...over }) as unknown as Recipe;
const idea = (id: string, title: string, over: Partial<Idea> = {}) => ({ id, title, note: null, tags: [], promoted_recipe_id: null, created_at: '2026-11-02T00:00:00Z', ...over }) as Idea;

test('an idea needs only a title', () => {
  assert.equal(ideaProblem({ title: '  ', note: '', tags: [] }), 'Giv idéen et navn.');
  assert.equal(ideaProblem({ title: 'Fiskefrikadeller', note: '', tags: [] }), null);
  assert.deepEqual(cleanIdea({ title: '  Fisk   og  ris ', note: ' ', tags: ['#Hurtig', 'hurtig'] }), { title: 'Fisk og ris', note: null, tags: ['hurtig'] });
});

test('the catalog mixes dinner recipes and ideas, newest first, and says which is which', () => {
  const items = catalog([recipe('r1', 'Lasagne'), recipe('r2', 'Boller i karry')], [idea('i1', 'Pita med falafel')], 'din');
  assert.deepEqual(items.map((i) => [i.kind, i.kind === 'recipe' ? i.recipe.id : i.idea.id]), [['idea', 'i1'], ['recipe', 'r1'], ['recipe', 'r2']]);
});

test('the catalog leaves out other categories, archived recipes and ideas that became recipes', () => {
  const items = catalog(
    [recipe('r1', 'Lasagne'), recipe('r2', 'Brød', { category_id: 'bag' }), recipe('r3', 'Gammel', { archived_at: '2026-11-03T00:00:00Z' })],
    [idea('i1', 'Tacos', { promoted_recipe_id: 'r1' }), idea('i2', 'Sushi')],
    'din',
  );
  assert.deepEqual(items.map((i) => (i.kind === 'recipe' ? i.recipe.id : i.idea.id)).sort(), ['i2', 'r1']);
});

test('search covers title, tags and note, ignoring case and accents', () => {
  const ideas = [idea('i1', 'Sushi', { tags: ['hurtig'] }), idea('i2', 'Suppe', { note: 'Rester fra Søndag' })];
  assert.deepEqual(catalog([], ideas, 'din', 'HURTIG').map((i) => (i.kind === 'idea' ? i.idea.id : '')), ['i1']);
  assert.deepEqual(catalog([], ideas, 'din', 'søndag rester').map((i) => (i.kind === 'idea' ? i.idea.id : '')), ['i2']);
  assert.equal(catalog([], ideas, 'din', 'pizza').length, 0);
});

test('without an Aftensmad category every recipe counts', () => {
  assert.equal(catalog([recipe('r1', 'X', { category_id: null })], [], null).length, 1);
  assert.equal(dinnerCategoryId([{ id: 'a', name: 'Aftensmad' }]), 'a');
  assert.equal(dinnerCategoryId([]), null);
});

test('a planned idea shows its title; once promoted the same day shows the recipe', () => {
  const entry = { id: 'e', idea_id: 'i1', recipe_id: null, free_text: null } as PlanEntry;
  assert.equal(dishOf(entry, [], [idea('i1', 'Sushi')]).title, 'Sushi');
  assert.equal(dishOf(entry, [], []).title, 'Aftensidé');
  const promoted = { ...entry, idea_id: null, recipe_id: 'r1' } as PlanEntry;
  assert.equal(dishOf(promoted, [recipe('r1', 'Sushi bowl')], []).recipe?.id, 'r1');
});
