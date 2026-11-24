// Run: deno test --node-modules-dir=none --no-lock --allow-env supabase/functions
import assert from 'node:assert/strict';
import { HttpError } from './http.ts';
import { feedKey, importKey, open, seal } from './crypto.ts';

const secret = btoa(String.fromCharCode(...new Uint8Array(32).map((_, i) => i * 7)));
const code = async (p: Promise<unknown>) => {
  try { await p; return 'ok'; } catch (e) { return e instanceof HttpError ? `${e.status} ${e.code}` : 'other'; }
};

Deno.test('open(seal(x)) is x, and two seals of the same text differ (random IV)', async () => {
  const key = await importKey(secret);
  const url = 'https://calendar.google.com/calendar/ical/x%40group.calendar.google.com/private-abc/basic.ics';
  const a = await seal(url, key);
  const b = await seal(url, key);
  assert.notEqual(a, b);
  assert.equal(await open(a, key), url);
  assert.equal(await open(b, key), url);
  assert.ok(!a.includes('calendar.google.com'));
});

Deno.test('a changed ciphertext or another key is refused', async () => {
  const key = await importKey(secret);
  const sealed = await seal('hemmelig', key);
  const bytes = atob(sealed).split('');
  bytes[bytes.length - 1] = String.fromCharCode(bytes[bytes.length - 1].charCodeAt(0) ^ 1);
  assert.equal(await code(open(btoa(bytes.join('')), key)), 'other');
  const other = await importKey(btoa(String.fromCharCode(...new Uint8Array(32).fill(9))));
  assert.equal(await code(open(sealed, other)), 'other');
  assert.equal(await code(open('', key)), 'other');
});

Deno.test('a missing or malformed SP_FEED_KEY gives 503 not_configured', async () => {
  assert.equal(await code(importKey(undefined)), '503 not_configured');
  assert.equal(await code(importKey('')), '503 not_configured');
  assert.equal(await code(importKey(btoa('too short'))), '503 not_configured');
  assert.equal(await code(importKey('***not base64***')), '503 not_configured');
  const before = Deno.env.get('SP_FEED_KEY');
  Deno.env.delete('SP_FEED_KEY');
  try {
    assert.equal(await code(feedKey()), '503 not_configured');
    Deno.env.set('SP_FEED_KEY', secret);
    assert.equal(await code(feedKey()), 'ok');
  } finally {
    if (before === undefined) Deno.env.delete('SP_FEED_KEY'); else Deno.env.set('SP_FEED_KEY', before);
  }
});
