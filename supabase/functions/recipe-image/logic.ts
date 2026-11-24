// The dish photo for an imported recipe (Idé 1). Fetches the photo through the same hardened rules as page fetches and hands
// the bytes to the browser as base64, which shrinks them to 1200 px and uploads them. Decoding large images here would risk
// the function's CPU limit, and the browser cannot fetch most recipe sites' images itself (CORS, tainted canvas).
// No model call and no secrets: only household members can call it (guard), and each call is capped by size and time.
import type { Caller } from '../_shared/guard.ts';
import { HttpError } from '../_shared/http.ts';
import { z } from '../_shared/schema.ts';
import { fetchPage, fetchPublic, type FetchDeps } from '../_shared/fetch.ts';
import { pickImage } from '../recipe-import/page.ts';

export const MAX_IMAGE_BYTES = 5_000_000;
const IMAGE_TYPE = /^image\/(jpe?g|png|webp)\b/i;

const address = z.string().trim().max(2000).regex(/^https:\/\//i);
export const Input = z.discriminatedUnion('kind', [
  /** An image address the import found. */
  z.object({ kind: z.literal('image'), url: address }),
  /** A recipe page, for the backfill: the photo is picked here, so no model call is spent. */
  z.object({ kind: z.literal('page'), url: address }),
]);
export type ImageInput = z.infer<typeof Input>;

function base64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}

/** The photo as `{ mediaType, data }`. Throws `not_an_image`, `too_large`, `no_image` and the fetch errors (`bad_url`, `blocked`, `fetch_failed`). */
export async function fetchRecipeImage(_caller: Caller, input: ImageInput, deps: { web?: FetchDeps } = {}): Promise<{ mediaType: string; data: string }> {
  let url = input.url;
  if (input.kind === 'page') {
    const page = await fetchPage(input.url, deps.web);
    const found = pickImage(page.html, page.url);
    if (!found) throw new HttpError(422, 'no_image');
    url = found;
  }
  let image: Awaited<ReturnType<typeof fetchPublic>>;
  try {
    image = await fetchPublic(url, { accept: 'image/jpeg,image/png,image/webp,image/*;q=0.5', allowType: IMAGE_TYPE, maxBytes: MAX_IMAGE_BYTES }, deps.web);
  } catch (e) {
    if (e instanceof HttpError && e.code === 'not_allowed_type') throw new HttpError(422, 'not_an_image');
    throw e;
  }
  const kind = /^image\/(jpe?g|png|webp)/i.exec(image.contentType)![1].toLowerCase();
  return { mediaType: kind === 'png' ? 'image/png' : kind === 'webp' ? 'image/webp' : 'image/jpeg', data: base64(image.bytes) };
}
