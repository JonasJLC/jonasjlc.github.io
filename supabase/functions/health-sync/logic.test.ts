// Run: deno test --node-modules-dir=none --no-lock --allow-env supabase/functions
import assert from 'node:assert/strict';
import { HttpError } from '../_shared/http.ts';
import { fakeHabitsDb, fakeHealthDb } from '../_shared/fakes.ts';
import { day } from '../_shared/health/normalise.ts';
import type { FetchContext, HealthSource, ProviderId } from '../_shared/health/types.ts';
import { AllInput, SelfInput, syncAll, syncPerson, THROTTLE_MS } from './logic.ts';

const NOW = Date.parse('2026-11-20T06:30:00Z'); // 07:30 in Copenhagen
const camilla = { householdId: 'h1', person: 'a' as const };
const jonas = { householdId: 'h1', person: 'b' as const };

function source(id: ProviderId, behaviour: 'ok' | Error = 'ok') {
  const asked: FetchContext[] = [];
  const s: HealthSource & { asked: FetchContext[] } = {
    id,
    asked,
    fetchDays(ctx) {
      asked.push(ctx);
      if (behaviour !== 'ok') return Promise.reject(behaviour);
      return Promise.resolve([day(id, ctx.to, { steps: 1000 }, new Date(NOW)), day(id, ctx.from, { sleep_score: 70 }, new Date(NOW))]);
    },
  };
  return s;
}

async function setup(sources: Partial<Record<ProviderId, HealthSource>>) {
  const db = fakeHealthDb(() => NOW);
  await db.upsertConnection(camilla, 'oura', {});
  await db.upsertConnection(jonas, 'garmin', {});
  return { db, deps: { db, sources, now: () => NOW } };
}

Deno.test('inputs: self with optional force, all with optional hours', () => {
  assert.equal(SelfInput.safeParse({ mode: 'self' }).success, true);
  assert.equal(SelfInput.safeParse({ mode: 'all' }).success, false);
  assert.equal(AllInput.safeParse({ mode: 'all', hours: [7, 19] }).success, true);
  assert.equal(AllInput.safeParse({ mode: 'all', hours: [24] }).success, false);
});

Deno.test('self syncs the caller only, over the last 8 days, and upserts on (household, person, date, source)', async () => {
  const oura = source('oura');
  const garmin = source('garmin');
  const { db, deps } = await setup({ oura, garmin });
  const counts = await syncPerson(deps, camilla);
  assert.deepEqual(counts, { synced: 1, skipped: 0, failed: 0 });
  assert.equal(garmin.asked.length, 0);
  assert.deepEqual(oura.asked[0], { ...camilla, from: '2026-11-13', to: '2026-11-20' });
  assert.equal(db.days.length, 2);
  await syncPerson(deps, camilla, { force: true });
  assert.equal(db.days.length, 2, 'a second sync replaces, it does not duplicate');
  assert.equal(db.conns.find((c) => c.source === 'oura')!.lastSyncedAt, new Date(NOW).toISOString());
});

Deno.test('a sync under 30 minutes old is skipped unless forced', async () => {
  const oura = source('oura');
  const { db, deps } = await setup({ oura });
  db.conns.find((c) => c.source === 'oura')!.lastSyncedAt = new Date(NOW - THROTTLE_MS + 60_000).toISOString();
  assert.deepEqual(await syncPerson(deps, camilla), { synced: 0, skipped: 1, failed: 0 });
  assert.deepEqual(await syncPerson(deps, camilla, { force: true }), { synced: 1, skipped: 0, failed: 0 });
  db.conns.find((c) => c.source === 'oura')!.lastSyncedAt = new Date(NOW - THROTTLE_MS - 1).toISOString();
  assert.equal((await syncPerson(deps, camilla)).synced, 1);
});

Deno.test('a failure records a short code, keeps old rows and does not move last sync', async () => {
  const { db, deps } = await setup({ oura: source('oura') });
  await syncPerson(deps, camilla);
  const synced = db.conns.find((c) => c.source === 'oura')!.lastSyncedAt;
  deps.sources.oura = source('oura', new HttpError(409, 'reconnect'));
  assert.deepEqual(await syncPerson(deps, camilla, { force: true }), { synced: 0, skipped: 0, failed: 1 });
  assert.equal(db.errors.get('h1/a/oura'), 'reconnect');
  assert.equal(db.days.length, 2);
  assert.equal(db.conns.find((c) => c.source === 'oura')!.lastSyncedAt, synced);
  deps.sources.oura = source('oura', new TypeError('secret value in message'));
  await syncPerson(deps, camilla, { force: true });
  assert.equal(db.errors.get('h1/a/oura'), 'internal');
});

Deno.test('a failing source never blocks another (mode all)', async () => {
  const garmin = source('garmin');
  const { db, deps } = await setup({ oura: source('oura', new HttpError(502, 'upstream')), garmin });
  assert.deepEqual(await syncAll(deps), { synced: 1, skipped: 0, failed: 1 });
  assert.equal(garmin.asked.length, 1);
  assert.ok(db.days.every((d) => d.source === 'garmin' && d.person === 'b'));
});

Deno.test('mode all ignores the throttle and runs only in the given Copenhagen hours', async () => {
  const { db, deps } = await setup({ oura: source('oura'), garmin: source('garmin') });
  for (const c of db.conns) c.lastSyncedAt = new Date(NOW - 60_000).toISOString();
  assert.deepEqual(await syncAll(deps, { hours: [7, 19] }), { synced: 2, skipped: 0, failed: 0 });
  assert.deepEqual(await syncAll(deps, { hours: [8] }), { synced: 0, skipped: 0, failed: 0, outOfHours: true });
});

Deno.test('a source without an adapter is a recorded failure', async () => {
  const { db, deps } = await setup({ oura: source('oura') });
  assert.equal((await syncPerson(deps, jonas)).failed, 1);
  assert.equal(db.errors.get('h1/b/garmin'), 'no_adapter');
});

Deno.test('after the days are stored, automatic habits are completed from them (idea 15)', async () => {
  // The fake source returns steps 1000 for `to` and sleep_score 70 for `from`.
  const { db, deps } = await setup({ oura: source('oura') });
  const habits = fakeHabitsDb(db);
  habits.habits.push(
    { ...camilla, id: 'sleep', rule: { metric: 'sleep_score', op: '>', threshold: 65 }, createdAt: '2026-11-01T10:00:00Z' },
    { ...camilla, id: 'steps', rule: { metric: 'steps', op: '>=', threshold: 8000 }, createdAt: '2026-11-01T10:00:00Z' },
  );
  const counts = await syncPerson({ ...deps, habits }, camilla);
  assert.deepEqual(counts, { synced: 1, skipped: 0, failed: 0, habits: 1 });
  assert.deepEqual(habits.completions, [{ householdId: 'h1', habitId: 'sleep', date: '2026-11-13', person: 'a' }]);
  assert.equal((await syncPerson({ ...deps, habits }, camilla, { force: true })).habits, 0, 'a second sync adds nothing');
});

Deno.test('a habits failure never fails the sync', async () => {
  const { db, deps } = await setup({ oura: source('oura') });
  const habits = fakeHabitsDb(db);
  habits.habits.push({ ...camilla, id: 'sleep', rule: { metric: 'sleep_score', op: '>', threshold: 65 }, createdAt: '2026-11-01T10:00:00Z' });
  habits.broken = true;
  const log = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(await syncPerson({ ...deps, habits }, camilla), { synced: 1, skipped: 0, failed: 0, habits: 0 });
  } finally {
    console.error = log;
  }
  assert.equal(db.errors.get('h1/a/oura'), null);
  assert.equal(db.days.length, 2);
});

Deno.test('a failed sync completes no habits, and mode all covers every person', async () => {
  const { db, deps } = await setup({ oura: source('oura', new HttpError(409, 'reconnect')), garmin: source('garmin') });
  const habits = fakeHabitsDb(db);
  habits.habits.push({ ...jonas, id: 'j', rule: { metric: 'sleep_score', op: '>', threshold: 65 }, createdAt: '2026-11-01T10:00:00Z' });
  const counts = await syncAll({ ...deps, habits });
  assert.deepEqual(counts, { synced: 1, skipped: 0, failed: 1, habits: 1 });
  assert.deepEqual(habits.completions.map((c) => c.person), ['b']);
});
