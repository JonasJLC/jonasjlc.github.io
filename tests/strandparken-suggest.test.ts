import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Idea } from '../src/components/strandparken/lib/ideas/model.ts';
import type { PlanEntry } from '../src/components/strandparken/lib/madplan/model.ts';
import type { Profile } from '../src/components/strandparken/lib/profile/model.ts';
import type { Recipe } from '../src/components/strandparken/lib/recipes/model.ts';
import { buildCandidates, emptyMessage, suggestErrorMessage } from '../src/components/strandparken/lib/suggest/model.ts';

const today = '2026-11-18';
const recipe = (id: string, title: string, ing: string[] = [], created = '2026-01-01T10:00:00Z') =>
  ({ id, title, tags: [], category_id: 'dinner', created_at: created, archived_at: null, ingredients: ing.map((name) => ({ name })) }) as unknown as Recipe;
const idea = (id: string, title: string) => ({ id, title, tags: [], note: null, created_at: '2026-01-01T10:00:00Z', promoted_recipe_id: null }) as unknown as Idea;
const entry = (date: string, o: { recipe_id?: string; idea_id?: string; free_text?: string }) =>
  ({ id: `e-${date}`, date, recipe_id: o.recipe_id ?? null, idea_id: o.idea_id ?? null, free_text: o.free_text ?? null }) as unknown as PlanEntry;

const base = {
  recipes: [recipe('r1', 'Lasagne'), recipe('r2', 'Gryde med koriander', ['koriander']), recipe('r3', 'Fiskefrikadeller')],
  ideas: [idea('i1', 'Wok')],
  dinnerCategoryId: 'dinner',
  week: [] as PlanEntry[],
  history: [] as PlanEntry[],
  today,
  dislikes: [{ word: 'koriander' }],
  profiles: [] as Profile[],
  skip: new Set<string>(),
  titleOf: (e: PlanEntry) => e.free_text ?? e.recipe_id ?? '',
};
const ids = (b: ReturnType<typeof buildCandidates>) => (b.status === 'ok' ? b.request.candidates.map((c) => c.id).sort() : []);

test('dishes with a disliked word are left out while others remain', () => {
  const b = buildCandidates(base);
  assert.deepEqual(ids(b), ['i1', 'r1', 'r3']);
  assert.equal(b.status === 'ok' && b.allFlagged, false);
});

test('when only disliked dishes are left, they are offered marked with the words', () => {
  const b = buildCandidates({ ...base, recipes: [base.recipes[1]], ideas: [] });
  assert.equal(b.status === 'ok' && b.allFlagged, true);
  assert.deepEqual(b.status === 'ok' && b.request.candidates[0].dislikeHits, ['koriander']);
});

test('dishes already on the week are not candidates', () => {
  const b = buildCandidates({ ...base, week: [entry('2026-11-19', { recipe_id: 'r1' }), entry('2026-11-20', { idea_id: 'i1' })] });
  assert.deepEqual(ids(b), ['r3']);
});

test('dishes cooked in the last 14 days are out; older ones are in and counted', () => {
  const history = [entry('2026-11-10', { recipe_id: 'r1' }), entry('2026-10-01', { recipe_id: 'r3' }), entry('2026-09-20', { recipe_id: 'r3' })];
  const b = buildCandidates({ ...base, history });
  assert.deepEqual(ids(b), ['i1', 'r3']);
  assert.equal(b.status === 'ok' && b.request.candidates.find((c) => c.id === 'r3')?.cooked, 2);
});

test('exactly 14 days ago is still recent, 15 days ago is not; today and later do not count as cooked', () => {
  const b14 = buildCandidates({ ...base, history: [entry('2026-11-04', { recipe_id: 'r1' })] });
  assert.equal(ids(b14).includes('r1'), false);
  const b15 = buildCandidates({ ...base, history: [entry('2026-11-03', { recipe_id: 'r1' })] });
  assert.equal(ids(b15).includes('r1'), true);
  const bToday = buildCandidates({ ...base, history: [entry(today, { recipe_id: 'r1' })] });
  assert.equal(ids(bToday).includes('r1'), true);
});

test('Nyt forslag skips what was already suggested', () => {
  assert.deepEqual(ids(buildCandidates({ ...base, skip: new Set(['r1', 'i1']) })), ['r3']);
});

test('nothing left says why', () => {
  const none = buildCandidates({ ...base, recipes: [], ideas: [] });
  assert.deepEqual(none, { status: 'empty', why: 'no-dishes' });
  const used = buildCandidates({ ...base, skip: new Set(['r1', 'r2', 'r3', 'i1']) });
  assert.deepEqual(used, { status: 'empty', why: 'all-used' });
  assert.match(emptyMessage('no-dishes'), /Tilføj en opskrift/);
  assert.match(emptyMessage('all-used'), /14 dage/);
});

test('recipes outside Aftensmad are not candidates; recently saved dishes are marked; the request carries week, dislikes and preferences', () => {
  const other = { ...recipe('r9', 'Kage'), category_id: 'dessert' } as Recipe;
  const fresh = recipe('r4', 'Ny ret', [], '2026-11-15T10:00:00Z');
  const profiles: Profile[] = [{ person: 'camilla', dislikes: [], preferences: ' gerne fisk ' }, { person: 'jonas', dislikes: [], preferences: '' }];
  const b = buildCandidates({ ...base, recipes: [...base.recipes, other, fresh], profiles, week: [entry('2026-11-19', { free_text: 'Takeaway' })] });
  assert.equal(b.status === 'ok' && b.request.candidates.some((c) => c.id === 'r9'), false);
  assert.equal(b.status === 'ok' && b.request.candidates.find((c) => c.id === 'r4')?.savedRecently, true);
  assert.equal(b.status === 'ok' && b.request.candidates.find((c) => c.id === 'r1')?.savedRecently, false);
  assert.deepEqual(b.status === 'ok' && b.request.week, ['Takeaway']);
  assert.deepEqual(b.status === 'ok' && b.request.dislikes, ['koriander']);
  assert.deepEqual(b.status === 'ok' && b.request.preferences, ['Camilla: gerne fisk']);
});

test('at most 60 candidates are sent', () => {
  const many = Array.from({ length: 80 }, (_, i) => recipe(`m${i}`, `Ret ${i}`));
  const b = buildCandidates({ ...base, recipes: many, ideas: [] });
  assert.equal(b.status === 'ok' && b.request.candidates.length, 60);
});

test('error codes map to Danish messages', () => {
  assert.match(suggestErrorMessage('rate_limited'), /dagens forslag/);
  assert.match(suggestErrorMessage('budget_exceeded'), /budget/);
  assert.match(suggestErrorMessage(undefined), /Prøv igen/);
});
