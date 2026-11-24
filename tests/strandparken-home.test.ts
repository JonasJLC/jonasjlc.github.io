import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tonightCard } from '../src/components/strandparken/lib/home/tonight.ts';
import type { PlanEntry } from '../src/components/strandparken/lib/madplan/model.ts';
import type { Recipe } from '../src/components/strandparken/lib/recipes/model.ts';
import type { Idea } from '../src/components/strandparken/lib/ideas/model.ts';
import { placeholderFor } from '../src/components/strandparken/lib/recipes/placeholder.ts';

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
