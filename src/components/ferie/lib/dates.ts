/** All dates are UTC-midnight timestamps so day arithmetic never hits DST. */
export const DAY = 864e5;

export const MONTHS = [
  'januar', 'februar', 'marts', 'april', 'maj', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'december',
];
export const MONTHS_SHORT = [
  'jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.',
];
export const WEEKDAYS = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];

export const toTime = (s: string): number => {
  if (!s) return NaN;
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

export const toISO = (t: number): string => new Date(t).toISOString().slice(0, 10);

export const todayTime = (): number => {
  const n = new Date();
  return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
};

export const isWeekend = (t: number): boolean => {
  const w = new Date(t).getUTCDay();
  return w === 0 || w === 6;
};

/** ISO-8601 week number. */
export function isoWeek(t: number): number {
  const day = (new Date(t).getUTCDay() + 6) % 7;
  const thursday = t - day * DAY + 3 * DAY;
  const y = new Date(thursday).getUTCFullYear();
  const jan4 = Date.UTC(y, 0, 4);
  const firstThursday = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * DAY + 3 * DAY;
  return 1 + Math.round((thursday - firstThursday) / (7 * DAY));
}

export function fmtShort(t: number, withYear = false): string {
  const d = new Date(t);
  return `${d.getUTCDate()}. ${MONTHS_SHORT[d.getUTCMonth()]}${withYear ? ` ${d.getUTCFullYear()}` : ''}`;
}

export function fmtLong(t: number): string {
  const d = new Date(t);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function fmtRange(a: number, b: number, year: number): string {
  const A = new Date(a);
  const B = new Date(b);
  const showYear = A.getUTCFullYear() !== year || B.getUTCFullYear() !== year;
  if (a === b) return fmtShort(a, showYear);
  if (A.getUTCMonth() === B.getUTCMonth() && A.getUTCFullYear() === B.getUTCFullYear()) {
    return `${A.getUTCDate()}.–${fmtShort(b, showYear)}`;
  }
  const crossYear = A.getUTCFullYear() !== B.getUTCFullYear();
  return `${fmtShort(a, showYear && crossYear)}–${fmtShort(b, showYear)}`;
}

/** Danish number format, at most two decimals, no "-0". */
export const fmtN = (v: number): string => {
  const r = Math.round(v * 100) / 100;
  return (Object.is(r, -0) ? 0 : r).toLocaleString('da-DK', { maximumFractionDigits: 2 });
};
