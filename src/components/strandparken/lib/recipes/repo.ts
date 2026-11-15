import { getClient } from '../auth';
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

/** A photo is scaled to at most 1600 px on its long side and stored as JPEG, so a phone camera picture is ~300 KB, not 6 MB. */
export async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.82));
  if (!blob) throw new Error('Billedet kunne ikke behandles.');
  return blob;
}

export async function uploadPhoto(householdId: string, recipeId: string, file: File): Promise<string> {
  const c = await getClient();
  const path = `${householdId}/${recipeId}/${crypto.randomUUID()}.jpg`;
  const { error } = await c.storage.from(BUCKET).upload(path, await shrinkImage(file), { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

async function removePhoto(path: string | null) {
  if (!path) return;
  const c = await getClient();
  await c.storage.from(BUCKET).remove([path]); // best effort: an orphan file is harmless
}

export type SaveInput = { id: string | null; draft: RecipeDraft; photo?: { file: File } | { remove: true } | null; previous?: Recipe | null };

/**
 * Saves a recipe and its ingredients. Ingredients are never deleted before the new ones are written: kept lines are
 * updated in place, new lines inserted, and only then lines that were removed are deleted, so a failure half-way
 * leaves a complete (if older) ingredient list.
 */
export async function saveRecipe(householdId: string, { id, draft, photo, previous }: SaveInput): Promise<string> {
  const c = await getClient();
  const recipeId = id ?? crypto.randomUUID();

  let imagePath = previous?.image_path ?? null;
  let oldPhoto: string | null = null;
  if (photo && 'file' in photo) {
    oldPhoto = imagePath;
    imagePath = await uploadPhoto(householdId, recipeId, photo.file);
  } else if (photo && 'remove' in photo) {
    oldPhoto = imagePath;
    imagePath = null;
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
    image_path: imagePath,
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
  if (oldPhoto) await removePhoto(oldPhoto);
  return recipeId;
}

export async function setArchived(id: string, archived: boolean): Promise<void> {
  const c = await getClient();
  const { error } = await c.from('sp_recipes').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', id);
  if (error) throw error;
}
