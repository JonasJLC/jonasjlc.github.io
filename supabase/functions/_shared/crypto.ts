// Encryption for secrets the database must hold but never show: the private iCal addresses of Idé 7. AES-GCM with a
// 12-byte random IV per value; the stored text is base64(iv || ciphertext || tag). The 32-byte key is the base64 secret
// SP_FEED_KEY, set once and never committed:
//   supabase secrets set SP_FEED_KEY=$(openssl rand -base64 32)
// Changing the key makes every stored address unreadable, so each calendar must then be added again.
import { HttpError } from './http.ts';

const IV_BYTES = 12;

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}

/** The AES key from a base64 secret. Throws 503 `not_configured` when it is missing or not 32 bytes. */
export async function importKey(secret: string | undefined): Promise<CryptoKey> {
  let raw: Uint8Array<ArrayBuffer>;
  try {
    raw = fromBase64((secret ?? '').trim());
  } catch {
    throw new HttpError(503, 'not_configured');
  }
  if (raw.length !== 32) throw new HttpError(503, 'not_configured');
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** The key from SP_FEED_KEY. */
export const feedKey = () => importKey(Deno.env.get('SP_FEED_KEY'));

export async function seal(text: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text)));
  const out = new Uint8Array(IV_BYTES + cipher.length);
  out.set(iv);
  out.set(cipher, IV_BYTES);
  return toBase64(out);
}

/** The plain text. Throws when the value was changed or sealed with another key. */
export async function open(sealed: string, key: CryptoKey): Promise<string> {
  const bytes = fromBase64(sealed);
  if (bytes.length <= IV_BYTES) throw new Error('sealed value too short');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, IV_BYTES) }, key, bytes.subarray(IV_BYTES));
  return new TextDecoder().decode(plain);
}
