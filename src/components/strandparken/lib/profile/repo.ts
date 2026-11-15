import { getClient } from '../auth';
import { keyFromPerson, type Person } from '../people';
import { cleanDislikes, type ProfileRow } from './model';

export async function loadProfiles(): Promise<ProfileRow[]> {
  const c = await getClient();
  const { data, error } = await c.from('sp_profiles').select('*');
  if (error) throw error;
  return data;
}

/** Writes the signed-in person's own profile; the database refuses anyone else's (row-level security). */
export async function saveProfile(householdId: string, person: Person, dislikes: string[], preferences: string): Promise<void> {
  const c = await getClient();
  const { error } = await c.from('sp_profiles').upsert(
    { household_id: householdId, person: keyFromPerson(person), dislikes: cleanDislikes(dislikes), preferences: preferences.trim().slice(0, 1000) || null },
    { onConflict: 'household_id,person' },
  );
  if (error) throw error;
}
