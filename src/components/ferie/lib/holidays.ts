import { DAY, isWeekend } from './dates';

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

const cache = new Map<string, Map<number, string>>();

/** Danish public holidays; `extraOff` adds Grundlovsdag, juleaften and nytårsaftensdag. */
export function holidays(year: number, extraOff: boolean): Map<number, string> {
  const key = `${year}:${extraOff}`;
  const hit = cache.get(key);
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
  if (extraOff) {
    m.set(Date.UTC(year, 5, 5), 'Grundlovsdag');
    m.set(Date.UTC(year, 11, 24), 'Juleaften');
    m.set(Date.UTC(year, 11, 31), 'Nytårsaftensdag');
  }
  cache.set(key, m);
  return m;
}

export const holidayName = (t: number, extraOff: boolean): string | undefined =>
  holidays(new Date(t).getUTCFullYear(), extraOff).get(t);

/** A day that costs a vacation day when taken off. */
export const isWorkDay = (t: number, extraOff: boolean): boolean =>
  !isWeekend(t) && !holidayName(t, extraOff);

export function countWorkDays(a: number, b: number, extraOff: boolean): number {
  let n = 0;
  for (let t = a; t <= b; t += DAY) if (isWorkDay(t, extraOff)) n++;
  return n;
}

/** The date of the n-th work day counting `start` as day one. */
export function addWorkDays(start: number, n: number, extraOff: boolean): number {
  const need = Math.max(1, Math.ceil(n));
  let t = start;
  let count = 0;
  for (let i = 0; i < 500; i++) {
    if (isWorkDay(t, extraOff)) {
      count++;
      if (count >= need) return t;
    }
    t += DAY;
  }
  return t;
}
