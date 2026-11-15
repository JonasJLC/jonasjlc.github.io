import { getClient } from '../auth';
import { canonicalName, rowFor, type GroceryCategory, type Plan, type ShoppingRow, type Status, type Wanted } from './model';

/** Every row of the household, cleared ones included: the plan comparison needs them to know what was already handled. */
export async function loadRows(): Promise<ShoppingRow[]> {
  const c = await getClient();
  const { data, error } = await c.from('sp_shopping_items').select('*').order('created_at');
  if (error) throw error;
  return data;
}

export async function loadGroceryCategories(): Promise<GroceryCategory[]> {
  const c = await getClient();
  const { data, error } = await c.from('sp_grocery_categories').select('*').order('position').order('name');
  if (error) throw error;
  return data;
}

async function setStatus(ids: string[], status: Status, extra: { checked_by?: string | null; checked_at?: string | null } = {}) {
  if (!ids.length) return;
  const c = await getClient();
  const { error } = await c
    .from('sp_shopping_items')
    .update({ status, client_updated_at: new Date().toISOString(), ...extra })
    .in('id', ids);
  if (error) throw error;
}

/** Tick or untick every row of a merged line. The latest change wins when both phones touch the same item. */
export async function setChecked(ids: string[], checked: boolean): Promise<void> {
  const c = await getClient();
  const { data } = await c.auth.getSession();
  await setStatus(ids, checked ? 'checked' : 'active', checked ? { checked_by: data.session?.user.id ?? null, checked_at: new Date().toISOString() } : { checked_by: null, checked_at: null });
}

export const clearRows = (ids: string[]) => setStatus(ids, 'cleared');
export const restoreRows = (ids: string[]) => setStatus(ids, 'checked');

export async function addManual(householdId: string, name: string, categoryId: string | null): Promise<void> {
  const c = await getClient();
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, 200);
  const { error } = await c.from('sp_shopping_items').insert({
    household_id: householdId, name: clean, canonical_name: canonicalName(clean), grocery_category_id: categoryId,
    source: 'manual', client_updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function setCategory(ids: string[], categoryId: string | null): Promise<void> {
  const c = await getClient();
  const { error } = await c.from('sp_shopping_items').update({ grocery_category_id: categoryId, client_updated_at: new Date().toISOString() }).in('id', ids);
  if (error) throw error;
}

export async function removeRows(ids: string[]): Promise<void> {
  const c = await getClient();
  const { error } = await c.from('sp_shopping_items').delete().in('id', ids);
  if (error) throw error;
}

/** Rows to put back after an undone remove: the same ids, so ticks and history stay attached. */
export async function restoreDeleted(rows: ShoppingRow[]): Promise<void> {
  const c = await getClient();
  const { error } = await c.from('sp_shopping_items').insert(rows.map(({ created_at: _a, updated_at: _b, created_by: _c, ...r }) => r));
  if (error) throw error;
}

/**
 * Writes what the review decided. `kept` are the ingredients the person needs to buy, `have` the ones they already own
 * (stored as `have` rows so the same day is never asked about again). Ingredient rows are inserted before anything is
 * removed, so a failure half-way never leaves the list emptier than it was.
 */
export async function applyPlan(householdId: string, plan: Plan, kept: Wanted[], have: Wanted[]): Promise<void> {
  const c = await getClient();
  const inserts = [
    ...kept.map((w) => rowFor(householdId, w, 'active')),
    ...have.map((w) => rowFor(householdId, w, 'have')),
    ...plan.add.map((w) => rowFor(householdId, w, 'active')),
  ];
  if (inserts.length) {
    const { error } = await c.from('sp_shopping_items').insert(inserts);
    if (error) throw error;
  }
  for (const u of plan.update) {
    const { error } = await c.from('sp_shopping_items').update({ amount: u.amount, unit: u.unit, client_updated_at: new Date().toISOString() }).eq('id', u.id);
    if (error) throw error;
  }
  if (plan.remove.length) await removeRows(plan.remove);
}

/** A single recipe's ingredients straight to the list (after the review). */
export async function addRecipeRows(householdId: string, kept: Wanted[]): Promise<void> {
  if (!kept.length) return;
  const c = await getClient();
  const { error } = await c.from('sp_shopping_items').insert(kept.map((w) => rowFor(householdId, w, 'active')));
  if (error) throw error;
}
