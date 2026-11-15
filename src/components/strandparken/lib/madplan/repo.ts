import { getClient } from '../auth';
import { defaultServings, type PlanEntry } from './model';

/** Plan entries from `from` to `to`, both included. */
export async function loadEntries(from: string, to: string): Promise<PlanEntry[]> {
  const c = await getClient();
  const { data, error } = await c.from('sp_meal_plan_entries').select('*').gte('date', from).lte('date', to).order('date');
  if (error) throw error;
  return data;
}

export type Dish = { recipeId: string } | { freeText: string };

export async function addEntry(householdId: string, date: string, dish: Dish, servings = defaultServings): Promise<void> {
  const c = await getClient();
  const { error } = await c.from('sp_meal_plan_entries').insert({
    household_id: householdId,
    date,
    servings,
    recipe_id: 'recipeId' in dish ? dish.recipeId : null,
    free_text: 'freeText' in dish ? dish.freeText : null,
  });
  if (error) throw error;
}

export async function setServings(id: string, servings: number): Promise<void> {
  const c = await getClient();
  const { error } = await c.from('sp_meal_plan_entries').update({ servings }).eq('id', id);
  if (error) throw error;
}

export async function removeEntry(id: string): Promise<void> {
  const c = await getClient();
  const { error } = await c.from('sp_meal_plan_entries').delete().eq('id', id);
  if (error) throw error;
}

/** Move a dinner to an empty day. The row keeps its id, so shopping items and calendar events stay attached. */
export async function moveEntry(id: string, toDate: string): Promise<void> {
  const c = await getClient();
  const { error } = await c.from('sp_meal_plan_entries').update({ date: toDate }).eq('id', id);
  if (error) throw error;
}

/**
 * Swap two days. One dinner per day is a unique constraint, so the rows cannot trade dates directly: the first is
 * parked on a date no one plans for, the second moves into its place, then the first takes the second's old day.
 * If a step fails, the rows already moved are put back.
 */
export async function swapEntries(a: Pick<PlanEntry, 'id' | 'date'>, b: Pick<PlanEntry, 'id' | 'date'>): Promise<void> {
  const parking = '0001-01-01';
  const c = await getClient();
  const set = async (id: string, date: string) => {
    const { error } = await c.from('sp_meal_plan_entries').update({ date }).eq('id', id);
    if (error) throw error;
  };
  await set(a.id, parking);
  try {
    await set(b.id, a.date);
    try {
      await set(a.id, b.date);
    } catch (e) {
      await set(b.id, b.date).catch(() => {});
      throw e;
    }
  } catch (e) {
    await set(a.id, a.date).catch(() => {});
    throw e;
  }
}
