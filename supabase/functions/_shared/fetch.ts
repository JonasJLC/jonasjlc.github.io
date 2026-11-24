// Hardened outbound fetch shared by the edge functions (design §4.5): recipe pages (`recipe-import`), recipe photos
// (`recipe-image`) and, later, calendar feeds. HTTPS only, public addresses only (checked again after every redirect), at
// most three redirects, 8 seconds in total, no cookies or credentials. `fetchPublic` takes the allowed content types and
// the size limit as options; `fetchPage` reads HTML with a 2 MB limit.
// Known limit: the address is checked by resolving the name first and fetch() resolves it again, so a name that changes
// its answer between the two lookups is not caught. The function holds no secrets the page could reach by that route.
import { HttpError } from './http.ts';

export const MAX_BYTES = 2_000_000;
export const MAX_REDIRECTS = 3;
export const TIMEOUT_MS = 8_000;

export interface FetchDeps {
  fetch?: typeof fetch;
  /** The A and AAAA answers for a host name. */
  resolve?: (host: string) => Promise<string[]>;
}

/** 4 numbers for a dotted IPv4 address, or null. */
function parseV4(ip: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  return parts.every((n) => n <= 255) ? parts : null;
}

/** 8 groups for an IPv6 address (also with an embedded dotted tail), or null. */
function parseV6(ip: string): number[] | null {
  let text = ip.replace(/^\[|\]$/g, '').split('%')[0].toLowerCase();
  const tail = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (tail) {
    const v4 = parseV4(tail[1]);
    if (!v4) return null;
    text = text.slice(0, -tail[1].length) + ((v4[0] << 8) | v4[1]).toString(16) + ':' + ((v4[2] << 8) | v4[3]).toString(16);
  }
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...rest];
  const nums = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  return nums.length === 8 && nums.every((n) => !Number.isNaN(n)) ? nums : null;
}

function privateV4([a, b, c]: number[]): boolean {
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

/** True for anything that is not an ordinary public internet address. Unparseable input counts as private. */
export function isPrivateAddress(ip: string): boolean {
  const v4 = parseV4(ip);
  if (v4) return privateV4(v4);
  const g = parseV6(ip);
  if (!g) return true;
  const embedded = (hi: number, lo: number) => [hi >> 8, hi & 255, lo >> 8, lo & 255];
  if (g.slice(0, 6).every((n) => n === 0)) return true; // ::, ::1 and the deprecated IPv4-compatible range
  if (g.slice(0, 5).every((n) => n === 0) && g[5] === 0xffff) return privateV4(embedded(g[6], g[7])); // ::ffff:a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((n) => n === 0)) return privateV4(embedded(g[6], g[7])); // NAT64
  if (g[0] === 0x2002) return privateV4(embedded(g[1], g[2])); // 6to4
  return (g[0] & 0xfe00) === 0xfc00 || (g[0] & 0xffc0) === 0xfe80 || (g[0] & 0xff00) === 0xff00 || (g[0] === 0x2001 && g[1] === 0xdb8);
}

/** The URL if it may be fetched at all: https, no credentials, default port, a real host name or a public literal. */
export function checkUrl(raw: string): URL {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { throw new HttpError(422, 'bad_url'); }
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) throw new HttpError(422, 'bad_url');
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  const literal = host.startsWith('[') || parseV4(host) !== null;
  if (literal) {
    if (isPrivateAddress(host)) throw new HttpError(422, 'blocked');
  } else if (!host.includes('.') || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new HttpError(422, 'blocked');
  }
  return u;
}

async function defaultResolve(host: string): Promise<string[]> {
  const answers = await Promise.allSettled([Deno.resolveDns(host, 'A'), Deno.resolveDns(host, 'AAAA')]);
  return answers.flatMap((a) => (a.status === 'fulfilled' ? a.value : []));
}

async function assertPublic(u: URL, resolve: NonNullable<FetchDeps['resolve']>) {
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (host.startsWith('[') || parseV4(host) !== null) return; // a literal was already checked by checkUrl
  const addresses = await resolve(host);
  if (addresses.length === 0) throw new HttpError(502, 'fetch_failed');
  if (addresses.some(isPrivateAddress)) throw new HttpError(422, 'blocked');
}

async function readLimited(res: Response, maxBytes: number): Promise<Uint8Array> {
  const length = Number(res.headers.get('content-length'));
  if (length > maxBytes) throw new HttpError(422, 'too_large');
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new HttpError(422, 'too_large');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

export interface PublicFetchOptions {
  /** The Accept header to send. */
  accept: string;
  /** The content types that may be read. */
  allowType: RegExp;
  maxBytes: number;
}

/**
 * The body of a public https address, under the rules in the header comment. Throws `bad_url`, `blocked`, `too_large`,
 * `not_allowed_type` or `fetch_failed`.
 */
export async function fetchPublic(rawUrl: string, options: PublicFetchOptions, deps: FetchDeps = {}): Promise<{ bytes: Uint8Array; url: string; contentType: string }> {
  const doFetch = deps.fetch ?? fetch;
  const resolve = deps.resolve ?? defaultResolve;
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let url = checkUrl(rawUrl);

  for (let hops = 0; hops <= MAX_REDIRECTS; hops++) {
    await assertPublic(url, resolve);
    let res: Response;
    try {
      res = await doFetch(url, {
        method: 'GET',
        redirect: 'manual',
        credentials: 'omit',
        signal,
        headers: { Accept: options.accept, 'Accept-Language': 'da,en;q=0.8', 'User-Agent': 'Mozilla/5.0 (compatible; RecipeReader/1.0)' },
      });
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(502, 'fetch_failed');
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      await res.body?.cancel().catch(() => {});
      if (!location || hops === MAX_REDIRECTS) throw new HttpError(502, 'fetch_failed');
      url = checkUrl(new URL(location, url).toString());
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      throw new HttpError(502, 'fetch_failed');
    }
    const contentType = res.headers.get('content-type') ?? '';
    if (!options.allowType.test(contentType)) {
      await res.body?.cancel().catch(() => {});
      throw new HttpError(422, 'not_allowed_type');
    }
    let bytes: Uint8Array;
    try {
      bytes = await readLimited(res, options.maxBytes);
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(502, 'fetch_failed');
    }
    return { bytes, url: url.toString(), contentType };
  }
  throw new HttpError(502, 'fetch_failed');
}

/** The HTML of a public web page. Throws `bad_url`, `blocked`, `too_large`, `not_html` or `fetch_failed`. */
export async function fetchPage(rawUrl: string, deps: FetchDeps = {}): Promise<{ html: string; url: string }> {
  let page: Awaited<ReturnType<typeof fetchPublic>>;
  try {
    page = await fetchPublic(rawUrl, { accept: 'text/html,application/xhtml+xml', allowType: /html|xml/i, maxBytes: MAX_BYTES }, deps);
  } catch (e) {
    if (e instanceof HttpError && e.code === 'not_allowed_type') throw new HttpError(422, 'not_html');
    throw e;
  }
  const charset = /charset=["']?([\w-]+)/i.exec(page.contentType)?.[1] ?? 'utf-8';
  let html: string;
  try { html = new TextDecoder(charset).decode(page.bytes); } catch { html = new TextDecoder().decode(page.bytes); }
  return { html, url: page.url };
}
