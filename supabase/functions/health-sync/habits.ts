// Automatic habits (idea 15 Task 9): after `health-sync` has upserted a person's days, every active automatic habit that
// person owns gets one completion (`source: 'automatic'`, `completed_by` the person) for each day in the synced range on
// which its rule is met. Rules:
// - idempotent: `unique (habit_id, date)` with `on conflict do nothing`, so running it again adds nothing;
// - no data is never complete, and a later lower value never removes a completion (nothing here deletes);
// - only dates in the synced range, never the future, and never before the habit was created;
// - when two sources have the same metric on a day, the first of oura, garmin, manual with a value wins (as in the app).
// Automatic habits are personal (the table refuses shared ones), so only the person's own habits are read.
// Logs carry counts only: never values.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { HttpError } from '../_shared/http.ts';
import type { Who } from '../_shared/health/db.ts';
import { addDays, copenhagenDate } from '../_shared/health/normalise.ts';
import type { PersonKey } from '../_shared/health/types.ts';

export type RuleMetric = 'steps' | 'sleep_score' | 'activity_progress';
export type Rule = { metric: RuleMetric; op: '>=' | '>'; threshold: number };
export type RuleDay = Partial<Record<RuleMetric, number | null>>;

const METRICS: readonly RuleMetric[] = ['steps', 'sleep_score', 'activity_progress'];
const SOURCE_PRIORITY = ['oura', 'garmin', 'manual'];

export const isRule = (r: unknown): r is Rule => {
  if (typeof r !== 'object' || r === null) return false;
  const x = r as Record<string, unknown>;
  return METRICS.includes(x.metric as RuleMetric) && (x.op === '>=' || x.op === '>') && typeof x.threshold === 'number' && Number.isFinite(x.threshold);
};

/** Keep in step with `meets` in src/components/strandparken/lib/habits/rules.ts (a test compares them). Missing data is never complete. */
export function meets(rule: Rule, day: RuleDay): boolean {
  const v = day[rule.metric];
  if (typeof v !== 'number' || !Number.isFinite(v)) return false;
  return rule.op === '>=' ? v >= rule.threshold : v > rule.threshold;
}

export interface AutomaticHabit {
  id: string;
  rule: Rule;
  /** ISO timestamp. */
  createdAt: string;
}

/** One `sp_health_daily` row, reduced to what rules read. */
export interface DayRow extends RuleDay {
  date: string;
  source: string;
}

export interface NewCompletion {
  householdId: string;
  habitId: string;
  date: string;
  person: PersonKey;
}

export interface HabitsDb {
  /** Active (not archived) automatic habits owned by this person. */
  automaticHabits(who: Who): Promise<AutomaticHabit[]>;
  /** The person's health rows with `from <= date <= to`, from every source. */
  days(who: Who, from: string, to: string): Promise<DayRow[]>;
  /** Stores completions, ignoring any that exist already. Returns how many were new. */
  addCompletions(rows: NewCompletion[]): Promise<number>;
}

/** One value per metric and day: the first source in priority order that has one. */
export function mergeDays(rows: DayRow[]): Map<string, RuleDay> {
  const rank = (s: string) => {
    const i = SOURCE_PRIORITY.indexOf(s);
    return i === -1 ? SOURCE_PRIORITY.length : i;
  };
  const merged = new Map<string, RuleDay>();
  for (const row of [...rows].sort((a, b) => rank(a.source) - rank(b.source))) {
    const day = merged.get(row.date) ?? {};
    for (const m of METRICS) {
      const v = row[m];
      if (typeof v === 'number' && Number.isFinite(v) && typeof day[m] !== 'number') day[m] = v;
    }
    merged.set(row.date, day);
  }
  return merged;
}

/** Completes the person's automatic habits for the days in `[from, to]`. Returns the number of new completions. */
export async function evaluateHabits(db: HabitsDb, who: Who, range: { from: string; to: string }, now: Date): Promise<number> {
  const habits = await db.automaticHabits(who);
  if (habits.length === 0) return 0;
  const to = range.to < copenhagenDate(now) ? range.to : copenhagenDate(now); // never the future
  if (range.from > to) return 0;
  const days = mergeDays(await db.days(who, range.from, to));
  const rows: NewCompletion[] = [];
  for (const habit of habits) {
    const created = copenhagenDate(new Date(habit.createdAt));
    for (let date = range.from > created ? range.from : created; date <= to; date = addDays(date, 1)) {
      const day = days.get(date);
      if (day && meets(habit.rule, day)) rows.push({ householdId: who.householdId, habitId: habit.id, date, person: who.person });
    }
  }
  return rows.length === 0 ? 0 : db.addCompletions(rows);
}

/** `evaluateHabits` that never throws: a habit problem must not turn a good health sync into a failed one. */
export async function completeHabits(db: HabitsDb, who: Who, range: { from: string; to: string }, now: Date): Promise<number> {
  try {
    return await evaluateHabits(db, who, range, now);
  } catch (e) {
    console.error('health-sync habits failed', e instanceof Error ? e.name : typeof e);
    return 0;
  }
}

// ---- the real database (service role) ----

const fail = () => {
  // The code only: messages can quote values.
  throw new HttpError(500, 'db_habits');
};

export function adminHabitsDb(c: SupabaseClient): HabitsDb {
  return {
    async automaticHabits(who) {
      const { data, error } = await c.from('sp_habits').select('id, rule, created_at')
        .eq('household_id', who.householdId).eq('owner', who.person).eq('tracking', 'automatic').is('archived_at', null);
      if (error) fail();
      return (data ?? []).filter((r) => isRule(r.rule)).map((r) => ({ id: r.id as string, rule: r.rule as Rule, createdAt: r.created_at as string }));
    },
    async days(who, from, to) {
      const { data, error } = await c.from('sp_health_daily').select('date, source, steps, sleep_score, activity_progress')
        .eq('household_id', who.householdId).eq('person', who.person).gte('date', from).lte('date', to);
      if (error) fail();
      return (data ?? []) as DayRow[];
    },
    async addCompletions(rows) {
      const { data, error } = await c.from('sp_habit_completions').upsert(
        rows.map((r) => ({ household_id: r.householdId, habit_id: r.habitId, date: r.date, completed_by: r.person, source: 'automatic' })),
        { onConflict: 'habit_id,date', ignoreDuplicates: true },
      ).select('id');
      if (error) fail();
      return data?.length ?? 0;
    },
  };
}
