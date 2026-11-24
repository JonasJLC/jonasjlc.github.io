// Pure checks shared by every adapter: values out of range become null, a goal of 0 gives no progress, and dates are
// Copenhagen calendar days (design D53).
import type { HealthDay, SourceId } from './types.ts';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The calendar day in Copenhagen for an instant. */
export function copenhagenDate(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

/** The hour (0–23) in Copenhagen for an instant. */
export function copenhagenHour(at: Date): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Copenhagen', hour: '2-digit', hourCycle: 'h23' }).format(at));
}

/** `date` plus `days` calendar days (negative goes back). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const isIsoDate = (v: unknown): v is string =>
  typeof v === 'string' && ISO_DATE.test(v) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** A score 1–100. 0 means "nothing recorded" at the providers, so it is null as well. */
export function score(v: unknown): number | null {
  const n = num(v);
  return n === null || n <= 0 || n > 100 ? null : Math.round(n);
}

/** A whole count ≥ 0 (steps), null when missing or implausible (over 200 000 a day). */
export function count(v: unknown): number | null {
  const n = num(v);
  return n === null || n < 0 || n > 200_000 ? null : Math.round(n);
}

/** A goal > 0, null otherwise. */
export function goal(v: unknown): number | null {
  const n = num(v);
  return n === null || n <= 0 || n > 1_000_000 ? null : Math.round(n);
}

/** `done / target`, not clamped at 1 (a goal can be exceeded) but capped at 9.999 to fit the column; null when target ≤ 0. */
export function progress(done: unknown, target: unknown): number | null {
  const d = num(done);
  const g = num(target);
  if (d === null || g === null || g <= 0 || d < 0) return null;
  return Math.min(9.999, Math.round((d / g) * 1000) / 1000);
}

/** Cycle day from the period starts: the start day is day 1. Null without a start on or before `date`, or past day 60. */
export function cycleDay(date: string, starts: readonly string[]): number | null {
  const latest = starts.filter((s) => isIsoDate(s) && s <= date).sort().at(-1);
  if (!latest) return null;
  const n = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${latest}T00:00:00Z`)) / 86_400_000) + 1;
  return n >= 1 && n <= 60 ? n : null;
}

type Values = Partial<Omit<HealthDay, 'date' | 'source' | 'last_synced_at'>>;

/** A complete day with every value checked. A unit without a goal is dropped. */
export function day(source: SourceId, date: string, v: Values, at: Date): HealthDay {
  const g = goal(v.activity_goal);
  return {
    date,
    source,
    sleep_score: score(v.sleep_score),
    activity_progress: v.activity_progress == null ? null : progress(v.activity_progress, 1),
    activity_goal: g,
    activity_goal_unit: g === null ? null : (v.activity_goal_unit ?? null),
    steps: count(v.steps),
    cycle_day: typeof v.cycle_day === 'number' && v.cycle_day >= 1 && v.cycle_day <= 60 ? Math.round(v.cycle_day) : null,
    last_synced_at: at.toISOString(),
  };
}

/** True when the day carries at least one value. Empty days are not stored. */
export const hasValues = (d: HealthDay) =>
  d.sleep_score !== null || d.activity_progress !== null || d.activity_goal !== null || d.steps !== null || d.cycle_day !== null;
