import assert from 'node:assert/strict';
import { test } from 'node:test';
import { categoryName, placeholderFor, tones } from '../src/components/strandparken/lib/recipes/placeholder.ts';

test('a tag beats the category', () => {
  assert.deepEqual(placeholderFor({ title: 'Ovnbagt', category: 'Aftensmad', tags: ['fisk'] }), { tone: 'sky', icon: 'fish' });
});

test('each D30 category has its own tone and icon', () => {
  const expected = {
    Aftensmad: ['clay', 'utensils'], 'Tilbehør & salat': ['sage', 'salad'], Frokost: ['honey', 'sandwich'],
    'Morgenmad & brunch': ['honey', 'egg'], Bagværk: ['oat', 'croissant'], Sødt: ['plum', 'cake'],
    'Snacks & dip': ['rose', 'popcorn'], Drikke: ['mint', 'cup'],
  };
  for (const [category, [tone, icon]] of Object.entries(expected))
    assert.deepEqual(placeholderFor({ title: 'X', category }), { tone, icon }, category);
});

test('category matching folds case and accents', () => {
  assert.deepEqual(placeholderFor({ title: 'X', category: 'tilbehør & salat' }), { tone: 'sage', icon: 'salad' });
  assert.deepEqual(placeholderFor({ title: 'X', category: 'BAGVÆRK' }), { tone: 'oat', icon: 'croissant' });
  assert.deepEqual(placeholderFor({ title: 'X', category: '  sødt ' }), { tone: 'plum', icon: 'cake' });
});

test('tag words map to tone and icon', () => {
  const cases: [string, string, string][] = [
    ['fisk', 'sky', 'fish'], ['laks', 'sky', 'fish'], ['torsk', 'sky', 'fish'],
    ['rejer', 'sky', 'shrimp'], ['skaldyr', 'sky', 'shrimp'], ['kylling', 'honey', 'drumstick'],
    ['oksekød', 'clay', 'beef'], ['bøf', 'clay', 'beef'], ['burger', 'clay', 'beef'],
    ['vegetar', 'sage', 'leaf'], ['vegansk', 'sage', 'leaf'], ['grønt', 'sage', 'leaf'],
    ['suppe', 'clay', 'soup'], ['pasta', 'honey', 'wheat'], ['pizza', 'rose', 'pizza'],
    ['mexicansk', 'rose', 'flame'], ['stærk', 'rose', 'flame'], ['dessert', 'plum', 'cake'], ['kage', 'plum', 'cake'],
    ['is', 'mint', 'ice-cream'], ['salat', 'sage', 'salad'], ['Kylling', 'honey', 'drumstick'],
  ];
  for (const [tag, tone, icon] of cases) assert.deepEqual(placeholderFor({ title: 'X', tags: [tag] }), { tone, icon }, tag);
});

test('the first matching tag in the recipe’s own order wins', () => {
  assert.deepEqual(placeholderFor({ title: 'X', tags: ['hurtig', 'pasta', 'fisk'] }), { tone: 'honey', icon: 'wheat' });
  assert.deepEqual(placeholderFor({ title: 'X', tags: ['fisk', 'pasta'] }), { tone: 'sky', icon: 'fish' });
});

test('a tag that is not a food word falls through to the category', () => {
  assert.deepEqual(placeholderFor({ title: 'X', category: 'Frokost', tags: ['hurtig', 'børnevenlig'] }), { tone: 'honey', icon: 'sandwich' });
});

test('no match: stable tone from the title, cutlery icon', () => {
  const a = placeholderFor({ title: 'Mormors gryde' });
  assert.deepEqual(placeholderFor({ title: 'Mormors gryde' }), a);
  assert.deepEqual(placeholderFor({ title: '  MORMORS   gryde ' }), a);
  assert.equal(a.icon, 'utensils');
  assert.ok(tones.includes(a.tone));
  const titles = ['Lasagne', 'Risotto', 'Tærte', 'Boller', 'Gryderet', 'Frikadeller', 'Æggekage', 'Chili sin carne', 'Tarteletter', 'Biksemad'];
  const used = new Set(titles.map((title) => placeholderFor({ title }).tone));
  assert.ok(used.size >= 4, `only ${used.size} tones`);
});

test('the quick dinners get fixed tiles', () => {
  assert.equal(placeholderFor({ title: 'Rester' }).icon, 'utensils');
  assert.equal(placeholderFor({ title: 'Ude at spise' }).icon, 'wine');
  assert.equal(placeholderFor({ title: 'Takeaway' }).icon, 'hamburger');
});

test('categoryName looks up by id', () => {
  const cats = [{ id: 'a', name: 'Sødt' }];
  assert.equal(categoryName(cats, 'a'), 'Sødt');
  assert.equal(categoryName(cats, 'b'), null);
  assert.equal(categoryName(cats, null), null);
});
