import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectSource, findBySource, importErrorMessage, normaliseUrl, toDraft, type ImportedRecipe } from '../src/components/strandparken/lib/recipes/import.ts';
import type { GroceryCategory } from '../src/components/strandparken/lib/shopping/model.ts';

const groceries = [{ id: 'g1', name: 'Kød & fisk', position: 0 }, { id: 'g2', name: 'Andet', position: 1 }] as GroceryCategory[];
const imported = (over: Partial<ImportedRecipe> = {}): ImportedRecipe => ({
  title: ' Kyllingegryde ', descriptor: null, servings: 4, totalMinutes: 45, tags: ['Hurtig', 'hurtig', 'a', 'b', 'c', 'd'],
  ingredients: [
    { amount: 1.5, unit: 'dl', name: 'fløde', canonicalName: 'Fløde', groceryCategory: 'Kød & fisk', note: null, scales: true },
    { amount: null, unit: null, name: 'salt', canonicalName: 'salt', groceryCategory: 'Findes ikke', note: 'efter smag', scales: false },
  ],
  steps: ['Steg.', ' '], unsure: [], sourceUrl: 'https://www.instagram.com/p/x/', originalText: 'original', ...over,
});

test('social links are recognised, other links are web, nonsense is not a link', () => {
  assert.equal(detectSource('https://www.instagram.com/reel/Cabc/')?.source, 'instagram');
  assert.equal(detectSource('instagram.com/p/abc')?.source, 'instagram');
  assert.equal(detectSource('https://vm.tiktok.com/ZM123/')?.source, 'tiktok');
  assert.equal(detectSource('https://fb.watch/abc/')?.source, 'facebook');
  assert.equal(detectSource('https://youtu.be/abc')?.source, 'youtube');
  assert.equal(detectSource('https://www.dr.dk/mad/opskrift/x')?.source, 'web');
  assert.equal(detectSource('notinstagram.com/p/1')?.source, 'web');
  assert.equal(detectSource('ikke et link'), null);
  assert.equal(detectSource('javascript:alert(1)'), null);
});

test('an import becomes an editable draft with Danish decimals, grocery categories and the original text', () => {
  const d = toDraft(imported(), 'din', groceries);
  assert.equal(d.title, 'Kyllingegryde');
  assert.equal(d.categoryId, 'din');
  assert.deepEqual(d.tags, ['hurtig', 'a', 'b']);
  assert.equal(d.ingredients[0].amount, '1,5');
  assert.equal(d.ingredients[0].canonicalName, 'fløde');
  assert.equal(d.ingredients[0].groceryCategoryId, 'g1');
  assert.equal(d.ingredients[1].groceryCategoryId, 'g2'); // unknown category falls back to Andet
  assert.equal(d.ingredients[1].scales, false);
  assert.deepEqual(d.steps, ['Steg.']);
  assert.equal(d.sourceUrl, 'https://www.instagram.com/p/x/');
  assert.equal(d.originalText, 'original');
  assert.equal(d.totalMinutes, '45');
});

test('missing servings or time are always marked for a second look; odd servings fall back to 4', () => {
  const d = toDraft(imported({ servings: null, totalMinutes: null }), null, []);
  assert.deepEqual([...d.unsure].sort(), ['servings', 'time']);
  assert.equal(d.baseServings, 4);
  assert.equal(d.totalMinutes, '');
  assert.equal(toDraft(imported({ servings: 99 }), null, []).baseServings, 4);
  assert.equal(toDraft(imported({ ingredients: [], steps: [] }), null, []).ingredients.length, 1); // the editor always has a line to type in
});

test('every error code has a plain Danish message, and unknown ones do not leak', () => {
  for (const code of ['not_a_recipe', 'rate_limited', 'budget_exceeded', 'refused', 'bad_request', 'unauthorized', 'not_configured', undefined, 'whatever']) {
    assert.match(importErrorMessage(code), /\S{3}/);
  }
  assert.equal(importErrorMessage('whatever').includes('whatever'), false);
});

test('the same page is recognised through www, tracking parameters, fragments and a trailing slash', () => {
  const base = normaliseUrl('https://www.dr.dk/mad/opskrift/x/?utm_source=fb&fbclid=abc#top');
  assert.equal(base, 'dr.dk/mad/opskrift/x');
  assert.equal(normaliseUrl('http://dr.dk/mad/opskrift/x'), base);
  assert.notEqual(normaliseUrl('https://dr.dk/mad/opskrift/y'), base);
  assert.equal(normaliseUrl('https://example.com/r?id=2&b=1'), normaliseUrl('https://example.com/r?b=1&id=2'));
  assert.notEqual(normaliseUrl('https://example.com/r?id=2'), normaliseUrl('https://example.com/r?id=3'));
  assert.equal(normaliseUrl('ikke et link'), null);
});

test('an earlier import of the same link is found, other recipes and recipes without a source are not', () => {
  const recipes = [{ id: 'a', source_url: null }, { id: 'b', source_url: 'https://www.dr.dk/mad/opskrift/x/' }, { id: 'c', source_url: 'https://dr.dk/mad/opskrift/y' }];
  assert.equal(findBySource(recipes, 'dr.dk/mad/opskrift/x?utm_medium=mail')?.id, 'b');
  assert.equal(findBySource(recipes, 'https://dr.dk/andet'), null);
  assert.equal(findBySource(recipes, 'nonsense'), null);
});

test('the function\'s link errors have Danish messages', () => {
  for (const code of ['bad_url', 'blocked', 'fetch_failed', 'not_html', 'too_large']) {
    assert.notEqual(importErrorMessage(code), importErrorMessage(undefined), code);
  }
});
