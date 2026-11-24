import assert from 'node:assert/strict';
import { test } from 'node:test';
import { backfillCandidates, fitWithin, type PhotoRecipe } from '../src/components/strandparken/lib/recipes/photo-jobs-model.ts';

test('fitWithin scales the long side down to the limit and never upscales', () => {
  assert.deepEqual(fitWithin(4000, 3000, 1200), { w: 1200, h: 900 });
  assert.deepEqual(fitWithin(3000, 4000, 1200), { w: 900, h: 1200 });
  assert.deepEqual(fitWithin(800, 600, 1200), { w: 800, h: 600 });
  assert.deepEqual(fitWithin(1200, 1200, 1200), { w: 1200, h: 1200 });
  assert.deepEqual(fitWithin(5000, 100, 400), { w: 400, h: 8 });
  assert.deepEqual(fitWithin(10, 5000, 400), { w: 1, h: 400 });
});

const recipe = (over: Partial<PhotoRecipe> = {}): PhotoRecipe => ({
  id: 'r1', archived_at: null, source_url: 'https://www.dr.dk/mad/opskrift/x', image_source_url: null, image_path: null, image_fetch_attempted_at: null, ...over,
});

test('the backfill picks recipes with a link, no photo and no earlier attempt', () => {
  assert.deepEqual(backfillCandidates([recipe()]), [{ id: 'r1', source: { kind: 'page', url: 'https://www.dr.dk/mad/opskrift/x' } }]);
  // An import whose job was interrupted keeps the photo address: that is fetched directly.
  assert.deepEqual(
    backfillCandidates([recipe({ image_source_url: 'https://cdn.example.dk/a.jpg' })]),
    [{ id: 'r1', source: { kind: 'image', url: 'https://cdn.example.dk/a.jpg' } }],
  );
  assert.deepEqual(backfillCandidates([recipe({ source_url: null, image_source_url: 'https://cdn.example.dk/a.jpg' })]).map((c) => c.source.kind), ['image']);
});

test('the backfill skips archived, already photographed, already tried, link-less and social recipes', () => {
  const skipped = [
    recipe({ archived_at: '2026-11-01T00:00:00Z' }),
    recipe({ image_path: 'h/r/a.jpg' }),
    recipe({ image_fetch_attempted_at: '2026-11-20T00:00:00Z' }),
    recipe({ source_url: null }),
    recipe({ source_url: 'https://www.instagram.com/p/abc/' }),
    recipe({ source_url: 'https://vm.tiktok.com/ZM1/' }),
    recipe({ source_url: 'ikke et link' }),
  ];
  assert.deepEqual(backfillCandidates(skipped), []);
  const mixed = [recipe({ id: 'a' }), recipe({ id: 'b', image_path: 'x' }), recipe({ id: 'c', source_url: 'https://example.dk/y' })];
  assert.deepEqual(backfillCandidates(mixed).map((c) => c.id), ['a', 'c']);
});
