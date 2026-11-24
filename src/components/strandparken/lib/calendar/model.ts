// Hjem's calendar card (Idé 7): which event is next today, what tomorrow holds, the time labels, and where a tap goes.
// Pure, so it can be tested without React. All days are Copenhagen days (design D53).
import { addDays, dayOfMonth, todayIso, weekdayLong, type IsoDate } from '../madplan/dates.ts';

export const calColors = ['cal-1', 'cal-2', 'cal-3', 'cal-4', 'cal-5', 'cal-6'] as const;
export type CalColor = (typeof calColors)[number];

/** Literal class names, so Tailwind can see them. */
export const calClasses: Record<CalColor, { bar: string; tint: string; ink: string; name: string }> = {
  'cal-1': { bar: 'bg-sp-cal-1', tint: 'bg-sp-cal-1-tint', ink: 'text-sp-cal-1-ink', name: 'Grøn' },
  'cal-2': { bar: 'bg-sp-cal-2', tint: 'bg-sp-cal-2-tint', ink: 'text-sp-cal-2-ink', name: 'Blå' },
  'cal-3': { bar: 'bg-sp-cal-3', tint: 'bg-sp-cal-3-tint', ink: 'text-sp-cal-3-ink', name: 'Orange' },
  'cal-4': { bar: 'bg-sp-cal-4', tint: 'bg-sp-cal-4-tint', ink: 'text-sp-cal-4-ink', name: 'Lilla' },
  'cal-5': { bar: 'bg-sp-cal-5', tint: 'bg-sp-cal-5-tint', ink: 'text-sp-cal-5-ink', name: 'Gul' },
  'cal-6': { bar: 'bg-sp-cal-6', tint: 'bg-sp-cal-6-tint', ink: 'text-sp-cal-6-ink', name: 'Petrol' },
};
export const colorOf = (c: string): (typeof calClasses)[CalColor] => calClasses[(calColors as readonly string[]).includes(c) ? (c as CalColor) : 'cal-1'];

/** One event as the `calendar` function returns it. All-day events use dates (`end` exclusive); timed events use instants. */
export interface CalEvent {
  sourceId: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  color: string;
  shared: boolean;
  mine: boolean;
  stale: boolean;
}

export interface EventsResult {
  today: IsoDate;
  events: CalEvent[];
  sources: { id: string; stale: boolean; updatedAt: string | null }[];
}

/** A row of `sp_calendar_sources`: the owner sees all of theirs, the other person only the shared ones. */
export interface CalendarSource {
  id: string;
  household_id: string;
  person: string;
  label: string;
  color: string;
  shared: boolean;
  enabled: boolean;
  position: number;
  last_fetched_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

const timeZone = 'Europe/Copenhagen';
const clockFormat = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** "09.30": the Copenhagen wall clock, with the Danish dot. */
export const clock = (iso: string) => clockFormat.format(new Date(iso)).replace(':', '.');

/** The Copenhagen date of an instant. */
export const localDate = (iso: string): IsoDate => todayIso(new Date(iso));

/** True when the event touches that Copenhagen day. An event ending exactly at midnight does not touch the next day. */
export function covers(e: CalEvent, day: IsoDate): boolean {
  if (e.allDay) return e.start <= day && day < e.end;
  const s = localDate(e.start);
  const en = localDate(e.end);
  if (s > day || en < day) return false;
  if (en > day) return true;
  return s === day || clock(e.end) !== '00.00';
}

const startMs = (e: CalEvent) => (e.allDay ? 0 : Date.parse(e.start));
const byStart = (a: CalEvent, b: CalEvent) => Number(b.allDay) - Number(a.allDay) || startMs(a) - startMs(b);

/** The first timed event of today that has not ended; else today's first all-day event; else null ("Ingen flere i dag"). */
export function nextToday(events: readonly CalEvent[], now: Date): CalEvent | null {
  const today = todayIso(now);
  const timed = events.filter((e) => !e.allDay && covers(e, today) && Date.parse(e.end) > now.getTime()).sort(byStart);
  if (timed.length) return timed[0];
  return events.find((e) => e.allDay && covers(e, today)) ?? null;
}

/** Tomorrow's events, all-day first, then by start: the first two and how many more ("+ N mere"). */
export function tomorrow(events: readonly CalEvent[], today: IsoDate): { shown: CalEvent[]; more: number } {
  const day = addDays(today, 1);
  const all = events.filter((e) => covers(e, day)).sort(byStart);
  return { shown: all.slice(0, 2), more: Math.max(0, all.length - 2) };
}

/** "09.30 – 10.00", or "Hele dagen". */
export function timeRange(e: CalEvent): string {
  if (e.allDay) return 'Hele dagen';
  const a = clock(e.start);
  const b = clock(e.end);
  return a === b && e.start === e.end ? a : `${a} – ${b}`;
}

/** The visible title: " · fælles" after a shared calendar's events. */
export const label = (e: CalEvent) => (e.shared ? `${e.title} · fælles` : e.title);

const spoken = (e: CalEvent) =>
  `${e.title}${e.shared ? ' fælles' : ''} ${e.allDay ? 'hele dagen' : timeRange(e).replace(' – ', ' til ')}`;

/** The card's accessible name: "Kalender: torsdag 19. Ingen flere i dag. I morgen: Tandlæge 09.30 til 10.00, Bio fælles 18.00 til 22.00." */
export function summary(events: readonly CalEvent[], now: Date): string {
  const today = todayIso(now);
  const next = nextToday(events, now);
  const t = tomorrow(events, today);
  const tomorrowText = t.shown.length
    ? `I morgen: ${t.shown.map(spoken).join(', ')}${t.more ? ` og ${t.more} mere` : ''}.`
    : 'Intet i morgen.';
  return `Kalender: ${weekdayLong(today)} ${dayOfMonth(today)}. ${next ? `I dag: ${spoken(next)}.` : 'Ingen flere i dag.'} ${tomorrowText}`;
}

/** iPhone, iPod, iPad, and iPadOS that reports itself as a Mac but has touch. */
export const isIos = (ua: string, maxTouchPoints = 0) => /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);

const wall = new Intl.DateTimeFormat('en-US', {
  timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});
function offsetAt(ms: number) {
  const p = Object.fromEntries(wall.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - ms;
}
/** The instant of 00:00 in Copenhagen on that date. */
export function copenhagenMidnight(iso: IsoDate): number {
  const guess = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  return guess - offsetAt(guess - offsetAt(guess));
}

/** Seconds from 2001-01-01T00:00:00Z (Apple's reference date) to that date's midnight in Copenhagen: `calshow:` takes these. */
export const calshowSeconds = (iso: IsoDate) => (copenhagenMidnight(iso) - Date.UTC(2001, 0, 1)) / 1000;

/** The phone's own Calendar app at that day on iOS; Google Calendar's day view anywhere else. */
export function dayLink(iso: IsoDate, ua: string, maxTouchPoints = 0): string {
  if (isIos(ua, maxTouchPoints)) return `calshow:${calshowSeconds(iso)}`;
  return `https://calendar.google.com/calendar/r/day/${iso.slice(0, 4)}/${iso.slice(5, 7)}/${iso.slice(8, 10)}`;
}

/** "opdateret 14.05" today, "opdateret 24/11" on an earlier day. */
export function updatedLabel(iso: string, now: Date): string {
  const d = localDate(iso);
  return d === todayIso(now) ? `opdateret ${clock(iso)}` : `opdateret ${dayOfMonth(d)}/${Number(d.slice(5, 7))}`;
}

/** Danish copy for the error codes of `calendar` add, and for a calendar's last fetch error. */
export function calendarErrorMessage(code: string | null | undefined): string {
  switch (code) {
    case 'fetch_failed': return 'Kalenderen kunne ikke hentes. Tjek adressen.';
    case 'not_calendar': return 'Adressen er ikke en kalender (iCal).';
    case 'parse_failed': return 'Kalenderen kunne ikke læses.';
    case 'bad_url': return 'Adressen skal starte med https:// eller webcal://.';
    case 'blocked': return 'Appen må ikke hente fra den adresse.';
    case 'too_large': return 'Kalenderen er for stor til at hente.';
    case 'too_many': return 'Du kan højst have 10 kalendere.';
    case 'not_configured': return 'Kalendere er ikke slået til på serveren endnu.';
    default: return 'Kalenderen kunne ikke tilføjes. Prøv igen.';
  }
}

/** Sources from the database: own first, then the other person's shared ones, each by position. */
export function splitSources(rows: readonly CalendarSource[], personKey: 'a' | 'b') {
  const sorted = [...rows].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
  return { mine: sorted.filter((r) => r.person === personKey), theirs: sorted.filter((r) => r.person !== personKey && r.shared) };
}
