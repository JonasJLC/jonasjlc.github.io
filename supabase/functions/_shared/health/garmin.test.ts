// Run: deno test --node-modules-dir=none --no-lock --allow-env supabase/functions
// Fixtures are anonymised summaries in the business Health API's shape; the Personal API's own shape is still unconfirmed.
import assert from 'node:assert/strict';
import { HttpError } from '../http.ts';
import { fakeHealthDb } from '../fakes.ts';
import { GARMIN_TOKEN, garminConnect, garminSource, isGarminKey, mapGarmin, type GarminDeps } from './garmin.ts';
import { b64, decrypt, randomBytes, tokenKey } from './tokens.ts';

const who = { householdId: 'h1', person: 'b' as const };
const NOW = Date.parse('2026-11-20T07:00:00Z');
const at = new Date(NOW);
const KEY = 'gpak_0123456789abcdefABCDEF';
const code = async (p: Promise<unknown>) => {
  try { await p; return 'ok'; } catch (e) { return e instanceof HttpError ? `${e.status} ${e.code}` : `other ${e}`; }
};

const DAILIES = [
  { summaryId: 'x1', calendarDate: '2026-11-19', steps: 7500, stepsGoal: 10000, activeKilocalories: 400 },
  { summaryId: 'x2', calendarDate: '2026-11-20', steps: 1200 },
];
const SLEEPS = [{ summaryId: 'y1', calendarDate: '2026-11-20', durationInSeconds: 27000, overallSleepScore: { value: 77, qualifierKey: 'FAIR' } }];

async function setup(handler: (url: string, init?: RequestInit) => Response) {
  const db = fakeHealthDb(() => NOW);
  const key = await tokenKey(b64(randomBytes(32)));
  const calls: { url: string; init?: RequestInit }[] = [];
  const deps: GarminDeps = {
    db,
    key: () => Promise.resolve(key),
    endpoints: { base: 'https://g.test', dailies: '/dailies', sleeps: '/sleeps' },
    now: () => NOW,
    fetch: (url, init) => { calls.push({ url, init }); return Promise.resolve(handler(url, init)); },
  };
  return { db, deps, key, calls };
}

const happy = (url: string) => {
  if (url === GARMIN_TOKEN) return Response.json({ access_token: 'tok', expires_in: 86400 });
  const t = Number(new URL(url).searchParams.get('uploadStartTimeInSeconds'));
  const first = t === Date.parse('2026-11-12T00:00:00Z') / 1000; // return each fixture once
  if (url.startsWith('https://g.test/dailies')) return Response.json(first ? DAILIES : []);
  if (url.startsWith('https://g.test/sleeps')) return Response.json(first ? SLEEPS : []);
  return new Response('', { status: 404 });
};

Deno.test('a key looks like a key', () => {
  assert.equal(isGarminKey(KEY), true);
  assert.equal(isGarminKey('short'), false);
  assert.equal(isGarminKey('has a space in it 1234'), false);
});

Deno.test('mapping: steps, step goal and progress from the daily summary, sleep score from the sleep summary', () => {
  const [d19, d20] = mapGarmin(DAILIES, SLEEPS, '2026-11-13', '2026-11-20', null, at);
  assert.equal(d19.steps, 7500);
  assert.equal(d19.activity_goal, 10000);
  assert.equal(d19.activity_goal_unit, 'steps');
  assert.equal(d19.activity_progress, 0.75);
  assert.equal(d19.sleep_score, null);
  assert.equal(d20.sleep_score, 77);
  assert.equal(d20.activity_goal, null);
});

Deno.test('fallback: without stepsGoal the step goal set in Strandparken is used', () => {
  const [, d20] = mapGarmin(DAILIES, [], '2026-11-13', '2026-11-20', 8000, at);
  assert.equal(d20.activity_goal, 8000);
  assert.equal(d20.activity_progress, 0.15);
});

Deno.test('connect checks the key with a token exchange (ApiKey header) and stores it encrypted', async () => {
  const s = await setup(happy);
  await garminConnect(s.deps, who, KEY, 9000);
  assert.equal(s.calls[0].url, GARMIN_TOKEN);
  assert.equal((s.calls[0].init?.headers as Record<string, string>).Authorization, `ApiKey ${KEY}`);
  const row = await s.db.getTokens(who, 'garmin');
  assert.ok(row?.apiKey && !row.apiKey.includes(KEY));
  assert.equal(await decrypt(row!.apiKey!, s.key), KEY);
  assert.equal(s.db.conns[0].stepGoal, 9000);
});

Deno.test('an expired or deleted key is reconnect, at connect and at sync', async () => {
  const s = await setup((url) => (url === GARMIN_TOKEN ? new Response('', { status: 401 }) : new Response('', { status: 500 })));
  assert.equal(await code(garminConnect(s.deps, who, KEY, null)), '409 reconnect');
  assert.equal(s.db.tokens.size, 0);
  assert.equal(await code(garminSource(s.deps).fetchDays({ ...who, from: '2026-11-13', to: '2026-11-20' })), '409 reconnect');
});

Deno.test('sync exchanges the key each time and maps both summaries', async () => {
  const s = await setup(happy);
  await garminConnect(s.deps, who, KEY, null);
  const days = await garminSource(s.deps).fetchDays({ ...who, from: '2026-11-13', to: '2026-11-20' });
  assert.deepEqual(days.map((d) => [d.date, d.steps, d.sleep_score]), [['2026-11-19', 7500, null], ['2026-11-20', 1200, 77]]);
  assert.equal(s.calls.filter((c) => c.url === GARMIN_TOKEN).length, 2);
  const data = s.calls.find((c) => c.url.startsWith('https://g.test/dailies'))!;
  assert.equal((data.init?.headers as Record<string, string>).Authorization, 'Bearer tok');
});

Deno.test('a missing sleep endpoint keeps steps; both missing is garmin_endpoint', async () => {
  const s = await setup((url) => (url.startsWith('https://g.test/sleeps') ? new Response('', { status: 404 }) : happy(url)));
  await garminConnect(s.deps, who, KEY, null);
  const days = await garminSource(s.deps).fetchDays({ ...who, from: '2026-11-13', to: '2026-11-20' });
  assert.equal(days.length, 2);
  const t = await setup((url) => (url === GARMIN_TOKEN ? happy(url) : new Response('', { status: 404 })));
  await garminConnect(t.deps, who, KEY, null);
  assert.equal(await code(garminSource(t.deps).fetchDays({ ...who, from: '2026-11-13', to: '2026-11-20' })), '502 garmin_endpoint');
});
