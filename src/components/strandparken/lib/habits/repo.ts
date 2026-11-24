import { getClient } from '../auth';
import type { IsoDate } from '../madplan/dates';
import {
  completionFromRow, habitFromRow, habitToRow,
  type Completion, type Habit, type HabitDraft,
} from './model';

const PAGE = 1000;

/** Every habit of the household, archived ones included (the panel hides them, the history sheet restores them). */
export async function loadHabits(): Promise<Habit[]> {
  const c = await getClient();
  const { data, error } = await c.from('sp_habits').select('*').order('created_at');
  if (error) throw error;
  return data.map(habitFromRow);
}

/** Completions with `from <= date <= to`, oldest first. Paged, because the API returns at most 1000 rows at a time. */
export async function loadCompletions(from: IsoDate, to: IsoDate): Promise<Completion[]> {
  const c = await getClient();
  const out: Completion[] = [];
  for (let start = 0; ; start += PAGE) {
    const { data, error } = await c.from('sp_habit_completions').select('*')
      .gte('date', from).lte('date', to).order('date').order('id').range(start, start + PAGE - 1);
    if (error) throw error;
    out.push(...data.map(completionFromRow));
    if (data.length < PAGE) return out;
  }
}

/**
 * `'create'` inserts a habit (with the id made on the phone, or a new one); `'update'` changes the habit with `draft.id`.
 * The owner of an existing habit never changes: the database keeps the old one.
 */
export async function saveHabit(householdId: string, draft: HabitDraft & { id?: string }, mode: 'create' | 'update'): Promise<Habit> {
  const c = await getClient();
  if (mode === 'update') {
    if (!draft.id) throw new Error('saveHabit: update needs an id');
    const { id, household_id: _h, owner: _o, ...changes } = habitToRow(householdId, draft);
    const { data, error } = await c.from('sp_habits').update(changes).eq('id', id!).select().single();
    if (error) throw error;
    return habitFromRow(data);
  }
  const { data, error } = await c.from('sp_habits').insert({ ...habitToRow(householdId, draft), id: draft.id ?? crypto.randomUUID() }).select().single();
  if (error) throw error;
  return habitFromRow(data);
}

const setArchived = async (id: string, at: string | null): Promise<Habit> => {
  const c = await getClient();
  const { data, error } = await c.from('sp_habits').update({ archived_at: at }).eq('id', id).select().single();
  if (error) throw error;
  return habitFromRow(data);
};

export const archiveHabit = (id: string) => setArchived(id, new Date().toISOString());
export const restoreHabit = (id: string) => setArchived(id, null);

/**
 * Ticks a manual habit for a day. The database sets `completed_by` and `source` itself (what is sent only has to be valid),
 * refuses automatic habits, and allows one tick per habit and day: a second one (the other phone got there first) is the
 * same outcome, so it counts as done.
 */
export async function complete(householdId: string, habitId: string, date: IsoDate, person: 'a' | 'b'): Promise<Completion> {
  const c = await getClient();
  const { data, error } = await c.from('sp_habit_completions')
    .insert({ household_id: householdId, habit_id: habitId, date, completed_by: person })
    .select().single();
  if (error) {
    if (error.code === '23505') return { habitId, date, completedBy: person, source: 'manual' };
    throw error;
  }
  return completionFromRow(data);
}

/** Removes a manual tick (a tick that is already gone is fine). The database refuses to undo an automatic completion. */
export async function undo(habitId: string, date: IsoDate): Promise<void> {
  const c = await getClient();
  const { error } = await c.from('sp_habit_completions').delete().eq('habit_id', habitId).eq('date', date);
  if (error) throw error;
}
