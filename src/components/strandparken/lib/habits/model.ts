// Habits (idea 15): types and all the counting. Pure code, tested in tests/strandparken-habits.test.ts. Weeks are ISO weeks
// (Monday first) in Europe/Copenhagen, and dates are `YYYY-MM-DD` strings (lib/madplan/dates.ts), so daylight saving and the
// new year need no special handling. Tone: weekly progress, never a streak that resets; a missed day is just an empty dot.
import { addDays, mondayOf, todayIso, weekdayShort, weekDays, type IsoDate } from '../madplan/dates.ts';
import { isRule, type Rule } from './rules.ts';

export type Owner = 'a' | 'b' | 'both';
export type Tracking = 'manual' | 'automatic';
export type Source = 'manual' | 'automatic';
export type Frequency =
  | { kind: 'daily' }
  | { kind: 'per_week'; count: number }
  /** ISO weekdays, 1 = Monday … 7 = Sunday. */
  | { kind: 'weekdays'; days: number[] };

export const habitColorNames = ['sage', 'moss', 'sky', 'lavender', 'plum', 'rose', 'clay', 'sand'] as const;
export type HabitColor = (typeof habitColorNames)[number];

/** Literal class names, so Tailwind can see them (like `people` in lib/people.ts). `fill` is the dot and filled check; `border` the check outline. */
export const habitColors: Record<HabitColor, { fill: string; border: string; text: string; tint: string; ink: string }> = {
  sage: { fill: 'bg-sp-habit-sage', border: 'border-sp-habit-sage', text: 'text-sp-habit-sage', tint: 'bg-sp-habit-sage-tint', ink: 'text-sp-habit-sage-ink' },
  moss: { fill: 'bg-sp-habit-moss', border: 'border-sp-habit-moss', text: 'text-sp-habit-moss', tint: 'bg-sp-habit-moss-tint', ink: 'text-sp-habit-moss-ink' },
  sky: { fill: 'bg-sp-habit-sky', border: 'border-sp-habit-sky', text: 'text-sp-habit-sky', tint: 'bg-sp-habit-sky-tint', ink: 'text-sp-habit-sky-ink' },
  lavender: { fill: 'bg-sp-habit-lavender', border: 'border-sp-habit-lavender', text: 'text-sp-habit-lavender', tint: 'bg-sp-habit-lavender-tint', ink: 'text-sp-habit-lavender-ink' },
  plum: { fill: 'bg-sp-habit-plum', border: 'border-sp-habit-plum', text: 'text-sp-habit-plum', tint: 'bg-sp-habit-plum-tint', ink: 'text-sp-habit-plum-ink' },
  rose: { fill: 'bg-sp-habit-rose', border: 'border-sp-habit-rose', text: 'text-sp-habit-rose', tint: 'bg-sp-habit-rose-tint', ink: 'text-sp-habit-rose-ink' },
  clay: { fill: 'bg-sp-habit-clay', border: 'border-sp-habit-clay', text: 'text-sp-habit-clay', tint: 'bg-sp-habit-clay-tint', ink: 'text-sp-habit-clay-ink' },
  sand: { fill: 'bg-sp-habit-sand', border: 'border-sp-habit-sand', text: 'text-sp-habit-sand', tint: 'bg-sp-habit-sand-tint', ink: 'text-sp-habit-sand-ink' },
};

export interface Habit {
  id: string;
  owner: Owner;
  title: string;
  tracking: Tracking;
  frequency: Frequency;
  rule: Rule | null;
  color: HabitColor;
  icon: string | null;
  /** `HH:MM`. Stored and shown only (roadmap Q5). */
  reminderTime: string | null;
  archivedAt: string | null;
  createdAt: string;
}

export interface Completion {
  habitId: string;
  date: IsoDate;
  completedBy: 'a' | 'b';
  source: Source;
}

/** What the create and edit sheet holds: a habit before it has an id, audit columns or an archive state. */
export type HabitDraft = Pick<Habit, 'owner' | 'title' | 'tracking' | 'frequency' | 'rule' | 'color' | 'icon' | 'reminderTime'>;

export interface WeekProgress {
  /** Completions this week, capped at `target` (the text never says "8 af 7"). */
  done: number;
  target: number;
  /** The true number of days completed this week. */
  count: number;
  /** `target` dots, filled from the left by completions. */
  dots: boolean[];
}

// ---- week logic ----

const uniqueDays = (days: number[]) => [...new Set(days)];

/** Completions needed in a week. A habit created mid-week still targets the whole week. */
export function weekTarget(h: Habit): number {
  const f = h.frequency;
  return f.kind === 'daily' ? 7 : f.kind === 'per_week' ? f.count : uniqueDays(f.days).length;
}

/** 1 = Monday … 7 = Sunday. */
const isoWeekday = (date: IsoDate) => {
  const [y, m, d] = date.split('-').map(Number);
  return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1;
};

/** Daily: every day. Weekdays: those days. Per week: never due on a given day, it only counts when done. */
export function isDueOn(h: Habit, date: IsoDate): boolean {
  const f = h.frequency;
  return f.kind === 'daily' || (f.kind === 'weekdays' && f.days.includes(isoWeekday(date)));
}

const dayKey = (habitId: string, date: IsoDate) => `${habitId}|${date}`;
const doneSet = (cs: Completion[]) => new Set(cs.map((c) => dayKey(c.habitId, c.date)));

/** Days (not rows) completed in the week starting at `monday`. */
function weekCount(h: Habit, cs: Completion[], monday: IsoDate): number {
  const days = new Set(weekDays(monday));
  const seen = new Set<IsoDate>();
  for (const c of cs) if (c.habitId === h.id && days.has(c.date)) seen.add(c.date);
  return seen.size;
}

export function weekProgress(h: Habit, cs: Completion[], monday: IsoDate): WeekProgress {
  const target = weekTarget(h);
  const count = weekCount(h, cs, monday);
  const done = Math.min(count, target);
  return { done, target, count, dots: Array.from({ length: target }, (_, i) => i < done) };
}

// ---- text ----

const thousands = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Today's value of an automatic habit's metric for the card. `visible` is false when the owner has hidden that metric from the viewer. */
export type TodayValue = { value: number | null; visible: boolean };

function valueText(h: Habit, v: TodayValue | null): string | null {
  if (!h.rule || !v || !v.visible || v.value === null || !Number.isFinite(v.value)) return null;
  switch (h.rule.metric) {
    case 'sleep_score': return `${thousands(v.value)} i nat`;
    case 'steps': return `${thousands(v.value)} i dag`;
    case 'activity_progress': return `${Math.floor(v.value * 100)} % i dag`;
  }
}

const frequencyText = (f: Frequency): string => {
  if (f.kind === 'daily') return 'Hver dag';
  if (f.kind === 'per_week') return f.count === 1 ? '1 gang om ugen' : `${f.count} gange om ugen`;
  const monday = '2026-11-23'; // any Monday: only the weekday names are used
  return uniqueDays(f.days).sort((a, b) => a - b)
    .map((d, i) => (i === 0 ? weekdayShort(addDays(monday, d - 1)) : weekdayShort(addDays(monday, d - 1)).toLowerCase()))
    .join(', ');
};

/** The card's detail line: "Hver dag · 3 af 7 denne uge", "82 i nat · 5 af 7 denne uge", "Automatisk · 2 af 5 denne uge". */
export function detailLine(h: Habit, p: Pick<WeekProgress, 'done' | 'target'>, today: TodayValue | null): string {
  const progress = `${p.done} af ${p.target} denne uge`;
  if (h.tracking === 'automatic') return `${valueText(h, today) ?? 'Automatisk'} · ${progress}`;
  return `${frequencyText(h.frequency)} · ${progress}`;
}

// ---- counts ----

const isActive = (h: Habit) => h.archivedAt === null;
const createdOn = (h: Habit): IsoDate => todayIso(new Date(h.createdAt));

/**
 * "2 af 6 i dag" for the habits `filter` accepts. The total is the habits due today plus per-week habits that are not yet
 * at their target this week (or were completed today); done is those completed today. Archived habits are left out.
 */
export function todayCount(habits: Habit[], cs: Completion[], today: IsoDate, filter: (h: Habit) => boolean): { done: number; total: number } {
  const marks = doneSet(cs);
  const monday = mondayOf(today);
  let done = 0;
  let total = 0;
  for (const h of habits) {
    if (!isActive(h) || !filter(h)) continue;
    const doneToday = marks.has(dayKey(h.id, today));
    const counts = isDueOn(h, today) || doneToday || (h.frequency.kind === 'per_week' && weekCount(h, cs, monday) < weekTarget(h));
    if (!counts) continue;
    total++;
    if (doneToday) done++;
  }
  return { done, total };
}

/**
 * The fill of one weekday ring, 0 to 1: completed over due. Per-week habits (and anything ticked on a day it was not due)
 * add to both sides only when completed that day. Days before a habit was created are not counted. No habits due, or a
 * future day, gives `null`: an empty ring, never red.
 */
export function dayRing(habits: Habit[], cs: Completion[], date: IsoDate, today: IsoDate): number | null {
  const c = dayCounts(habits, cs, date, today);
  return c === null ? null : c.done / c.total;
}

/** The numbers behind `dayRing` ("2 af 4 vaner" for screen readers); `null` when nothing was due or the day is in the future. */
export function dayCounts(habits: Habit[], cs: Completion[], date: IsoDate, today: IsoDate): { done: number; total: number } | null {
  if (date > today) return null;
  const marks = doneSet(cs);
  let done = 0;
  let total = 0;
  for (const h of habits) {
    if (!isActive(h) || createdOn(h) > date) continue;
    const completed = marks.has(dayKey(h.id, date));
    if (!isDueOn(h, date) && !completed) continue;
    total++;
    if (completed) done++;
  }
  return total === 0 ? null : { done, total };
}

/**
 * Consecutive full weeks with the target met, ending last week, plus this week once it is met. Never looks before the week
 * the habit was created. There is no lost state: it is 0 or more, and the UI shows nothing below 2 (roadmap Q4).
 */
export function weeksInARow(h: Habit, cs: Completion[], today: IsoDate): number {
  const target = weekTarget(h);
  const first = mondayOf(createdOn(h));
  const met = (monday: IsoDate) => weekCount(h, cs, monday) >= target;
  const thisWeek = mondayOf(today);
  let streak = met(thisWeek) ? 1 : 0;
  for (let monday = addDays(thisWeek, -7), i = 0; monday >= first && i < 520 && met(monday); monday = addDays(monday, -7), i++) streak++;
  return streak;
}

/** Who completed a (shared) habit on a date, for "· Jonas" on the card. */
export function doneBy(h: Habit, cs: Completion[], date: IsoDate): 'a' | 'b' | null {
  return cs.find((c) => c.habitId === h.id && c.date === date)?.completedBy ?? null;
}

// ---- validation ----

export type DraftErrors = Partial<Record<'title' | 'frequency' | 'rule' | 'owner' | 'reminderTime' | 'icon' | 'color', string>>;

export function validateHabitDraft(d: HabitDraft): { ok: boolean; errors: DraftErrors } {
  const errors: DraftErrors = {};
  const title = d.title.trim();
  if (title.length === 0) errors.title = 'Skriv et navn.';
  else if ([...title].length > 80) errors.title = 'Navnet er for langt (højst 80 tegn).';

  const f = d.frequency;
  if (f.kind === 'per_week' && !(Number.isInteger(f.count) && f.count >= 1 && f.count <= 7)) errors.frequency = 'Vælg 1 til 7 dage om ugen.';
  if (f.kind === 'weekdays' && (f.days.length === 0 || !f.days.every((x) => Number.isInteger(x) && x >= 1 && x <= 7))) {
    errors.frequency = 'Vælg mindst én dag.';
  }

  if (d.tracking === 'automatic') {
    if (!d.rule || !isRule(d.rule) || d.rule.threshold < 0) errors.rule = 'Vælg hvad der udfylder vanen.';
    if (d.owner === 'both') errors.owner = 'Automatiske vaner er personlige.';
  } else if (d.rule !== null) {
    errors.rule = 'En vane du krydser af har ingen regel.';
  }

  if (d.reminderTime !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.reminderTime)) errors.reminderTime = 'Skriv tid som TT:MM.';
  if (d.icon !== null && [...d.icon].length > 16) errors.icon = 'Ikonet er for langt.';
  if (!habitColorNames.includes(d.color)) errors.color = 'Vælg en farve.';
  return { ok: Object.keys(errors).length === 0, errors };
}

// ---- database rows ----

/** The shape of a `sp_habits` row. Structural, so the generated `Row` type is assignable to it. */
export interface HabitRow {
  id: string;
  household_id: string;
  owner: string;
  title: string;
  tracking: string;
  frequency: string;
  per_week_count: number | null;
  weekdays: number[] | null;
  reminder_time: string | null;
  color: string;
  icon: string | null;
  rule: unknown;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface CompletionRow {
  id: string;
  household_id: string;
  habit_id: string;
  date: string;
  completed_by: string;
  source: string;
  created_at: string;
}

const asOwner = (o: string): Owner => (o === 'a' || o === 'b' ? o : 'both');

export function habitFromRow(r: HabitRow): Habit {
  const frequency: Frequency = r.frequency === 'per_week'
    ? { kind: 'per_week', count: r.per_week_count ?? 1 }
    : r.frequency === 'weekdays'
      ? { kind: 'weekdays', days: uniqueDays(r.weekdays ?? []).sort((a, b) => a - b) }
      : { kind: 'daily' };
  return {
    id: r.id,
    owner: asOwner(r.owner),
    title: r.title,
    tracking: r.tracking === 'automatic' ? 'automatic' : 'manual',
    frequency,
    rule: isRule(r.rule) ? { metric: r.rule.metric, op: r.rule.op, threshold: r.rule.threshold } : null,
    color: habitColorNames.find((c) => c === r.color) ?? 'sage',
    icon: r.icon,
    reminderTime: r.reminder_time ? r.reminder_time.slice(0, 5) : null,
    archivedAt: r.archived_at,
    createdAt: r.created_at,
  };
}

export const completionFromRow = (r: CompletionRow): Completion => ({
  habitId: r.habit_id,
  date: r.date,
  completedBy: r.completed_by === 'a' ? 'a' : 'b',
  source: r.source === 'automatic' ? 'automatic' : 'manual',
});

/** The columns to write for a draft. The id is only sent when given (a new habit gets one from the phone or the database). */
export function habitToRow(householdId: string, d: HabitDraft & { id?: string }) {
  const f = d.frequency;
  return {
    ...(d.id ? { id: d.id } : {}),
    household_id: householdId,
    owner: d.owner,
    title: d.title.trim(),
    tracking: d.tracking,
    frequency: f.kind,
    per_week_count: f.kind === 'per_week' ? f.count : null,
    weekdays: f.kind === 'weekdays' ? uniqueDays(f.days).sort((a, b) => a - b) : null,
    reminder_time: d.reminderTime,
    color: d.color,
    icon: d.icon,
    rule: d.tracking === 'automatic' ? d.rule : null,
  };
}
