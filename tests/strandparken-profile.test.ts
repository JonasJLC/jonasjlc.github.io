import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Idea } from '../src/components/strandparken/lib/ideas/model.ts';
import { cleanDislikes, dislikeHits, householdDislikes, ideaDislikeHits, profilesFrom, splitDislikes, whoLabel, type ProfileRow } from '../src/components/strandparken/lib/profile/model.ts';
import type { Recipe } from '../src/components/strandparken/lib/recipes/model.ts';

const row = (person: string, dislikes: string[], preferences: string | null = null) => ({ person, dislikes, preferences }) as ProfileRow;
const recipe = (title: string, names: string[]) => ({ title, ingredients: names.map((name) => ({ name })) }) as unknown as Recipe;

test('dislikes are cleaned: lower case, trimmed, no blanks or duplicates, capped', () => {
  assert.deepEqual(cleanDislikes([' Koriander ', 'koriander', '', 'Blå  ost']), ['koriander', 'blå ost']);
  assert.equal(cleanDislikes(Array.from({ length: 80 }, (_, i) => `ting ${i}`)).length, 50);
});

test('typed text splits on commas, semicolons and line breaks', () => {
  assert.deepEqual(splitDislikes('koriander, svampe;\nlakrids'), ['koriander', 'svampe', 'lakrids']);
  assert.deepEqual(splitDislikes('  ,  '), []);
});

test('profiles map the database keys to people and default to empty', () => {
  const p = profilesFrom([row('b', ['koriander'], 'meget grønt')]);
  assert.deepEqual(p.jonas, { person: 'jonas', dislikes: ['koriander'], preferences: 'meget grønt' });
  assert.deepEqual(p.camilla, { person: 'camilla', dislikes: [], preferences: '' });
});

test('household dislikes list each word once and say who dislikes it', () => {
  const d = householdDislikes(profilesFrom([row('b', ['koriander', 'svampe']), row('a', ['svampe'])]));
  assert.deepEqual(d, [{ word: 'koriander', people: ['jonas'] }, { word: 'svampe', people: ['jonas', 'camilla'] }]);
  assert.equal(whoLabel(['jonas', 'camilla']), 'Jonas og Camilla');
});

test('a recipe is flagged by its title or ingredient names, also inside longer words', () => {
  const d = [{ word: 'koriander' }, { word: 'løg' }, { word: 'ananas' }];
  assert.deepEqual(dislikeHits(recipe('Karry', ['Frisk Koriander', 'ris']), d), ['koriander']);
  assert.deepEqual(dislikeHits(recipe('Suppe', ['Hvidløg']), d), ['løg']);
  assert.deepEqual(dislikeHits(recipe('Hawaii-pizza med ananas', []), d), ['ananas']);
  assert.deepEqual(dislikeHits(recipe('Pasta', ['pasta']), d), []);
});

test('an idea can only be checked by title and tags', () => {
  const idea = { title: 'Wok med koriander', tags: ['hurtig'] } as Idea;
  assert.deepEqual(ideaDislikeHits(idea, [{ word: 'koriander' }, { word: 'hurtig' }, { word: 'fisk' }]), ['koriander', 'hurtig']);
});
