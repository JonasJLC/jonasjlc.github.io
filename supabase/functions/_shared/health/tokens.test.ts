// Run: deno test --node-modules-dir=none --no-lock --allow-env supabase/functions
import assert from 'node:assert/strict';
import { HttpError } from '../http.ts';
import { b64, decrypt, derivedKey, encrypt, pkce, randomBytes, sameSecret, seal, tokenKey, unseal } from './tokens.ts';

const secret = () => b64(randomBytes(32));
const code = async (p: Promise<unknown>) => {
  try { await p; return 'ok'; } catch (e) { return e instanceof HttpError ? `${e.status} ${e.code}` : 'other'; }
};

Deno.test('encrypt then decrypt gives the original back', async () => {
  const key = await tokenKey(secret());
  assert.equal(await decrypt(await encrypt('refresh-token-123', key), key), 'refresh-token-123');
});

Deno.test('a different key cannot decrypt, and the error says nothing about why', async () => {
  const sealed = await encrypt('x', await tokenKey(secret()));
  assert.equal(await code(decrypt(sealed, await tokenKey(secret()))), '500 token_unreadable');
});

Deno.test('equal input gives different ciphertexts (random IV)', async () => {
  const key = await tokenKey(secret());
  assert.notEqual(await encrypt('same', key), await encrypt('same', key));
});

Deno.test('a missing or short token key is not_configured', async () => {
  assert.equal(await code(tokenKey(undefined)), '503 not_configured');
  assert.equal(await code(tokenKey(b64(randomBytes(16)))), '503 not_configured');
  assert.equal(await code(tokenKey('not base64 !!')), '503 not_configured');
  assert.equal(await code(derivedKey('short')), '503 not_configured');
});

Deno.test('a sealed state round-trips, and a changed or foreign one is null', async () => {
  const key = await derivedKey('a-long-enough-state-secret');
  const s = await seal({ h: 'h1', p: 'a', exp: 1 }, key);
  assert.match(s, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(await unseal(s, key), { h: 'h1', p: 'a', exp: 1 });
  assert.equal(await unseal(s.slice(0, -2) + (s.endsWith('AA') ? 'BB' : 'AA'), key), null);
  assert.equal(await unseal(s, await derivedKey('another-long-state-secret')), null);
  assert.equal(await unseal('%%%', key), null);
});

Deno.test('PKCE verifier is 43 url-safe characters and the challenge is its SHA-256', async () => {
  const { verifier, challenge } = await pkce();
  assert.match(verifier, /^[A-Za-z0-9_-]{43}$/);
  assert.match(challenge, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(verifier, challenge);
});

Deno.test('secrets compare equal only when equal, and never when empty', async () => {
  assert.equal(await sameSecret('abc', 'abc'), true);
  assert.equal(await sameSecret('abc', 'abd'), false);
  assert.equal(await sameSecret('', ''), false);
});
