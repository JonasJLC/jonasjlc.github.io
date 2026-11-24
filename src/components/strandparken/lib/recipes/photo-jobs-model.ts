// The pure parts of the photo jobs (Idé 1): sizing, and which recipes the one-off backfill tries.
import { detectSource } from './import.ts';

/** What a job fetches: a known photo address, or a recipe page whose photo `recipe-image` picks. */
export type PhotoSource = { kind: 'image' | 'page'; url: string };

/** The recipe columns the backfill looks at. */
export type PhotoRecipe = {
  id: string;
  archived_at: string | null;
  source_url: string | null;
  image_source_url: string | null;
  image_path: string | null;
  image_fetch_attempted_at: string | null;
};

/** `w`×`h` scaled so the long side is at most `max`. Never upscales; each side is at least 1. */
export function fitWithin(w: number, h: number, max: number): { w: number; h: number } {
  const scale = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

/**
 * Recipes that have a link or a photo address but no photo, and were never tried (`image_fetch_attempted_at`), so each
 * recipe is tried once. Social links are skipped: a server cannot read them (design R2). A known photo address is
 * fetched directly; otherwise the page is read for its photo.
 */
export function backfillCandidates(recipes: readonly PhotoRecipe[]): { id: string; source: PhotoSource }[] {
  const out: { id: string; source: PhotoSource }[] = [];
  for (const r of recipes) {
    if (r.archived_at || r.image_path || r.image_fetch_attempted_at) continue;
    if (r.image_source_url) {
      out.push({ id: r.id, source: { kind: 'image', url: r.image_source_url } });
      continue;
    }
    const found = r.source_url ? detectSource(r.source_url) : null;
    if (found && found.source === 'web' && found.url.startsWith('https://')) out.push({ id: r.id, source: { kind: 'page', url: found.url } });
  }
  return out;
}
