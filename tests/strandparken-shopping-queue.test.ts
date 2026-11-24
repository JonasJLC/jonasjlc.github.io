import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ShoppingRow } from '../src/components/strandparken/lib/shopping/model.ts';
import { applyOps, compact, loadCache, loadQueue, type Op } from '../src/components/strandparken/lib/shopping/queue.ts';

const row = (id: string, status: ShoppingRow['status'] = 'active') =>
  ({ id, name: id, status, household_id: 'h', canonical_name: id, amount: null, unit: null, grocery_category_id: null, source: 'manual', client_updated_at: null }) as ShoppingRow;
const status = (opId: string, ids: string[], s: ShoppingRow['status'], at: string): Op => ({ opId, at, kind: 'status', ids, status: s, by: 'u' });

test('queued ticks show at once, in order', () => {
  const out = applyOps([row('a'), row('b')], [status('1', ['a'], 'checked', '2026-11-15T10:00:00Z'), status('2', ['a'], 'active', '2026-11-15T10:01:00Z')]);
  assert.deepEqual(out.map((r) => r.status), ['active', 'active']);
  assert.equal(applyOps([row('a')], [status('1', ['a'], 'checked', '2026-11-15T10:00:00Z')])[0].status, 'checked');
});

test('an item added offline appears on the list once, even if the server already has it', () => {
  const add: Op = { opId: '1', at: '2026-11-15T10:00:00Z', kind: 'add', row: { id: 'n', household_id: 'h', name: 'Mælk', grocery_category_id: null } };
  assert.equal(applyOps([], [add]).length, 1);
  assert.equal(applyOps([row('n')], [add]).length, 1);
  assert.equal(applyOps([], [add])[0].canonical_name, 'mælk');
});

test('compact keeps only the last change per row', () => {
  const ops = [status('1', ['a', 'b'], 'checked', 't1'), status('2', ['a'], 'active', 't2')];
  const out = compact(ops);
  assert.deepEqual(out.map((o) => (o.kind === 'status' ? [o.opId, o.ids] : null)), [['1', ['b']], ['2', ['a']]]);
  assert.equal(compact([status('1', ['a'], 'checked', 't1'), status('2', ['a'], 'cleared', 't2')]).length, 1);
});

test('no storage at all is fine', () => {
  assert.deepEqual(loadQueue('h'), []);
  assert.equal(loadCache('h'), null);
});

test('a cache written before dates and unit preferences gets empty defaults', () => {
  const store = new Map<string, string>([['strandparken:shopping:cache:h', JSON.stringify({ rows: [row('a')], categories: [] })]]);
  const g = globalThis as { localStorage?: unknown };
  const before = g.localStorage;
  g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
  try {
    const c = loadCache('h');
    assert.deepEqual([c?.rows.length, c?.dates, c?.prefs], [1, {}, {}]);
  } finally {
    g.localStorage = before;
  }
});
