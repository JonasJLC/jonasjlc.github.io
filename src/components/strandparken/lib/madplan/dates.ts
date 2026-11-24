// Calendar dates as `YYYY-MM-DD` strings. All "today" logic runs in Europe/Copenhagen (design D53), so both phones agree
// which week is "this week" at any hour. Arithmetic goes through UTC midnight, which has no daylight-saving gaps.

const timeZone = 'Europe/Copenhagen';
const todayFormat = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone });

export type IsoDate = string;

const toUtc = (iso: IsoDate) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUtc = (ms: number): IsoDate => new Date(ms).toISOString().slice(0, 10);

export const isIsoDate = (s: string): s is IsoDate => /^\d{4}-\d{2}-\d{2}$/.test(s) && fromUtc(toUtc(s)) === s;

/** Today's date in Copenhagen. */
export const todayIso = (now: Date = new Date()): IsoDate => todayFormat.format(now);

export const addDays = (iso: IsoDate, days: number): IsoDate => fromUtc(toUtc(iso) + days * 86_400_000);

/** 0 = Monday … 6 = Sunday. */
const weekdayIndex = (iso: IsoDate) => (new Date(toUtc(iso)).getUTCDay() + 6) % 7;

export const mondayOf = (iso: IsoDate): IsoDate => addDays(iso, -weekdayIndex(iso));

export const weekDays = (monday: IsoDate): IsoDate[] => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

/** ISO 8601 week number: the week with the year's first Thursday is week 1. */
export function isoWeek(iso: IsoDate): number {
  const thursday = addDays(mondayOf(iso), 3);
  const jan1 = `${thursday.slice(0, 4)}-01-01`;
  return Math.floor((toUtc(thursday) - toUtc(jan1)) / (7 * 86_400_000)) + 1;
}

const weekdayNames = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
const longNames = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag'];
const monthNames = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'];

export const weekdayShort = (iso: IsoDate) => weekdayNames[weekdayIndex(iso)];
/** "fredag" (lower case, as in "Flyttet til fredag"). */
export const weekdayLong = (iso: IsoDate) => longNames[weekdayIndex(iso)];
export const dayOfMonth =(iso: IsoDate) => Number(iso.slice(8, 10));
/** "mandag 9. november". */
export const longDate = (iso: IsoDate) => `${longNames[weekdayIndex(iso)]} ${dayOfMonth(iso)}. ${monthNames[Number(iso.slice(5, 7)) - 1]}`;
