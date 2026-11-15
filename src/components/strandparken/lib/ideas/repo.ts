import { getClient } from '../auth';
import { removePhoto, uploadPhoto } from '../recipes/repo';
import { cleanIdea, type Idea, type IdeaDraft } from './model';

export async function loadIdeas(): Promise<Idea[]> {
  const c = await getClient();
  const { data, error } = await c.from('sp_dinner_ideas').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export type IdeaPhotoChange = { file: File } | { remove: true } | null;

/**
 * Saves an idea. A new photo goes to Storage first (under `<household>/ideas/<idea id>/`, inside the folder the bucket
 * policy already allows); the row is written next, and only then is the old file removed, so a failure never leaves
 * an idea pointing at a missing file.
 */
export async function saveIdea(householdId: string, id: string | null, draft: IdeaDraft, photo: IdeaPhotoChange = null, previousPath: string | null = null): Promise<string> {
  const c = await getClient();
  const ideaId = id ?? crypto.randomUUID();
  const clean = cleanIdea(draft);
  let imagePath = previousPath;
  if (photo && 'file' in photo) imagePath = await uploadPhoto(householdId, `ideas/${ideaId}`, photo.file);
  else if (photo && 'remove' in photo) imagePath = null;
  const { error } = id
    ? await c.from('sp_dinner_ideas').update({ ...clean, image_path: imagePath }).eq('id', id)
    : await c.from('sp_dinner_ideas').insert({ id: ideaId, household_id: householdId, ...clean, image_path: imagePath });
  if (error) {
    if (imagePath && imagePath !== previousPath) await removePhoto(imagePath);
    throw error;
  }
  if (previousPath && imagePath !== previousPath) await removePhoto(previousPath);
  return ideaId;
}

/** Fails (and keeps the idea) while a day still points at it: the plan is never left with a hole. */
export async function deleteIdea(id: string, imagePath: string | null = null): Promise<void> {
  const c = await getClient();
  const { error } = await c.from('sp_dinner_ideas').delete().eq('id', id);
  if (error) throw error;
  await removePhoto(imagePath);
}

/**
 * An idea became a recipe: every planned day that pointed at the idea now points at the recipe (same row, same date,
 * same persons), then the idea is marked as promoted and leaves the catalog. Days are moved first, so if the second
 * step fails nothing is lost and the call can simply be repeated.
 */
export async function promoteIdea(ideaId: string, recipeId: string): Promise<void> {
  const c = await getClient();
  const moved = await c.from('sp_meal_plan_entries').update({ idea_id: null, recipe_id: recipeId }).eq('idea_id', ideaId);
  if (moved.error) throw moved.error;
  const done = await c.from('sp_dinner_ideas').update({ promoted_recipe_id: recipeId }).eq('id', ideaId);
  if (done.error) throw done.error;
}
