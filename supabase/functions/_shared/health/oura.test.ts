// Run: deno test --node-modules-dir=none --no-lock --allow-env supabase/functions
// Fixtures are anonymised, shortened responses in the shape of Oura API v2 (OpenAPI 1.43).
import assert from 'node:assert/strict';
import { HttpError } from '../http.ts';
import { fakeHealthDb } from '../fakes.ts';
import { mapOura, ouraAccessToken, ouraAuthorizeUrl, ouraConnect, ouraSource, type OuraDeps } from './oura.ts';
import { b64, decrypt, encrypt, randomBytes, tokenKey } from './tokens.ts';

const who = { householdId: 'h1', person: 'a' as const };
const NOW = Date.parse('2026-11-20T07:00:00Z');
const at = new Date(NOW);
const code = async (p: Promise<unknown>) => {
  try { await p; return 'ok'; } catch (e) { return e instanceof HttpError ? `${e.status} ${e.code}` : `other ${e}`; }
};

const SLEEP = {
  data: [
    { id: 's1', day: '2026-11-19', score: 81, timestamp: '2026-11-19T00:00:00+00:00', contributors: {} },
    { id: 's2', day: '2026-11-20', score: 0, timestamp: '2026-11-20T00:00:00+00:00', contributors: {} },
  ],
  next_token: null,
};
const ACTIVITY = {
  data: [
    { id: 'a1', day: '2026-11-19', steps: 8421, active_calories: 412, target_calories: 500, score: 88, target_meters: 9000, meters_to_target: 1200 },
    { id: 'a2', day: '2026-11-20', steps: 310, active_calories: 20, target_calories: 0, score: null },
    { id: 'a3', day: '2026-11-10', steps: 5000, active_calories: 100, target_calories: 500 },
  ],
  next_token: null,
};

async function setup(opts: { expiresIn?: number; responses?: (url: string, init?: RequestInit) => Response | Promise<Response> } = {}) {
  let clock = NOW;
  const db = fakeHealthDb(() => clock);
  const key = await tokenKey(b64(randomBytes(32)));
  const calls: { url: string; init?: RequestInit }[] = [];
  let refreshCount = 0;
  const deps: OuraDeps = {
    db,
    key: () => Promise.resolve(key),
    client: () => ({ id: 'cid', secret: 'csecret' }),
    now: () => clock,
    wait: (ms) => { clock += ms; return new Promise((r) => setTimeout(r, 10)); },
    fetch: async (url, init) => {
      calls.push({ url, init });
      if (opts.responses) return opts.responses(url, init);
      if (url.startsWith('https://api.ouraring.com/oauth/token')) {
        const form = new URLSearchParams(String(init?.body));
        if (form.get('grant_type') === 'refresh_token') refreshCount++;
        await new Promise((r) => setTimeout(r, 5)); // let a concurrent run reach the lease
        return Response.json({ access_token: `acc${refreshCount}`, refresh_token: `ref${refreshCount}`, expires_in: 86400, token_type: 'bearer' });
      }
      if (url.includes('/daily_sleep')) return Response.json(SLEEP);
      if (url.includes('/daily_activity')) return Response.json(ACTIVITY);
      return new Response('nope', { status: 404 });
    },
  };
  await db.putTokens(who, 'oura', {
    access: await encrypt('acc0', key),
    refresh: await encrypt('ref0', key),
    expiresAt: new Date(NOW + (opts.expiresIn ?? 3600) * 1000).toISOString(),
  });
  await db.upsertConnection(who, 'oura', {});
  return { db, deps, key, calls, refreshes: () => refreshCount };
}

Deno.test('authorise URL carries code flow, scope daily, state and an S256 challenge', () => {
  const u = new URL(ouraAuthorizeUrl({ clientId: 'cid', redirectUri: 'https://x.supabase.co/functions/v1/health-oauth', state: 'st', challenge: 'ch' }));
  assert.equal(u.origin + u.pathname, 'https://cloud.ouraring.com/oauth/authorize');
  assert.equal(u.searchParams.get('response_type'), 'code');
  assert.equal(u.searchParams.get('scope'), 'daily');
  assert.equal(u.searchParams.get('state'), 'st');
  assert.equal(u.searchParams.get('code_challenge'), 'ch');
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
});

Deno.test('mapping: sleep score, steps, kcal goal and progress; 0 score and 0 target are null; outside range dropped', () => {
  const days = mapOura(SLEEP.data, ACTIVITY.data, '2026-11-13', '2026-11-20', at);
  assert.deepEqual(days.map((d) => d.date), ['2026-11-19', '2026-11-20']);
  const [d19, d20] = days;
  assert.equal(d19.sleep_score, 81);
  assert.equal(d19.steps, 8421);
  assert.equal(d19.activity_goal, 500);
  assert.equal(d19.activity_goal_unit, 'kcal');
  assert.equal(d19.activity_progress, 0.824);
  assert.equal(d19.source, 'oura');
  assert.equal(d20.sleep_score, null);
  assert.equal(d20.activity_goal, null);
  assert.equal(d20.activity_progress, null);
  assert.equal(d20.steps, 310);
});

Deno.test('connect exchanges the code with the verifier and stores the pair encrypted', async () => {
  const s = await setup();
  await s.db.deleteTokens(who, 'oura');
  await ouraConnect(s.deps, who, { code: 'c0de', verifier: 'v3rifier', redirectUri: 'https://r' });
  const form = new URLSearchParams(String(s.calls[0].init?.body));
  assert.equal(form.get('grant_type'), 'authorization_code');
  assert.equal(form.get('code_verifier'), 'v3rifier');
  assert.equal((s.calls[0].init?.headers as Record<string, string>)['User-Agent'], 'Strandparken/1.0');
  const row = await s.db.getTokens(who, 'oura');
  assert.ok(row?.access && !row.access.includes('acc0'));
  assert.equal(await decrypt(row!.access!, s.key), 'acc0');
});

Deno.test('a fresh access token is used without refreshing', async () => {
  const s = await setup();
  assert.equal(await ouraAccessToken(s.deps, who), 'acc0');
  assert.equal(s.refreshes(), 0);
});

Deno.test('concurrent refreshes spend the single-use refresh token once and store exactly one new pair', async () => {
  const s = await setup({ expiresIn: 10 });
  const versionBefore = (await s.db.getTokens(who, 'oura'))!.version;
  const [a, b] = await Promise.all([ouraAccessToken(s.deps, who), ouraAccessToken(s.deps, who)]);
  assert.equal(s.refreshes(), 1);
  assert.equal(a, 'acc1');
  assert.equal(b, 'acc1');
  const row = (await s.db.getTokens(who, 'oura'))!;
  assert.equal(row.version, versionBefore + 1);
  assert.equal(await decrypt(row.refresh!, s.key), 'ref1');
});

Deno.test('a 401 on data refreshes once; a 401 after the refresh means reconnect', async () => {
  let refreshed = 0;
  const s = await setup({
    responses: (url, init) => {
      if (url.includes('/oauth/token')) {
        refreshed++;
        return Response.json({ access_token: `n${refreshed}`, refresh_token: `r${refreshed}`, expires_in: 86400 });
      }
      void init;
      return new Response('', { status: 401 });
    },
  });
  const source = ouraSource(s.deps);
  assert.equal(await code(source.fetchDays({ ...who, from: '2026-11-13', to: '2026-11-20' })), '409 reconnect');
  assert.equal(refreshed, 1);
});

Deno.test('a spent refresh token (400 invalid_grant) means reconnect', async () => {
  const s = await setup({ expiresIn: 10, responses: () => Response.json({ error: 'invalid_grant' }, { status: 400 }) });
  assert.equal(await code(ouraAccessToken(s.deps, who)), '409 reconnect');
});

Deno.test('no stored grant means reconnect; 403 from Oura means no_access', async () => {
  const s = await setup({ responses: () => new Response('', { status: 403 }) });
  assert.equal(await code(ouraSource(s.deps).fetchDays({ ...who, from: '2026-11-13', to: '2026-11-20' })), '409 no_access');
  await s.db.deleteTokens(who, 'oura');
  assert.equal(await code(ouraAccessToken(s.deps, who)), '409 reconnect');
});

Deno.test('fetchDays asks for the range with end_date one day later and returns mapped days', async () => {
  const s = await setup();
  const days = await ouraSource(s.deps).fetchDays({ ...who, from: '2026-11-13', to: '2026-11-20' });
  assert.equal(days.length, 2);
  const sleepCall = new URL(s.calls.find((c) => c.url.includes('daily_sleep'))!.url);
  assert.equal(sleepCall.searchParams.get('start_date'), '2026-11-13');
  assert.equal(sleepCall.searchParams.get('end_date'), '2026-11-21');
  assert.equal((s.calls[0].init?.headers as Record<string, string>).Authorization, 'Bearer acc0');
});
