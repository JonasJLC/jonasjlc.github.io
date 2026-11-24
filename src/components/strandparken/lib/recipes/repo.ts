import { getClient } from '../auth';
import { fitWithin } from './photo-jobs-model';
import { cleanTags, parseAmount, parseSteps, type CategoryRow, type IngredientRow, type Recipe, type RecipeDraft, type RecipeRow } from './model';

const BUCKET = 'sp-recipes';
type WithIngredients = RecipeRow & { sp_recipe_ingredients?: IngredientRow[] | null };

function toRecipe({ sp_recipe_ingredients, ...row }: WithIngredients): Recipe {
  return { ...row, steps: parseSteps(row.steps), ingredients: [...(sp_recipe_ingredients ?? [])].sort((a, b) => a.position - b.position) };
}

/** Every recipe of the household with its ingredients, archived ones included (the list hides them). */
export async function loadRecipes(): Promise<Recipe[]> {
  const c = await getClient();
  const { data, error } = await c.from('sp_recipes').select('*, sp_recipe_ingredients(*)').order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as WithIngredients[]).map(toRecipe);
}

export async function loadCategories(): Promise<CategoryRow[]> {
  const c = await getClient();
  const { data, error } = await c.from('sp_recipe_categories').select('*').order('position').order('name');
  if (error) throw error;
  return data;
}

/** Private bucket: photos are shown through short-lived signed links. Missing files are simply left out. */
export async function signedPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return {};
  const c = await getClient();
  const { data, error } = await c.storage.from(BUCKET).createSignedUrls(unique, 60 * 60);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  for (const d of data) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

/** The long side of a photo from the camera or library, and of an imported photo (main spec §4.6, roadmap Q10). */
export const PHOTO_EDGE = 1600;
export const IMPORTED_PHOTO_EDGE = 1200;
const THUMB_EDGE = 400;

/**
 * A picture scaled to at most `maxEdge` px on its long side and stored as JPEG, so a phone camera picture is ~300 KB, not 6 MB.
 * JPEG stays the format: Safari's `canvas.toBlob('image/webp')` does not encode WebP everywhere.
 */
export async function shrinkImage(file: Blob, maxEdge = PHOTO_EDGE, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { w, h } = fitWithin(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality));
  if (!blob) throw new Error('Billedet kunne ikke behandles.');
  return blob;
}

/** For ideas, whose photos have no thumbnail: one file under `<household>/<folder>/`. */
export async function uploadPhoto(householdId: string, recipeId: string, file: File): Promise<string> {
  const c = await getClient();
  const path = `${householdId}/${recipeId}/${crypto.randomUUID()}.jpg`;
  const { error } = await c.storage.from(BUCKET).upload(path, await shrinkImage(file), { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

export type PhotoPaths = { imagePath: string; thumbPath: string };

/** A recipe photo: `<uuid>.jpg` at `maxEdge` px and `<uuid>-thumb.jpg` at 400 px, for the small pictures in grids and rows. */
export async function uploadPhotoPair(householdId: string, recipeId: string, source: Blob, maxEdge = PHOTO_EDGE): Promise<PhotoPaths> {
  const c = await getClient();
  const base = `${householdId}/${recipeId}/${crypto.randomUUID()}`;
  const full = await shrinkImage(source, maxEdge);
  const thumb = await shrinkImage(full, THUMB_EDGE, 0.8);
  const imagePath = `${base}.jpg`;
  const thumbPath = `${base}-thumb.jpg`;
  const up = (path: string, blob: Blob) => c.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  const first = await up(imagePath, full);
  if (first.error) throw first.error;
  const second = await up(thumbPath, thumb);
  if (second.error) {
    await removePhoto(imagePath);
    throw second.error;
  }
  return { imagePath, thumbPath };
}

/** Deletes the file or files behind a photo. Best effort: an orphan file is harmless. */
export async function removePhoto(...paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p);
  if (!list.length) return;
  const c = await getClient();
  await c.storage.from(BUCKET).remove(list);
}

/** The photo a recipe row points at, as the pair of paths (the thumbnail may be missing on older recipes). */
export type StoredPhoto = { image_path: string | null; thumb_path: string | null };

/**
 * Points a recipe at a new photo, or at none (`null`). Returns the photo it had, and leaves those files alone: the
 * caller removes them when they are no longer needed (after the new photo is in place, or when `Fortryd` is not pressed).
 */
export async function setPhoto(recipeId: string, photo: PhotoPaths | StoredPhoto | null): Promise<StoredPhoto> {
  const c = await getClient();
  const { data: before, error: readError } = await c.from('sp_recipes').select('image_path, thumb_path').eq('id', recipeId).single();
  if (readError) throw readError;
  const next: StoredPhoto = !photo ? { image_path: null, thumb_path: null }
    : 'imagePath' in photo ? { image_path: photo.imagePath, thumb_path: photo.thumbPath } : photo;
  const { error } = await c.from('sp_recipes').update(next).eq('id', recipeId);
  if (error) throw error;
  return before;
}

/**
 * Gives a recipe its fetched photo, only if it still has none (a person may have added one while the fetch ran), and records
 * that the fetch was tried. Returns false when the recipe already had a photo, so the caller removes the new files.
 */
export async function fillPhotoIfEmpty(recipeId: string, photo: PhotoPaths): Promise<boolean> {
  const c = await getClient();
  const { data, error } = await c
    .from('sp_recipes')
    .update({ image_path: photo.imagePath, thumb_path: photo.thumbPath, image_fetch_attempted_at: new Date().toISOString() })
    .eq('id', recipeId)
    .is('image_path', null)
    .select('id');
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** Records that fetching this recipe's photo was tried, so the backfill never tries it again. */
export async function markPhotoAttempted(recipeId: string): Promise<void> {
  const c = await getClient();
  await c.from('sp_recipes').update({ image_fetch_attempted_at: new Date().toISOString() }).eq('id', recipeId);
}

export type SaveInput = {
  id: string | null;
  draft: RecipeDraft;
  photo?: { file: File } | { remove: true } | null;
  previous?: Recipe | null;
  /** A new recipe that starts from an idea keeps the idea's photo until a person changes it. */
  inheritedPhoto?: string | null;
};

/**
 * Saves a recipe and its ingredients. Ingredients are never deleted before the new ones are written: kept lines are
 * updated in place, new lines inserted, and only then lines that were removed are deleted, so a failure half-way
 * leaves a complete (if older) ingredient list.
 */
export async function saveRecipe(householdId: string, { id, draft, photo, previous, inheritedPhoto }: SaveInput): Promise<string> {
  const c = await getClient();
  const recipeId = id ?? crypto.randomUUID();

  let imagePath = previous?.image_path ?? inheritedPhoto ?? null;
  let thumbPath = previous?.thumb_path ?? null;
  let oldPhoto: (string | null)[] = [];
  if (photo && 'file' in photo) {
    oldPhoto = [imagePath, thumbPath];
    ({ imagePath, thumbPath } = await uploadPhotoPair(householdId, recipeId, photo.file, PHOTO_EDGE));
  } else if (photo && 'remove' in photo) {
    oldPhoto = [imagePath, thumbPath];
    imagePath = null;
    thumbPath = null;
  }

  const row = {
    id: recipeId,
    household_id: householdId,
    title: draft.title.trim(),
    descriptor: draft.descriptor.trim() || null,
    category_id: draft.categoryId,
    tags: cleanTags(draft.tags),
    base_servings: draft.baseServings,
    total_minutes: draft.totalMinutes.trim() ? Number(draft.totalMinutes) : null,
    source_url: draft.sourceUrl.trim() || null,
    original_text: draft.originalText?.trim() || null,
    steps: draft.steps.map((t) => t.trim()).filter(Boolean).map((text) => ({ text })),
    // An edit that leaves the photo alone does not write the photo columns: a photo job may have filled them since the editor opened.
    ...(!previous || photo ? { image_path: imagePath, thumb_path: thumbPath } : {}),
    // A new recipe from a link import keeps the photo address, so the photo job (and a later retry) can fetch it.
    ...(!previous && !imagePath && draft.imageUrl ? { image_source_url: draft.imageUrl } : {}),
  };
  const { error } = await c.from('sp_recipes').upsert(row);
  if (error) throw error;

  const kept = new Set(previous?.ingredients.map((i) => i.id) ?? []);
  const lines = draft.ingredients.filter((i) => i.name.trim());
  const rows = lines.map((i, position) => ({
    ...(kept.has(i.key) ? { id: i.key } : {}),
    household_id: householdId,
    recipe_id: recipeId,
    position,
    name: i.name.trim(),
    amount: parseAmount(i.amount) ?? null,
    unit: i.unit.trim() || null,
    note: i.note.trim() || null,
    scales: i.scales,
    canonical_name: i.canonicalName ?? null,
    grocery_category_id: i.groceryCategoryId ?? null,
  }));
  // Two calls so every row in a call has the same columns: existing lines (with id) and new lines (id is generated).
  const existing = rows.filter((r) => 'id' in r);
  const added = rows.filter((r) => !('id' in r));
  if (existing.length) {
    const { error: e } = await c.from('sp_recipe_ingredients').upsert(existing as typeof rows & { id: string }[]);
    if (e) throw e;
  }
  if (added.length) {
    const { error: e } = await c.from('sp_recipe_ingredients').insert(added);
    if (e) throw e;
  }
  const keep = new Set(lines.map((i) => i.key));
  const gone = [...kept].filter((k) => !keep.has(k));
  if (gone.length) {
    const { error: e } = await c.from('sp_recipe_ingredients').delete().in('id', gone);
    if (e) throw e;
  }
  await removePhoto(...oldPhoto);
  return recipeId;
}

export async function setArchived(id: string, archived: boolean): Promise<void> {
  const c = await getClient();
  const { error } = await c.from('sp_recipes').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', id);
  if (error) throw error;
}
