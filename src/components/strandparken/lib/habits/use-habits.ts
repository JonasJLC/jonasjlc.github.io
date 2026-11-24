import { useCallback, useEffect, useRef, useState } from 'react';
import { notify } from '../../ui/toast';
import { addDays, mondayOf, todayIso, type IsoDate } from '../madplan/dates';
import { subscribeHousehold } from '../realtime';
import { isNetworkError } from '../shopping/repo';
import { completionFromRow, habitFromRow, type Completion, type Habit, type HabitDraft } from './model';
import { archiveHabit, complete, loadCompletions, loadHabits, restoreHabit, saveHabit, undo } from './repo';

/** Completions are loaded this many weeks back (history shows 8; "uger i træk" can look further). */
export const HISTORY_WEEKS = 26;

export type HabitsState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; habits: Habit[]; completions: Completion[] };

const FAILED = 'Kunne ikke gemme. Prøv igen.';

const upsertHabit = (habits: Habit[], h: Habit) => (habits.some((x) => x.id === h.id) ? habits.map((x) => (x.id === h.id ? h : x)) : [...habits, h]);
const has = (cs: Completion[], habitId: string, date: IsoDate) => cs.some((c) => c.habitId === habitId && c.date === date);
const addCompletion = (cs: Completion[], c: Completion) => (has(cs, c.habitId, c.date) ? cs : [...cs, c]);
const removeCompletion = (cs: Completion[], habitId: string, date: IsoDate) => cs.filter((c) => !(c.habitId === habitId && c.date === date));

/**
 * The household's habits and the last weeks of completions (idea 15). Ticks, saves and archives show at once and are rolled
 * back, with a toast, if the database refuses them; each returns whether it went through. Changes from the other phone and
 * from `health-sync` (automatic habits) arrive over Realtime. `today` follows Copenhagen and refreshes when the app comes
 * back to the front, so a phone left open overnight moves to the new day. `me` is the signed-in person's key.
 */
export function useHabits(householdId: string | null, me: 'a' | 'b' | null) {
  const [state, setState] = useState<HabitsState>({ status: 'loading' });
  const [today, setToday] = useState<IsoDate>(() => todayIso());
  const [offline, setOffline] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const patch = useCallback((fn: (s: { habits: Habit[]; completions: Completion[] }) => { habits: Habit[]; completions: Completion[] }) => {
    setState((s) => (s.status === 'ready' ? { status: 'ready', ...fn(s) } : s));
  }, []);

  const reload = useCallback(async () => {
    if (!householdId) return;
    const now = todayIso();
    setToday(now);
    try {
      const [habits, completions] = await Promise.all([loadHabits(), loadCompletions(addDays(mondayOf(now), -7 * HISTORY_WEEKS), addDays(now, 1))]);
      setState({ status: 'ready', habits, completions });
      setOffline(false);
    } catch (e) {
      if (isNetworkError(e)) setOffline(true);
      setState((s) => (s.status === 'ready' ? s : { status: 'error' }));
    }
  }, [householdId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Back online or back to the front: a live event may have been missed, and the day may have changed.
  useEffect(() => {
    const go = () => void reload();
    const visible = () => document.visibilityState === 'visible' && go();
    window.addEventListener('online', go);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('online', go);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [reload]);

  useEffect(() => {
    if (!householdId) return;
    const stops: (() => void)[] = [];
    let gone = false;
    const keep = (p: Promise<() => void>) => p.then((stop) => (gone ? stop() : void stops.push(stop))).catch(() => {});
    void keep(subscribeHousehold(householdId, 'sp_habits', (change) => {
      if (change.eventType === 'DELETE') {
        const id = (change.old as { id?: string }).id;
        if (id) patch((s) => ({ habits: s.habits.filter((h) => h.id !== id), completions: s.completions.filter((c) => c.habitId !== id) }));
      } else {
        patch((s) => ({ ...s, habits: upsertHabit(s.habits, habitFromRow(change.new)) }));
      }
    }));
    void keep(subscribeHousehold(householdId, 'sp_habit_completions', (change) => {
      if (change.eventType === 'DELETE') {
        const old = change.old as { habit_id?: string; date?: string };
        if (old.habit_id && old.date) patch((s) => ({ ...s, completions: removeCompletion(s.completions, old.habit_id!, old.date!) }));
      } else {
        patch((s) => ({ ...s, completions: addCompletion(s.completions, completionFromRow(change.new)) }));
      }
    }));
    return () => {
      gone = true;
      for (const stop of stops) stop();
    };
  }, [householdId, patch]);

  /** Applies `optimistic` now, then runs `send`; on failure puts back what was there and says so. */
  const run = useCallback(async (optimistic: Parameters<typeof patch>[0], send: () => Promise<void>): Promise<boolean> => {
    const before = stateRef.current;
    patch(optimistic);
    try {
      await send();
      setOffline(false);
      return true;
    } catch (e) {
      if (isNetworkError(e)) setOffline(true);
      if (before.status === 'ready') setState(before);
      notify(FAILED);
      return false;
    }
  }, [patch]);

  /** Ticks (`done`) or unticks a manual habit for `date` (default today). Automatic habits cannot be ticked: returns false, no toast. */
  const setDone = useCallback((habit: Habit, done: boolean, date: IsoDate = todayIso()): Promise<boolean> => {
    if (!householdId || !me || habit.tracking === 'automatic') return Promise.resolve(false);
    return run(
      (s) => ({ ...s, completions: done ? addCompletion(s.completions, { habitId: habit.id, date, completedBy: me, source: 'manual' }) : removeCompletion(s.completions, habit.id, date) }),
      async () => {
        if (done) await complete(householdId, habit.id, date, me);
        else await undo(habit.id, date);
      },
    );
  }, [householdId, me, run]);

  /** Creates (`id` omitted) or updates (`id` of an existing habit) a habit. */
  const save = useCallback((draft: HabitDraft, id?: string): Promise<boolean> => {
    if (!householdId) return Promise.resolve(false);
    const habitId = id ?? crypto.randomUUID();
    const previous = stateRef.current.status === 'ready' ? stateRef.current.habits.find((h) => h.id === habitId) : undefined;
    const optimistic: Habit = {
      ...draft, title: draft.title.trim(), id: habitId,
      owner: previous?.owner ?? draft.owner, // the owner of an existing habit never changes
      archivedAt: previous?.archivedAt ?? null, createdAt: previous?.createdAt ?? new Date().toISOString(),
    };
    return run(
      (s) => ({ ...s, habits: upsertHabit(s.habits, optimistic) }),
      async () => {
        const row = await saveHabit(householdId, { ...draft, id: habitId }, id ? 'update' : 'create');
        patch((s) => ({ ...s, habits: upsertHabit(s.habits, row) }));
      },
    );
  }, [householdId, run, patch]);

  const archive = useCallback((habit: Habit) => run(
    (s) => ({ ...s, habits: upsertHabit(s.habits, { ...habit, archivedAt: new Date().toISOString() }) }),
    async () => { await archiveHabit(habit.id); },
  ), [run]);

  const restore = useCallback((habit: Habit) => run(
    (s) => ({ ...s, habits: upsertHabit(s.habits, { ...habit, archivedAt: null }) }),
    async () => { await restoreHabit(habit.id); },
  ), [run]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    void reload();
  }, [reload]);

  return { state, today, offline, setDone, save, archive, restore, retry };
}
