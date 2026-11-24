// The Sundhed data view's view model (idea 11): pure functions, no React. Plan 12 (Jeres dag) and plan 15 (Vaner) extend
// or reuse these. Hidden metrics (the owner's choice) are left out; null is "no data"; yesterday is never shown as today.
import { formatSync, isStale, METRICS, type DayView, type Metric, type SourceStatus } from './model.ts';

export type TileKey = 'sleep' | 'activity' | 'steps' | 'cycle';
export interface Tile {
  key: TileKey;
  metric: Metric;
  label: string;
  /** The text to show, or null for "no data" (then `empty` is shown instead). */
  value: string | null;
  empty: string;
}

/** Danish thousands grouping: 6420 becomes "6.420". */
export const formatSteps = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const tileDefs: { key: TileKey; metric: Metric; label: string; empty: string; format: (d: DayView) => string | null }[] = [
  { key: 'sleep', metric: 'sleep_score', label: 'Søvn', empty: 'Ingen data i nat', format: (d) => (d.sleep_score == null ? null : String(Math.round(d.sleep_score))) },
  { key: 'activity', metric: 'activity', label: 'Aktivitet', empty: 'Ingen data i dag', format: (d) => (d.activity == null ? null : `${Math.round(d.activity.progress * 100)}%`) },
  { key: 'steps', metric: 'steps', label: 'Skridt', empty: 'Ingen data i dag', format: (d) => (d.steps == null ? null : formatSteps(d.steps)) },
  { key: 'cycle', metric: 'cycle_day', label: 'Cyklus', empty: 'Ingen data i dag', format: (d) => (d.cycle_day == null ? null : `Dag ${d.cycle_day}`) },
];

/**
 * Today's tiles in the order Søvn, Aktivitet, Skridt, Cyklus. A hidden metric has no tile at all; a missing value is a tile
 * with `value: null`. Cyklus is only a tile when there is a cycle value (or the owner has cycle data: `hasCycleLog`).
 */
export function todayTiles(day: DayView | null, hidden: readonly Metric[], isOwner: boolean, hasCycleLog = false): Tile[] {
  const d: DayView = day ?? { date: '', sources: {} };
  return tileDefs
    .filter((t) => !hidden.includes(t.metric))
    .filter((t) => t.key !== 'cycle' || t.format(d) !== null || (isOwner && hasCycleLog))
    .map((t) => ({ key: t.key, metric: t.metric, label: t.label, value: t.format(d), empty: t.empty }));
}

export interface Freshness {
  /** Today's view, or null when the newest data is from an earlier day (the tiles then show "Ingen data"). */
  day: DayView | null;
  stale: boolean;
  /** The newest date with any value, for "sidste data fra …". */
  newest: string | null;
}

export function freshness(days: readonly DayView[], today: string): Freshness {
  const valued = days.filter((d) => [d.sleep_score, d.activity, d.steps, d.cycle_day].some((v) => v != null));
  const newest = valued.at(-1)?.date ?? null;
  const stale = isStale(days, today);
  return { day: stale ? null : (days.find((d) => d.date === today) ?? null), stale, newest };
}

export type TrendMetric = 'sleep_score' | 'activity';
export interface TrendEntry {
  date: string;
  /** One-letter weekday: M T O T F L S. */
  letter: string;
  /** Full weekday for screen readers: "Fredag". */
  label: string;
  value: number | null;
  isToday: boolean;
}
export interface Trend {
  entries: TrendEntry[];
  average: number;
}

const dayLetters = ['S', 'M', 'T', 'O', 'T', 'F', 'L'];
const dayNames = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'];
const shift = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Seven entries ending today. Activity is percent of goal. Null when no day has a value (the chart is then not drawn). */
export function trend(days: readonly DayView[], today: string, metric: TrendMetric): Trend | null {
  const valueOf = (d: DayView | undefined): number | null => {
    if (!d) return null;
    if (metric === 'sleep_score') return d.sleep_score == null ? null : d.sleep_score;
    return d.activity == null ? null : Math.round(d.activity.progress * 100);
  };
  const entries = Array.from({ length: 7 }, (_, i): TrendEntry => {
    const date = shift(today, i - 6);
    const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
    return { date, letter: dayLetters[dow], label: dayNames[dow], value: valueOf(days.find((d) => d.date === date)), isToday: date === today };
  });
  const values = entries.flatMap((e) => (e.value === null ? [] : [e.value]));
  if (values.length === 0) return null;
  return { entries, average: Math.round(values.reduce((a, b) => a + b, 0) / values.length) };
}

/** Bar height in percent: 0 to 100, so a value above 100 % is a full bar (the number still says the real value). */
export const barHeight = (value: number): number => Math.min(100, Math.max(0, value));

/** "Oura · synk. 19.45"; two sources are joined with " · ". Null when nothing is connected. */
export function sourceLine(sources: readonly SourceStatus[], now: Date = new Date()): string | null {
  if (sources.length === 0) return null;
  return sources.map((s) => formatSync(s.source, s.lastSyncedAt, now)).join(' · ');
}

/** False when the owner hides every metric from the viewer: the panel then shows a calm note instead of empty tiles. */
export const viewerCanSee = (hidden: readonly Metric[]): boolean => !METRICS.every((m) => hidden.includes(m));

export interface DayCardRow {
  metric: Metric;
  label: string;
  /** The value, or the "Ingen data" copy when `missing`. */
  text: string;
  missing: boolean;
  /** Bar fill from 0 to 1 (Aktivitet with a value only). Clamped; `text` keeps the real percentage. */
  bar?: number;
}

export interface DayCard {
  rows: DayCardRow[];
  /** "Oura · synk. 19.45", or null when nothing is connected. Keeps the real sync time even when today's numbers are missing. */
  sync: string | null;
  /** Set instead of rows: `not-connected` when the person has no source, `not-shared` when the viewer may see no metric. */
  empty?: 'not-connected' | 'not-shared';
}

/**
 * One person's "Jeres dag" card on Hjem (idea 12). Rows are Søvn, Cyklus, Aktivitet in that order; steps are left out on Hjem.
 * A metric hidden from the viewer has no row. Data from an earlier day is never shown as today (`freshness`), so those rows
 * read "Ingen data". Cyklus is shown to the owner when there is any cycle data, and to the other person only when shared.
 */
export function dayCard(input: {
  days: readonly DayView[];
  today: string;
  hidden: readonly Metric[];
  sources: readonly SourceStatus[];
  /** True when the card is the signed-in person's own. */
  isOwner: boolean;
  now?: Date;
}): DayCard {
  const { days, today, hidden, sources, isOwner, now = new Date() } = input;
  if (sources.length === 0) return { rows: [], sync: null, empty: 'not-connected' };
  const visible = METRICS.filter((m) => m !== 'steps' && !hidden.includes(m));
  if (visible.length === 0) return { rows: [], sync: sourceLine(sources, now), empty: 'not-shared' };

  const { day } = freshness(days, today);
  const hasCycleLog = days.some((d) => d.cycle_day != null);
  const cardOrder: TileKey[] = ['sleep', 'cycle', 'activity'];
  const rows = todayTiles(day, hidden, isOwner, hasCycleLog)
    .filter((t) => cardOrder.includes(t.key))
    .sort((a, b) => cardOrder.indexOf(a.key) - cardOrder.indexOf(b.key))
    .map((t): DayCardRow => {
      const row: DayCardRow = { metric: t.metric, label: t.label, text: t.value ?? t.empty, missing: t.value === null };
      if (t.key === 'activity' && day?.activity) row.bar = barHeight(Math.round(day.activity.progress * 100)) / 100;
      return row;
    });
  return { rows, sync: sourceLine(sources, now) };
}
