// Run: deno test --node-modules-dir=none --no-lock --allow-env supabase/functions
import assert from 'node:assert/strict';
import { HttpError } from '../_shared/http.ts';
import { fakeCaller, fakeHealthDb } from '../_shared/fakes.ts';
import { GARMIN_TOKEN } from '../_shared/health/garmin.ts';
import { b64, derivedKey, randomBytes, seal, tokenKey, unseal } from '../_shared/health/tokens.ts';
import { appOrigin, callback, Input, run, STATE_TTL_MS, type OAuthDeps } from './logic.ts';

const NOW = Date.parse('2026-11-20T07:00:00Z');
const REDIRECT = 'https://proj.supabase.co/functions/v1/health-oauth';
const code = async (p: Promise<unknown>) => {
  try { await p; return 'ok'; } catch (e) { return e instanceof HttpError ? `${e.status} ${e.code}` : `other ${e}`; }
};

async function setup(opts: { clientMissing?: boolean } = {}) {
  let clock = NOW;
  const db = fakeHealthDb(() => clock);
  const key = await tokenKey(b64(randomBytes(32)));
  const stateKey = await derivedKey('state-secret-long-enough');
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetch = (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url.startsWith('https://api.ouraring.com/oauth/token')) return Promise.resolve(Response.json({ access_token: 'a', refresh_token: 'r', expires_in: 86400 }));
    if (url === GARMIN_TOKEN) return Promise.resolve(Response.json({ access_token: 'g' }));
    return Promise.resolve(new Response('', { status: 200 }));
  };
  const deps: OAuthDeps = {
    db,
    stateKey: () => Promise.resolve(stateKey),
    redirectUri: REDIRECT,
    now: () => clock,
    oura: {
      db, key: () => Promise.resolve(key), fetch, now: () => clock, wait: () => Promise.resolve(),
      client: () => { if (opts.clientMissing) throw new HttpError(503, 'not_configured'); return { id: 'cid', secret: 'cs' }; },
    },
    garmin: { db, key: () => Promise.resolve(key), fetch, now: () => clock, endpoints: { base: 'https://g.test', dailies: '/d', sleeps: '/s' } },
  };
  const caller = { ...fakeCaller(), person: 'a' as const };
  return { db, deps, caller, calls, stateKey, tick: (ms: number) => { clock += ms; } };
}

Deno.test('input: four actions, a step goal is a whole number in range or null', () => {
  assert.equal(Input.safeParse({ action: 'oura-start' }).success, true);
  assert.equal(Input.safeParse({ action: 'garmin-key', key: 'k'.repeat(20) }).success, true);
  assert.equal(Input.safeParse({ action: 'garmin-key', key: 'short' }).success, false);
  assert.equal(Input.safeParse({ action: 'garmin-goal', stepGoal: 8000 }).success, true);
  assert.equal(Input.safeParse({ action: 'garmin-goal', stepGoal: 8000.5 }).success, false);
  assert.equal(Input.safeParse({ action: 'garmin-goal', stepGoal: null }).success, true);
  assert.equal(Input.safeParse({ action: 'disconnect', source: 'manual', deleteData: true }).success, false);
  assert.equal(Input.safeParse({ action: 'nope' }).success, false);
});

Deno.test('only the app origins are return targets', () => {
  assert.equal(appOrigin('http://localhost:4321'), 'http://localhost:4321');
  assert.equal(appOrigin('https://evil.example'), 'https://jonasjlc.github.io');
  assert.equal(appOrigin(null), 'https://jonasjlc.github.io');
});

Deno.test('oura-start seals the caller and a PKCE verifier into state; the verifier is not readable in the URL', async () => {
  const s = await setup();
  const { url } = await run(s.deps, s.caller, { action: 'oura-start' }, 'http://localhost:4321') as { url: string };
  const u = new URL(url);
  assert.equal(u.searchParams.get('redirect_uri'), REDIRECT);
  const state = await unseal<{ h: string; p: string; v: string; o: string; exp: number }>(u.searchParams.get('state')!, s.stateKey);
  assert.equal(state?.h, 'h1');
  assert.equal(state?.p, 'a');
  assert.equal(state?.o, 'http://localhost:4321');
  assert.equal(state?.exp, NOW + STATE_TTL_MS);
  assert.ok(!url.includes(state!.v));
});

Deno.test('oura-start without the Oura secrets fails gracefully with not_configured', async () => {
  const s = await setup({ clientMissing: true });
  assert.equal(await code(run(s.deps, s.caller, { action: 'oura-start' }, null)), '503 not_configured');
});

Deno.test('callback: a valid state stores the tokens for the state person and redirects to the app', async () => {
  const s = await setup();
  const { url } = await run(s.deps, s.caller, { action: 'oura-start' }, null) as { url: string };
  const state = new URL(url).searchParams.get('state')!;
  const res = await callback(s.deps, new URL(`${REDIRECT}?code=abc&state=${state}`));
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('Location'), 'https://jonasjlc.github.io/strandparken/#hjem?forbundet=oura');
  assert.ok(await s.db.getTokens({ householdId: 'h1', person: 'a' }, 'oura'));
  assert.equal(s.db.conns.length, 1);
  const form = new URLSearchParams(String(s.calls[0].init?.body));
  assert.equal(form.get('redirect_uri'), REDIRECT);
  assert.match(form.get('code_verifier')!, /^[A-Za-z0-9_-]{43}$/);
});

Deno.test('callback: forged, expired or cancelled state stores nothing', async () => {
  const s = await setup();
  const forged = await seal({ h: 'h2', p: 'a', v: 'v', o: 'x', exp: NOW + 1000 }, await derivedKey('some-other-long-secret'));
  let res = await callback(s.deps, new URL(`${REDIRECT}?code=abc&state=${forged}`));
  assert.match(res.headers.get('Location')!, /forbind=fejl&kode=state$/);
  const { url } = await run(s.deps, s.caller, { action: 'oura-start' }, null) as { url: string };
  const state = new URL(url).searchParams.get('state')!;
  res = await callback(s.deps, new URL(`${REDIRECT}?error=access_denied&state=${state}`));
  assert.match(res.headers.get('Location')!, /forbind=afbrudt$/);
  s.tick(STATE_TTL_MS + 1);
  res = await callback(s.deps, new URL(`${REDIRECT}?code=abc&state=${state}`));
  assert.match(res.headers.get('Location')!, /kode=expired$/);
  assert.equal(s.db.tokens.size, 0);
});

Deno.test('garmin-key stores the key for the caller; garmin-goal needs a connection', async () => {
  const s = await setup();
  const jonas = { ...s.caller, person: 'b' as const };
  assert.equal(await code(run(s.deps, jonas, { action: 'garmin-goal', stepGoal: 8000 }, null)), '404 not_connected');
  await run(s.deps, jonas, { action: 'garmin-key', key: 'k'.repeat(24), stepGoal: 9000 }, null);
  assert.ok(await s.db.getTokens({ householdId: 'h1', person: 'b' }, 'garmin'));
  await run(s.deps, jonas, { action: 'garmin-goal', stepGoal: 8000 }, null);
  assert.equal(s.db.conns[0].stepGoal, 8000);
});

Deno.test('disconnect revokes at Oura, deletes tokens and connection, and the data only when asked', async () => {
  const s = await setup();
  const who = { householdId: 'h1', person: 'a' as const };
  const { url } = await run(s.deps, s.caller, { action: 'oura-start' }, null) as { url: string };
  await callback(s.deps, new URL(`${REDIRECT}?code=abc&state=${new URL(url).searchParams.get('state')}`));
  await s.db.upsertDays(who, [{ date: '2026-11-20', source: 'oura', sleep_score: 80, activity_progress: null, activity_goal: null, activity_goal_unit: null, steps: null, cycle_day: null, last_synced_at: '' }]);
  await run(s.deps, s.caller, { action: 'disconnect', source: 'oura', deleteData: false }, null);
  assert.ok(s.calls.some((c) => c.url.startsWith('https://api.ouraring.com/oauth/revoke')));
  assert.equal(s.db.tokens.size, 0);
  assert.equal(s.db.conns.length, 0);
  assert.equal(s.db.days.length, 1);
  await run(s.deps, s.caller, { action: 'disconnect', source: 'oura', deleteData: true }, null);
  assert.equal(s.db.days.length, 0);
});
