// Run: deno test --node-modules-dir=none --no-lock --allow-env supabase/functions
import assert from 'node:assert/strict';
import { HttpError } from '../_shared/http.ts';
import { checkUrl, fetchPage, fetchPublic, isPrivateAddress, MAX_BYTES } from './fetch.ts';

const code = async (p: Promise<unknown>) => {
  try { await p; return 'ok'; } catch (e) { return e instanceof HttpError ? `${e.status} ${e.code}` : 'other'; }
};
const pub = () => Promise.resolve(['93.184.216.34']);
const html = (body: string, init: ResponseInit = {}) => new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, ...init });

Deno.test('private, loopback, link-local and reserved addresses are refused, public ones are not', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255',
    '::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a00:1', '64:ff9b::7f00:1', '2002:7f00:1::', '2001:db8::1', 'nonsense']) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ['93.184.216.34', '8.8.8.8', '172.32.0.1', '172.15.0.1', '2606:2800:220:1:248:1893:25c8:1946', '::ffff:5db8:d822']) {
    assert.equal(isPrivateAddress(ip), false, ip);
  }
});

Deno.test('only plain https URLs on a real host name pass', () => {
  assert.equal(checkUrl('https://www.dr.dk/mad/opskrift/x').hostname, 'www.dr.dk');
  for (const [url, expected] of [
    ['http://example.com/', '422 bad_url'], ['ftp://example.com/', '422 bad_url'], ['https://user:pw@example.com/', '422 bad_url'],
    ['https://example.com:8443/', '422 bad_url'], ['ikke et link', '422 bad_url'],
    ['https://localhost/', '422 blocked'], ['https://printer/', '422 blocked'], ['https://box.local/', '422 blocked'], ['https://db.internal/', '422 blocked'],
    ['https://127.0.0.1/', '422 blocked'], ['https://[::1]/', '422 blocked'], ['https://169.254.169.254/latest/meta-data', '422 blocked'], ['https://[::ffff:10.0.0.1]/', '422 blocked'],
  ] as const) {
    let got = 'ok';
    try { checkUrl(url); } catch (e) { got = e instanceof HttpError ? `${e.status} ${e.code}` : 'other'; }
    assert.equal(got, expected, url);
  }
});

Deno.test('a name that resolves to a private address is blocked before anything is fetched', async () => {
  let fetched = 0;
  const deps = { resolve: () => Promise.resolve(['93.184.216.34', '10.0.0.5']), fetch: () => { fetched++; return Promise.resolve(html('x')); } };
  assert.equal(await code(fetchPage('https://example.com/', deps)), '422 blocked');
  assert.equal(fetched, 0);
});

Deno.test('a page is read, with the charset the server names', async () => {
  const latin1 = new Uint8Array([0x62, 0xe6, 0x72]); // "bær"
  const res = new Response(latin1, { headers: { 'content-type': 'text/html; charset=iso-8859-1' } });
  const out = await fetchPage('https://example.com/a', { resolve: pub, fetch: () => Promise.resolve(res) });
  assert.equal(out.html, 'bær');
  assert.equal(out.url, 'https://example.com/a');
});

Deno.test('redirects are followed up to three, and each target is checked again', async () => {
  const hop = (to: string) => new Response(null, { status: 302, headers: { location: to } });
  const chain = (targets: string[]) => {
    let n = 0;
    return { resolve: pub, fetch: () => Promise.resolve(n < targets.length ? hop(targets[n++]) : html('ok')) };
  };
  assert.equal((await fetchPage('https://example.com/1', chain(['/2', '/3', 'https://other.example/4']))).url, 'https://other.example/4');
  assert.equal(await code(fetchPage('https://example.com/1', chain(['/2', '/3', '/4', '/5']))), '502 fetch_failed');
  assert.equal(await code(fetchPage('https://example.com/1', chain(['http://example.com/plain']))), '422 bad_url');
  assert.equal(await code(fetchPage('https://example.com/1', chain(['https://169.254.169.254/']))), '422 blocked');

  // A redirect to a name that resolves privately is caught by the second lookup.
  let lookups = 0;
  const deps = { resolve: () => Promise.resolve(++lookups === 1 ? ['93.184.216.34'] : ['192.168.0.9']), fetch: () => Promise.resolve(hop('https://evil.example/')) };
  assert.equal(await code(fetchPage('https://example.com/', deps)), '422 blocked');
});

Deno.test('no credentials are sent and redirects are never followed by fetch itself', async () => {
  let seen: RequestInit | undefined;
  await fetchPage('https://example.com/', { resolve: pub, fetch: (_u, init) => { seen = init; return Promise.resolve(html('x')); } });
  assert.equal(seen?.credentials, 'omit');
  assert.equal(seen?.redirect, 'manual');
  assert.equal('cookie' in ((seen?.headers as Record<string, string>) ?? {}), false);
});

Deno.test('other content types, errors, oversized bodies and network failures are refused', async () => {
  const run = (res: () => Response) => code(fetchPage('https://example.com/', { resolve: pub, fetch: () => Promise.resolve(res()) }));
  assert.equal(await run(() => new Response('{}', { headers: { 'content-type': 'application/json' } })), '422 not_html');
  assert.equal(await run(() => new Response('nope', { status: 404, headers: { 'content-type': 'text/html' } })), '502 fetch_failed');
  assert.equal(await run(() => html('x', { headers: { 'content-type': 'text/html', 'content-length': String(MAX_BYTES + 1) } })), '422 too_large');
  assert.equal(await run(() => html('x'.repeat(MAX_BYTES + 1))), '422 too_large');
  assert.equal(await code(fetchPage('https://example.com/', { resolve: pub, fetch: () => Promise.reject(new Error('down')) })), '502 fetch_failed');
  assert.equal(await code(fetchPage('https://example.com/', { resolve: () => Promise.resolve([]), fetch: () => Promise.resolve(html('x')) })), '502 fetch_failed');
});

// fetchPublic: the same hardened rules for any content type, with the type and size limit chosen by the caller.
const IMAGE = { accept: 'image/*', allowType: /^image\/(jpeg|png|webp)/i, maxBytes: 100 };
const png = (bytes: Uint8Array<ArrayBuffer>, init: ResponseInit = {}) => new Response(bytes, { status: 200, headers: { 'content-type': 'image/png' }, ...init });

Deno.test('fetchPublic returns the bytes, the final address and the content type', async () => {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  let seen: RequestInit | undefined;
  const out = await fetchPublic('https://example.com/a.png', IMAGE, { resolve: pub, fetch: (_u, init) => { seen = init; return Promise.resolve(png(bytes)); } });
  assert.deepEqual([...out.bytes], [1, 2, 3, 4]);
  assert.equal(out.url, 'https://example.com/a.png');
  assert.equal(out.contentType, 'image/png');
  assert.equal((seen?.headers as Record<string, string>).Accept, 'image/*');
  assert.equal(seen?.credentials, 'omit');
  assert.equal(seen?.redirect, 'manual');
});

Deno.test('fetchPublic refuses private addresses after a redirect, and every hop is resolved again', async () => {
  const hop = (to: string) => new Response(null, { status: 302, headers: { location: to } });
  assert.equal(await code(fetchPublic('https://example.com/a', IMAGE, { resolve: pub, fetch: () => Promise.resolve(hop('https://169.254.169.254/x.png')) })), '422 blocked');
  let lookups = 0;
  const deps = { resolve: () => Promise.resolve(++lookups === 1 ? ['93.184.216.34'] : ['10.0.0.9']), fetch: () => Promise.resolve(hop('https://cdn.example/x.png')) };
  assert.equal(await code(fetchPublic('https://example.com/a', IMAGE, deps)), '422 blocked');
});

Deno.test('fetchPublic enforces maxBytes from content-length and from the streamed body', async () => {
  const run = (res: () => Response) => code(fetchPublic('https://example.com/a.png', IMAGE, { resolve: pub, fetch: () => Promise.resolve(res()) }));
  assert.equal(await run(() => png(new Uint8Array(101))), '422 too_large');
  assert.equal(await run(() => png(new Uint8Array(1), { headers: { 'content-type': 'image/png', 'content-length': '101' } })), '422 too_large');
  assert.equal(await run(() => png(new Uint8Array(100))), 'ok');
});

Deno.test('fetchPublic refuses a content type that is not allowed', async () => {
  const run = (type: string | null) =>
    code(fetchPublic('https://example.com/a', IMAGE, { resolve: pub, fetch: () => Promise.resolve(new Response('x', { headers: type ? { 'content-type': type } : {} })) }));
  assert.equal(await run('image/svg+xml'), '422 not_allowed_type');
  assert.equal(await run('text/html'), '422 not_allowed_type');
  assert.equal(await run(null), '422 not_allowed_type');
  assert.equal(await run('image/webp'), 'ok');
});
