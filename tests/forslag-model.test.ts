import assert from 'node:assert/strict';
import test from 'node:test';
import { areasFor } from '../supabase/functions/feature-chat/logic.ts';
import { issueBody } from '../supabase/functions/create-issue/logic.ts';
import { areaLabel, areaLabels, areaOptions, effectiveStatus, sortRequests, type FeatureRequest } from '../src/lib/forslag/model.ts';

const req = (over: Partial<FeatureRequest>): FeatureRequest => ({
  id: 'x', title: 't', summary: 's', details: {}, status: 'new', owner_note: null, created_by_name: '',
  created_at: '2026-11-01T10:00:00Z', github_issue_number: null, github_issue_url: null, ...over,
});

test('ferie areas and labels are the ones used today', () => {
  assert.deepEqual(areaOptions('ferie'), [
    ['feriedage', 'Feriedage'], ['rejsekassen', 'Rejsekassen'], ['rejseplan', 'Rejseplan'], ['indstillinger', 'Indstillinger'], ['andet', 'Andet'],
  ]);
});

test('strandparken areas and labels', () => {
  assert.deepEqual(areaOptions('strandparken').map((a) => a[0]), ['hjem', 'madplan', 'lister', 'sundhed', 'opskrifter', 'indstillinger', 'andet']);
  assert.deepEqual(areaOptions('strandparken').map((a) => a[1]), ['Hjem', 'Madplan', 'Lister', 'Sundhed', 'Opskrifter', 'Indstillinger', 'Andet']);
});

test('an unknown area reads as Andet instead of crashing', () => {
  assert.equal(areaLabel('ferie', 'noget-gammelt'), 'Andet');
  assert.equal(areaLabel('strandparken', undefined), 'Andet');
  assert.equal(areaLabel('strandparken', 'madplan'), 'Madplan');
  // An area from the other app is unknown here.
  assert.equal(areaLabel('ferie', 'madplan'), 'Andet');
});

test('areaLabels gives a lookup per app', () => {
  assert.equal(areaLabels('ferie').rejseplan, 'Rejseplan');
  assert.equal(areaLabels('strandparken').opskrifter, 'Opskrifter');
});

test('the owner choice wins over the GitHub issue', () => {
  const r = req({ status: 'approved', github_issue_number: 5 });
  assert.equal(effectiveStatus(r, { 5: 'done' }), 'approved');
});

test('an untouched new request follows a closed issue', () => {
  const r = req({ github_issue_number: 5 });
  assert.equal(effectiveStatus(r, { 5: 'done' }), 'done');
  assert.equal(effectiveStatus(r, { 5: 'declined' }), 'declined');
  assert.equal(effectiveStatus(r, { 5: 'open' }), 'new');
  assert.equal(effectiveStatus(r, {}), 'new');
});

test('a request without an issue keeps its status', () => {
  assert.equal(effectiveStatus(req({}), { 5: 'done' }), 'new');
});

test('open requests come first, newest first within each group', () => {
  const list = [
    req({ id: 'done-new', status: 'done', created_at: '2026-11-05T00:00:00Z' }),
    req({ id: 'open-old', status: 'new', created_at: '2026-11-01T00:00:00Z' }),
    req({ id: 'open-new', status: 'building', created_at: '2026-11-04T00:00:00Z' }),
    req({ id: 'declined-old', status: 'declined', created_at: '2026-10-01T00:00:00Z' }),
    req({ id: 'closed-by-issue', status: 'new', github_issue_number: 9, created_at: '2026-11-06T00:00:00Z' }),
  ];
  const out = sortRequests(list, { 9: 'done' }).map((r) => r.id);
  assert.deepEqual(out, ['open-new', 'open-old', 'closed-by-issue', 'done-new', 'declined-old']);
});

test('sortRequests does not mutate its input', () => {
  const list = [req({ id: 'a', status: 'done' }), req({ id: 'b' })];
  sortRequests(list, {});
  assert.equal(list[0].id, 'a');
});

test('the edge functions know the same areas, with the same labels, as the browser', () => {
  for (const app of ['ferie', 'strandparken'] as const) {
    assert.deepEqual([...areasFor(app)], areaOptions(app).map((a) => a[0]));
    for (const [value, label] of areaOptions(app)) {
      const body = issueBody({ id: '1', app, title: 't', summary: 's', details: { area: value }, created_by_name: '', github_issue_number: null });
      assert.ok(body.includes(`## Område\n${label}\n`), `${app}/${value}`);
    }
  }
});
