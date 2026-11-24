import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { Database } from '../../../lib/supabase/database.types';
import { getClient } from './auth';

/** Tables published to Realtime (see the strandparken_food_tables and strandparken_todos migrations). */
export type LiveTable = 'sp_shopping_items' | 'sp_meal_plan_entries' | 'sp_todos' | 'sp_habits' | 'sp_habit_completions';
export type LiveRow<T extends LiveTable> = Database['public']['Tables'][T]['Row'];
export type LiveChange<T extends LiveTable> = RealtimePostgresChangesPayload<LiveRow<T>>;

type Listener = (change: LiveChange<LiveTable>) => void;
type Hub = { channel: RealtimeChannel; listeners: Set<Listener> };

/**
 * One channel per household table, shared by every subscriber. The client hands back the existing channel for a topic it
 * already has, and callbacks cannot be added to a subscribed channel, so two parts of a screen listening to the same table
 * (Hjem's "I aften" and "Mangler at handle") share one channel and the last one out removes it.
 */
const hubs = new Map<string, Hub>();

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
  const topic = `strandparken:${table}:${householdId}`;
  let hub = hubs.get(topic);
  if (!hub) {
    const listeners = new Set<Listener>();
    const channel = c
      .channel(topic)
      .on<LiveRow<T>>(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `household_id=eq.${householdId}` },
        (change) => {
          for (const listener of [...listeners]) listener(change as LiveChange<LiveTable>);
        },
      )
      .subscribe();
    hub = { channel, listeners };
    hubs.set(topic, hub);
  }
  const mine = hub;
  const listener = onChange as unknown as Listener;
  mine.listeners.add(listener);
  return () => {
    mine.listeners.delete(listener);
    if (mine.listeners.size > 0 || hubs.get(topic) !== mine) return;
    hubs.delete(topic);
    void c.removeChannel(mine.channel);
  };
}
