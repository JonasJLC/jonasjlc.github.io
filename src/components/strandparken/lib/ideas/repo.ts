import { getClient } from '../auth';
import { cleanIdea, type Idea, type IdeaDraft } from './model';

export async function loadIdeas(): Promise<Idea[]> {
  const c = await getClient();
  const { data, error } = await c.from('sp_dinner_ideas').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function saveIdea(householdId: string, id: string | null, draft: IdeaDraft): Promise<void> {
  const c = await getClient();
  const clean = cleanIdea(draft);
  const { error } = id
    ? await c.from('sp_dinner_ideas').update(clean).eq('id', id)
    : await c.from('sp_dinner_ideas').insert({ household_id: householdId, ...clean });
  if (error) throw error;
}

/** Fails (and keeps the idea) while a day still points at it: the plan is never left with a hole. */
export async function deleteIdea(id: string): Promise<void> {
  const c = await getClient();
  const { error } = await c.from('sp_dinner_ideas').delete().eq('id', id);
  if (error) throw error;
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
