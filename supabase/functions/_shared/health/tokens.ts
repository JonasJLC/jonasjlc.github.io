// Secrets at rest and in transit for the health functions (ADR-06). Web Crypto only.
// - Provider tokens and the Garmin key are AES-GCM encrypted with SP_TOKEN_KEY (32 random bytes, base64) before they reach
//   the database. Ciphertext format: base64(iv) "." base64(ciphertext+tag).
// - The OAuth `state` is sealed (AES-GCM, which also authenticates it) with a key derived from SP_OAUTH_STATE_KEY, so the
//   PKCE verifier it carries is not readable in the redirect URL.
// Never log tokens, keys or decrypted values.
import { HttpError } from '../http.ts';

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function unb64(text: string): Uint8Array<ArrayBuffer> {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export const b64url = (bytes: Uint8Array) => b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (text: string) => unb64(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4));

export const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

/** The AES key from a base64 secret of exactly 32 bytes. A missing or malformed secret is `503 not_configured`. */
export async function tokenKey(secret: string | undefined): Promise<CryptoKey> {
  let raw: Uint8Array<ArrayBuffer>;
  try {
    raw = unb64(secret ?? '');
  } catch {
    throw new HttpError(503, 'not_configured');
  }
  if (raw.length !== 32) throw new HttpError(503, 'not_configured');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** An AES key derived from any non-empty secret string (SHA-256). Used for the OAuth state. */
export async function derivedKey(secret: string | undefined): Promise<CryptoKey> {
  if (!secret || secret.length < 16) throw new HttpError(503, 'not_configured');
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encrypt(plain: string, key: CryptoKey): Promise<string> {
  const iv = randomBytes(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain)));
  return `${b64(iv)}.${b64(ct)}`;
}

/** Throws `500 token_unreadable` for a wrong key or tampered value (no detail: it could hint at the key). */
export async function decrypt(sealed: string, key: CryptoKey): Promise<string> {
  try {
    const [iv, ct] = sealed.split('.');
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(ct));
    return dec.decode(plain);
  } catch {
    throw new HttpError(500, 'token_unreadable');
  }
}

/** Seals a JSON value into a URL-safe string. */
export async function seal(value: unknown, key: CryptoKey): Promise<string> {
  const iv = randomBytes(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value))));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return b64url(out);
}

/** The sealed value, or null when it was not sealed with this key or was changed. */
export async function unseal<T>(text: string, key: CryptoKey): Promise<T | null> {
  try {
    const bytes = unb64url(text);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, 12) }, key, bytes.subarray(12));
    return JSON.parse(dec.decode(plain)) as T;
  } catch {
    return null;
  }
}

/** PKCE (RFC 7636, S256): a 43-character verifier and its challenge. */
export async function pkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(verifier))));
  return { verifier, challenge };
}

/** Constant-time string comparison (for the cron secret). */
export async function sameSecret(a: string, b: string): Promise<boolean> {
  if (!a || !b) return false;
  const [ha, hb] = await Promise.all([a, b].map(async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))));
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}
