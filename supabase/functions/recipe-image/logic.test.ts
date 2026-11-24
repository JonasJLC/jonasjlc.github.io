// Run: deno test --node-modules-dir=none --no-lock --allow-env supabase/functions
import assert from 'node:assert/strict';
import { HttpError } from '../_shared/http.ts';
import { fakeCaller } from '../_shared/fakes.ts';
import { fetchRecipeImage, Input, MAX_IMAGE_BYTES } from './logic.ts';

const pub = () => Promise.resolve(['93.184.216.34']);
const fail = async (p: Promise<unknown>) => {
  try { await p; return 'ok'; } catch (e) { return e instanceof HttpError ? `${e.status} ${e.code}` : 'other'; }
};
const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 250, 251, 252]);
const b64 = btoa(String.fromCharCode(...bytes));
const image = (type: string | null, body: BodyInit = bytes as Uint8Array<ArrayBuffer>, init: ResponseInit = {}) =>
  new Response(body, { headers: type ? { 'content-type': type } : {}, ...init });
const run = (input: unknown, fetch: (url: URL) => Response) =>
  fetchRecipeImage(fakeCaller(), Input.parse(input), { web: { resolve: pub, fetch: (u) => Promise.resolve(fetch(new URL(u.toString()))) } });

Deno.test('the input is a page or an image address, https only, at most 2000 characters', () => {
  assert.equal(Input.safeParse({ kind: 'image', url: 'https://cdn.example.dk/a.jpg' }).success, true);
  assert.equal(Input.safeParse({ kind: 'page', url: 'https://example.dk/opskrift' }).success, true);
  assert.equal(Input.safeParse({ kind: 'image', url: 'http://cdn.example.dk/a.jpg' }).success, false);
  assert.equal(Input.safeParse({ kind: 'image', url: 'https://x.dk/' + 'a'.repeat(2000) }).success, false);
  assert.equal(Input.safeParse({ kind: 'other', url: 'https://x.dk/' }).success, false);
  assert.equal(Input.safeParse({ kind: 'image' }).success, false);
});

Deno.test('an image address returns the media type and the bytes as base64, for jpeg, png and webp', async () => {
  for (const [type, expected] of [['image/jpeg', 'image/jpeg'], ['image/jpg', 'image/jpeg'], ['image/png', 'image/png'], ['image/webp', 'image/webp'], ['image/jpeg; charset=binary', 'image/jpeg']]) {
    const out = await run({ kind: 'image', url: 'https://cdn.example.dk/a' }, () => image(type));
    assert.deepEqual(out, { mediaType: expected, data: b64 }, type);
  }
});

Deno.test('SVG, HTML and a missing content type are not images', async () => {
  for (const type of ['image/svg+xml', 'text/html', 'image/gif', null]) {
    assert.equal(await fail(run({ kind: 'image', url: 'https://cdn.example.dk/a' }, () => image(type))), '422 not_an_image', String(type));
  }
});

Deno.test('more than 5 MB is refused, from content-length and from the body', async () => {
  const lying = () => image('image/jpeg', 'x', { headers: { 'content-type': 'image/jpeg', 'content-length': String(MAX_IMAGE_BYTES + 1) } });
  assert.equal(await fail(run({ kind: 'image', url: 'https://cdn.example.dk/a' }, lying)), '422 too_large');
  const big = () => image('image/jpeg', new Uint8Array(MAX_IMAGE_BYTES + 1));
  assert.equal(await fail(run({ kind: 'image', url: 'https://cdn.example.dk/a' }, big)), '422 too_large');
  const ok = () => image('image/jpeg', new Uint8Array(MAX_IMAGE_BYTES));
  assert.equal(await fail(run({ kind: 'image', url: 'https://cdn.example.dk/a' }, ok)), 'ok');
});

Deno.test('a page address fetches the page, picks the photo, then fetches the photo', async () => {
  const seen: string[] = [];
  const page = '<html><head><meta property="og:image" content="/img/dish.jpg"></head></html>';
  const out = await run({ kind: 'page', url: 'https://example.dk/opskrift' }, (u) => {
    seen.push(u.toString());
    return u.pathname === '/opskrift' ? new Response(page, { headers: { 'content-type': 'text/html' } }) : image('image/jpeg');
  });
  assert.deepEqual(seen, ['https://example.dk/opskrift', 'https://example.dk/img/dish.jpg']);
  assert.equal(out.mediaType, 'image/jpeg');
  assert.equal(out.data, b64);
});

Deno.test('a page without a photo fails with no_image; a photo that cannot be fetched keeps its own error', async () => {
  const html = (body: string) => new Response(body, { headers: { 'content-type': 'text/html' } });
  assert.equal(await fail(run({ kind: 'page', url: 'https://example.dk/x' }, () => html('<html><body>ingen</body></html>'))), '422 no_image');
  const missing = (u: URL) => (u.pathname === '/x' ? html('<meta property="og:image" content="https://cdn.example.dk/gone.jpg">') : new Response('nope', { status: 404 }));
  assert.equal(await fail(run({ kind: 'page', url: 'https://example.dk/x' }, missing)), '502 fetch_failed');
  const notImage = (u: URL) => (u.pathname === '/x' ? html('<meta property="og:image" content="https://cdn.example.dk/a.jpg">') : html('<p>hej</p>'));
  assert.equal(await fail(run({ kind: 'page', url: 'https://example.dk/x' }, notImage)), '422 not_an_image');
});

Deno.test('private addresses are refused before anything is fetched', async () => {
  let fetched = 0;
  const deps = { web: { resolve: pub, fetch: () => { fetched++; return Promise.resolve(image('image/jpeg')); } } };
  for (const url of ['https://169.254.169.254/latest', 'https://localhost/a.jpg', 'http://example.dk/a.jpg']) {
    assert.match(await fail(fetchRecipeImage(fakeCaller(), { kind: 'image', url }, deps)), /^422 (blocked|bad_url)$/, url);
  }
  assert.equal(fetched, 0);
});
