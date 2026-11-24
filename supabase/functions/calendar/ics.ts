// iCal parsing for the calendar widget (Idé 7). Only today and tomorrow in Europe/Copenhagen (design D53) are expanded:
// an edge function has a small CPU budget, and a Google feed can hold years of history. ical.js (Mozilla's parser) does
// RRULE, EXDATE, RECURRENCE-ID overrides and VTIMEZONE, which these feeds all use.
import ICAL from 'npm:ical.js@2.2.1';

export const ZONE = 'Europe/Copenhagen';
export const MAX_TITLE = 120;
/** Occurrences visited per recurring event before giving up: a daily event over 10 years is about 3650. */
const MAX_OCCURRENCES = 5000;
const DAY_MS = 86_400_000;

/** One occurrence inside the window. All-day events use dates (`end` exclusive); timed events use UTC instants. */
export interface FeedEvent {
  uid: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
}

export interface CalendarWindow {
  /** First day, `YYYY-MM-DD`. */
  from: string;
  /** The day after the last day (exclusive). */
  to: string;
  startMs: number;
  endMs: number;
}

const formats = new Map<string, Intl.DateTimeFormat>();
function format(zone: string) {
  let f = formats.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    formats.set(zone, f);
  }
  return f;
}

function wallClock(ms: number, zone: string) {
  const p = Object.fromEntries(format(zone).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second };
}

/** The UTC instant of a wall-clock time in `zone`. Throws a RangeError for an unknown zone. */
export function zonedToEpoch(y: number, mo: number, d: number, h: number, mi: number, s: number, zone: string): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const offset = (ms: number) => {
    const w = wallClock(ms, zone);
    return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s) - Math.floor(ms / 1000) * 1000;
  };
  const first = guess - offset(guess);
  return guess - offset(first);
}

/** Today's date in Copenhagen, `YYYY-MM-DD`. */
export function copenhagenDate(now: Date): string {
  const w = wallClock(now.getTime(), ZONE);
  return `${w.y}-${String(w.mo).padStart(2, '0')}-${String(w.d).padStart(2, '0')}`;
}

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const midnight = (iso: string) => zonedToEpoch(+iso.slice(0, 4), +iso.slice(5, 7), +iso.slice(8, 10), 0, 0, 0, ZONE);

/** `[today 00:00, today + days 00:00)` in Copenhagen. */
export function windowFor(today: string, days = 2): CalendarWindow {
  const to = addDays(today, days);
  return { from: today, to, startMs: midnight(today), endMs: midnight(to) };
}

/** Unfolds lines and drops VEVENT blocks that cannot reach the window: no RRULE/RDATE and every date before `from` − 1 day. */
export function prefilter(text: string, from: string): string {
  const cutoff = addDays(from, -1).replaceAll('-', '');
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  return unfolded.replace(/BEGIN:VEVENT[\s\S]*?END:VEVENT\r?\n?/g, (block) => {
    if (/^(RRULE|RDATE)[:;]/m.test(block)) return block;
    const dates = [...block.matchAll(/^(?:DTSTART|DTEND|RECURRENCE-ID)[^:\r\n]*:(\d{8})/gm)].map((m) => m[1]);
    if (dates.length === 0) return block;
    // A DURATION without DTEND can run past its start date; give it a week.
    const slack = /^DURATION[:;]/m.test(block) && !/^DTEND[:;]/m.test(block) ? addDays(from, -8).replaceAll('-', '') : cutoff;
    return dates.some((d) => d >= slack) ? block : '';
  });
}

const isZone = (zone: string) => {
  try { format(zone); return true; } catch { return false; }
};

type Time = InstanceType<typeof ICAL.Time>;
type Event = InstanceType<typeof ICAL.Event>;

/** A timed value as a UTC instant. Floating times, and zones the feed names but does not define, fall back to the IANA name or Copenhagen. */
function instant(t: Time, tzid: string | null): number {
  const zone = t.zone as { tzid?: string } | undefined;
  if (zone && zone.tzid && zone.tzid !== 'floating') return t.toUnixTime() * 1000;
  return zonedToEpoch(t.year, t.month, t.day, t.hour, t.minute, t.second, tzid && isZone(tzid) ? tzid : ZONE);
}

/** `YYYYMMDD` as a number, from the wall-clock date. */
const wallKey = (t: Time) => t.year * 10_000 + t.month * 100 + t.day;

const dateOf = (t: Time) => `${String(t.year).padStart(4, '0')}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`;

function occurrence(item: Event, start: Time, end: Time | null, win: CalendarWindow, uid: string): FeedEvent | null {
  if (String(item.component.getFirstPropertyValue('status') ?? '').toUpperCase() === 'CANCELLED') return null;
  const title = String(item.summary ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE) || 'Optaget';
  if (start.isDate) {
    const s = dateOf(start);
    let e = end ? dateOf(end) : addDays(s, 1);
    if (e <= s) e = addDays(s, 1);
    return s < win.to && e > win.from ? { uid, title, start: s, end: e, allDay: true } : null;
  }
  const tzid = (item.component.getFirstProperty('dtstart')?.getParameter('tzid') as string | undefined) ?? null;
  const s = instant(start, tzid);
  let e = end ? instant(end, tzid) : s;
  if (e < s) e = s;
  const inside = s < win.endMs && (e > win.startMs || (e === s && s >= win.startMs));
  return inside ? { uid, title, start: new Date(s).toISOString(), end: new Date(e).toISOString(), allDay: false } : null;
}

/**
 * A later start for a long DAILY or WEEKLY series without COUNT: the original start moved forward by whole periods to
 * about six weeks before the window. The pattern, the wall-clock time and the weekday stay the same, and EXDATE and
 * RECURRENCE-ID are absolute, so the occurrences in the window do not change; years of history are simply not walked.
 */
function fastStart(comp: InstanceType<typeof ICAL.Component>, start: Time, win: CalendarWindow): Time | undefined {
  const rules = comp.getAllProperties('rrule');
  if (rules.length !== 1) return undefined;
  const rule = rules[0].getFirstValue() as { freq?: string; interval?: number; count?: number | null };
  if (rule.count || (rule.freq !== 'DAILY' && rule.freq !== 'WEEKLY')) return undefined;
  const step = (rule.interval || 1) * (rule.freq === 'WEEKLY' ? 7 : 1);
  const days = (Date.parse(`${addDays(win.from, -42)}T00:00:00Z`) - Date.UTC(start.year, start.month - 1, start.day)) / DAY_MS;
  const periods = Math.floor(days / step);
  if (periods <= 0) return undefined;
  const moved = start.clone();
  moved.adjust(periods * step, 0, 0, 0);
  return moved;
}

/** Start in ms, for sorting: an all-day event sorts at its day's Copenhagen midnight. */
export const sortKey = (e: { start: string; allDay: boolean }) => (e.allDay ? midnight(e.start) : Date.parse(e.start));

/** Every occurrence that touches the window, sorted by start. Throws on text that is not iCal. */
export function expand(text: string, win: CalendarWindow): FeedEvent[] {
  const cal = new ICAL.Component(ICAL.parse(prefilter(text, win.from)));
  const vevents = cal.getAllSubcomponents('vevent');
  const masters: { uid: string; comp: InstanceType<typeof ICAL.Component> }[] = [];
  const exceptions = new Map<string, InstanceType<typeof ICAL.Component>[]>();
  for (const comp of vevents) {
    const uid = String(comp.getFirstPropertyValue('uid') ?? '');
    if (comp.hasProperty('recurrence-id')) {
      const list = exceptions.get(uid) ?? [];
      list.push(comp);
      exceptions.set(uid, list);
    } else {
      masters.push({ uid, comp });
    }
  }

  const out: FeedEvent[] = [];
  const push = (e: FeedEvent | null) => { if (e) out.push(e); };
  const limit = win.endMs + 7 * DAY_MS; // an occurrence moved into the window from up to a week later is still found
  const earliest = Number(addDays(win.from, -2).replaceAll('-', ''));
  for (const { uid, comp } of masters) {
    const related = exceptions.get(uid) ?? [];
    exceptions.delete(uid);
    const ev = new ICAL.Event(comp, { strictExceptions: true, exceptions: related.map((c) => new ICAL.Event(c)) });
    if (!ev.startDate) continue;
    if (!ev.isRecurring()) {
      push(occurrence(ev, ev.startDate, ev.endDate, win, uid));
      continue;
    }
    if (String(comp.getFirstPropertyValue('status') ?? '').toUpperCase() === 'CANCELLED') continue;
    const tzid = (comp.getFirstProperty('dtstart')?.getParameter('tzid') as string | undefined) ?? null;
    const it = ev.iterator(fastStart(comp, ev.startDate, win));
    for (let n = 0, next = it.next(); next && n < MAX_OCCURRENCES; n++, next = it.next()) {
      // Occurrences more than two days before the window are skipped on their date alone: converting every one of
      // years of daily occurrences through the zone rules costs more CPU than the function has.
      if (wallKey(next) < earliest) continue;
      const at = next.isDate ? midnight(dateOf(next)) : instant(next, tzid);
      if (at >= limit) break;
      const d = ev.getOccurrenceDetails(next);
      push(occurrence(d.item, d.startDate, d.endDate, win, uid));
    }
  }
  // Overrides whose series is not in the feed are shown as they are.
  for (const [uid, comps] of exceptions) for (const c of comps) {
    const ev = new ICAL.Event(c);
    if (ev.startDate) push(occurrence(ev, ev.startDate, ev.endDate, win, uid));
  }
  return out.sort((a, b) => sortKey(a) - sortKey(b));
}
