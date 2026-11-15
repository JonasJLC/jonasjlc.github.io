// Run: deno test --node-modules-dir=none --no-lock --allow-env supabase/functions
import assert from 'node:assert/strict';
import { authenticate, handler } from './guard.ts';
import { HttpError } from './http.ts';
import { z } from './schema.ts';
import { fakeDeps, fakeUsage, request } from './fakes.ts';

const status = async (p: Promise<unknown>) => {
  try { await p; return 200; } catch (e) { return e instanceof HttpError ? e.status : -1; }
};

Deno.test('no token is 401', async () => {
  assert.equal(await status(authenticate(request({ token: null }), fakeDeps())), 401);
});

Deno.test('a token the auth server rejects is 401', async () => {
  const deps = fakeDeps({ verify: () => Promise.resolve(null) });
  assert.equal(await status(authenticate(request(), deps)), 401);
});

Deno.test('a signed-in user who belongs to no household is 403', async () => {
  const deps = fakeDeps({ membership: () => Promise.resolve(null) });
  assert.equal(await status(authenticate(request(), deps)), 403);
});

Deno.test('a member without a known person key is 403', async () => {
  for (const person of [null, 'c', '']) {
    const deps = fakeDeps({ membership: () => Promise.resolve({ householdId: 'h1', person, isOwner: false }) });
    assert.equal(await status(authenticate(request(), deps)), 403, String(person));
  }
});

Deno.test('a member with a person key gets a caller', async () => {
  const c = await authenticate(request(), fakeDeps());
  assert.deepEqual([c.userId, c.householdId, c.person, c.isOwner], ['u1', 'h1', 'b', false]);
});

Deno.test('the Bearer prefix is case-insensitive', async () => {
  const req = new Request('https://example.test/fn', { method: 'POST', headers: { Authorization: 'bearer good' } });
  assert.equal((await authenticate(req, fakeDeps())).userId, 'u1');
});

Deno.test('handler: OPTIONS is answered without auth', async () => {
  const res = await handler({ fn: 't', run: () => Promise.resolve({}) }, fakeDeps())(request({ method: 'OPTIONS', token: null }));
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://jonasjlc.github.io');
});

Deno.test('handler: only POST', async () => {
  const res = await handler({ fn: 't', run: () => Promise.resolve({}) }, fakeDeps())(request({ method: 'GET' }));
  assert.equal(res.status, 405);
});

Deno.test('handler: the body never runs for an unauthenticated or non-member caller', async () => {
  let ran = 0;
  const h = (deps: ReturnType<typeof fakeDeps>) => handler({ fn: 't', run: () => { ran++; return Promise.resolve({}); } }, deps);
  assert.equal((await h(fakeDeps())(request({ token: null }))).status, 401);
  assert.equal((await h(fakeDeps({ membership: () => Promise.resolve(null) }))(request())).status, 403);
  assert.equal(ran, 0);
});

Deno.test('handler: validates input and reports where it is wrong, not what it contained', async () => {
  const schema = z.object({ url: z.string().url(), servings: z.number().int().min(1) });
  const h = handler({ fn: 't', schema, run: ({ input }) => Promise.resolve(input) }, fakeDeps());

  const bad = await h(request({ body: { url: 'secret-looking-text', servings: 0 } }));
  assert.equal(bad.status, 400);
  const text = await bad.text();
  assert.ok(text.includes('"error":"bad_request"') && text.includes('url') && text.includes('servings'));
  assert.ok(!text.includes('secret-looking-text'));

  const notJson = new Request('https://example.test/fn', { method: 'POST', headers: { Authorization: 'Bearer good' }, body: '{nope' });
  assert.equal((await h(notJson)).status, 400);

  const ok = await h(request({ body: { url: 'https://example.com/a', servings: 4 } }));
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { url: 'https://example.com/a', servings: 4 });
});

Deno.test('handler: an HttpError from the body keeps its status and code', async () => {
  const h = handler({ fn: 't', run: () => Promise.reject(new HttpError(429, 'rate_limited')) }, fakeDeps());
  const res = await h(request());
  assert.equal(res.status, 429);
  assert.deepEqual(await res.json(), { error: 'rate_limited' });
});

Deno.test('handler: an unexpected error is a plain 500 that leaks nothing', async () => {
  const h = handler({ fn: 't', run: () => Promise.reject(new Error('db password is hunter2')) }, fakeDeps({ usage: fakeUsage() }));
  const orig = console.error;
  const logged: unknown[][] = [];
  console.error = (...a: unknown[]) => { logged.push(a); };
  try {
    const res = await h(request());
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { error: 'internal' });
  } finally {
    console.error = orig;
  }
  assert.ok(!JSON.stringify(logged).includes('hunter2'));
});
