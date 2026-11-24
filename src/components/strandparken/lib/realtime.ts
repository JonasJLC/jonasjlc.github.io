import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { Database } from '../../../lib/supabase/database.types';
import { getClient } from './auth';

/** Tables published to Realtime (see the strandparken_food_tables and strandparken_todos migrations). */
export type LiveTable = 'sp_shopping_items' | 'sp_meal_plan_entries' | 'sp_todos';
export type LiveRow<T extends LiveTable> = Database['public']['Tables'][T]['Row'];
export type LiveChange<T extends LiveTable> = RealtimePostgresChangesPayload<LiveRow<T>>;

/**
 * Calls `onChange` for every insert, update and delete in one household's rows of `table`, until the returned
 * function is called. The filter is a convenience: row-level security decides what a person may receive.
 * Both tables use full replica identity, so a delete event still carries the old row.
 */
export async function subscribeHousehold<T extends LiveTable>(
  householdId: string,
  table: T,
  onChange: (change: LiveChange<T>) => void,
): Promise<() => void> {
  const c = await getClient();
  const channel = c
    .channel(`strandparken:${table}:${householdId}`)
    .on<LiveRow<T>>(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `household_id=eq.${householdId}` },
      onChange,
    )
    .subscribe();
  return () => {
    void c.removeChannel(channel);
  };
}
