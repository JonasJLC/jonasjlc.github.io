import { getClient } from '../auth';

/**
 * Remembered units on the shopping list (idea 13, `sp_unit_preferences`): one unit per ingredient key for the household.
 * Read when the list loads; changing one needs a connection.
 */
export async function loadUnitPreferences(): Promise<Record<string, string>> {
  const c = await getClient();
  const { data, error } = await c.from('sp_unit_preferences').select('ingredient_key, unit');
  if (error) throw error;
  return Object.fromEntries(data.map((p) => [p.ingredient_key, p.unit]));
}

export async function saveUnitPreference(householdId: string, ingredientKey: string, unit: string): Promise<void> {
  const c = await getClient();
  const { error } = await c
    .from('sp_unit_preferences')
    .upsert({ household_id: householdId, ingredient_key: ingredientKey, unit }, { onConflict: 'household_id,ingredient_key' });
  if (error) throw error;
}

export async function clearUnitPreference(householdId: string, ingredientKey: string): Promise<void> {
  const c = await getClient();
  const { error } = await c.from('sp_unit_preferences').delete().eq('household_id', householdId).eq('ingredient_key', ingredientKey);
  if (error) throw error;
}
