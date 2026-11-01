import { DAY, isWeekend } from './dates';
import type { DayOff } from './types';

/** Easter Sunday (UTC midnight), anonymous Gregorian algorithm. */
export function easter(y: number): number {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(y, month - 1, day);
}

/** Days off that are not public holidays but common in Danish contracts. */
export const DAYS_OFF: { md: DayOff; name: string }[] = [
  { md: '05-01', name: '1. maj' },
  { md: '06-05', name: 'Grundlovsdag' },
  { md: '12-24', name: 'Juleaftensdag' },
  { md: '12-31', name: 'Nytårsaftensdag' },
];

/** What the old shared "ekstra fridage" switch covered. */
export const LEGACY_DAYS_OFF: DayOff[] = ['06-05', '12-24', '12-31'];

const cache = new Map<number, Map<number, string>>();

/** The official Danish public holidays (helligdage) of a year. */
export function holidays(year: number): Map<number, string> {
  const hit = cache.get(year);
  if (hit) return hit;
  const m = new Map<number, string>();
  const E = easter(year);
  m.set(Date.UTC(year, 0, 1), 'Nytårsdag');
  m.set(E - 3 * DAY, 'Skærtorsdag');
  m.set(E - 2 * DAY, 'Langfredag');
  m.set(E, 'Påskedag');
  m.set(E + DAY, '2. påskedag');
  if (year < 2024) m.set(E + 26 * DAY, 'Store bededag');
  m.set(E + 39 * DAY, 'Kristi himmelfartsdag');
  m.set(E + 49 * DAY, 'Pinsedag');
  m.set(E + 50 * DAY, '2. pinsedag');
  m.set(Date.UTC(year, 11, 25), 'Juledag');
  m.set(Date.UTC(year, 11, 26), '2. juledag');
  cache.set(year, m);
  return m;
}

const mdOf = (t: number): string => new Date(t).toISOString().slice(5, 10);

/** Name of the day off on `t` if it is one of `off`. */
export const dayOffName = (t: number, off: readonly DayOff[]): string | undefined => {
  const md = mdOf(t);
  return off.includes(md as DayOff) ? DAYS_OFF.find((d) => d.md === md)?.name : undefined;
};

/**
 * Public holiday or day-off name on `t`. `off` is the list of extra days off; `true` is
 * the legacy shared switch and means Grundlovsdag, juleaften and nytårsaftensdag.
 */
export function holidayName(t: number, off: readonly DayOff[] | boolean = []): string | undefined {
  const list = off === true ? LEGACY_DAYS_OFF : off === false ? [] : off;
  return holidays(new Date(t).getUTCFullYear()).get(t) ?? dayOffName(t, list);
}

/** A day that costs a vacation day when taken off. */
export const isWorkDay = (t: number, off: readonly DayOff[]): boolean =>
  !isWeekend(t) && !holidayName(t, off);

export function countWorkDays(a: number, b: number, off: readonly DayOff[]): number {
  let n = 0;
  for (let t = a; t <= b; t += DAY) if (isWorkDay(t, off)) n++;
  return n;
}

/** The date of the n-th work day counting `start` as day one. */
export function addWorkDays(start: number, n: number, off: readonly DayOff[]): number {
  const need = Math.max(1, Math.ceil(n));
  let t = start;
  let count = 0;
  for (let i = 0; i < 500; i++) {
    if (isWorkDay(t, off)) {
      count++;
      if (count >= need) return t;
    }
    t += DAY;
  }
  return t;
}
