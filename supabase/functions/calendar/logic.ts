// The calendar function (Idé 7, option A: private iCal feeds). Read only: the app never creates or edits events.
//   add:    test-fetch a secret iCal address, encrypt it and store it with its calendar row. The address never goes back out.
//   events: today's and tomorrow's events from the caller's own enabled calendars and the other person's shared ones,
//           cached per feed for 15 minutes. A feed that fails returns its last cache marked stale; it never fails the call.
// Logs carry the outcome and the duration only: never an address, a host or an event title.
import type { Caller } from '../_shared/guard.ts';
import { HttpError } from '../_shared/http.ts';
import { z } from '../_shared/schema.ts';
import { fetchPublic, type FetchDeps } from '../_shared/fetch.ts';
import { open, seal } from '../_shared/crypto.ts';
import { copenhagenDate, expand, sortKey, windowFor, type CalendarWindow, type FeedEvent } from './ics.ts';

export const COLORS = ['cal-1', 'cal-2', 'cal-3', 'cal-4', 'cal-5', 'cal-6'] as const;
export const CALENDAR_MAX_BYTES = 5_000_000;
export const CACHE_MS = 15 * 60_000;
export const BUDGET_MS = 10_000;

export const Input = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('add'),
    url: z.string().trim().min(1).max(2000),
    label: z.string().trim().min(1).max(60),
    color: z.enum(COLORS),
    shared: z.boolean(),
  }),
  z.object({ action: z.literal('events') }),
]);
export type CalendarInput = z.infer<typeof Input>;
type AddInput = Extract<CalendarInput, { action: 'add' }>;

export interface SourceRow {
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

/** A calendar the caller may see, with its sealed address and its cache (from `sp_calendar_feeds_for`). */
export interface FeedRow {
  source_id: string;
  person: string;
  color: string;
  shared: boolean;
  url_cipher: string;
  cached_events: FeedEvent[] | null;
  cached_for: string | null;
  cached_at: string | null;
}

export type CacheWrite = { events: FeedEvent[]; forDate: string } | { error: FeedError };
export type FeedError = 'fetch_failed' | 'blocked' | 'too_large' | 'not_calendar' | 'parse_failed';

export interface CalendarDb {
  add(row: { householdId: string; person: string; userId: string; label: string; color: string; shared: boolean; cipher: string }): Promise<SourceRow>;
  /** Enabled calendars in the household that are the person's own or shared, own first, then by position. */
  feeds(householdId: string, person: string): Promise<FeedRow[]>;
  saveCache(sourceId: string, write: CacheWrite): Promise<void>;
}

export interface CalendarDeps {
  db: CalendarDb;
  key(): Promise<CryptoKey>;
  web?: FetchDeps;
  now?: () => Date;
  budgetMs?: number;
}

export interface CalendarEvent {
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
  /** Copenhagen date the window starts on. */
  today: string;
  events: CalendarEvent[];
  /** Per calendar: whether this answer is from an old cache, and when it was last fetched. */
  sources: { id: string; stale: boolean; updatedAt: string | null }[];
}

/** `webcal://` is how Apple and Outlook hand out these addresses; it is plain https underneath. */
export const normaliseUrl = (raw: string) => {
  const t = raw.trim();
  return /^webcal:\/\//i.test(t) ? `https://${t.slice(9)}` : t;
};

/** The feed text. Some providers serve iCal as text/plain or octet-stream. Throws the fetch errors or `not_calendar`. */
export async function fetchCalendar(url: string, web?: FetchDeps): Promise<string> {
  let page: Awaited<ReturnType<typeof fetchPublic>>;
  try {
    page = await fetchPublic(
      normaliseUrl(url),
      { accept: 'text/calendar, text/plain;q=0.5, */*;q=0.1', allowType: /^$|calendar|text\/plain|octet-stream/i, maxBytes: CALENDAR_MAX_BYTES },
      web,
    );
  } catch (e) {
    if (e instanceof HttpError && e.code === 'not_allowed_type') throw new HttpError(422, 'not_calendar');
    throw e;
  }
  const text = new TextDecoder().decode(page.bytes).replace(/^﻿/, '');
  if (!/^\s*BEGIN:VCALENDAR/i.test(text)) throw new HttpError(422, 'not_calendar');
  return text;
}

export async function addCalendar(caller: Caller, input: AddInput, deps: CalendarDeps): Promise<SourceRow> {
  const key = await deps.key(); // a missing SP_FEED_KEY stops here, before anything is fetched
  const url = normaliseUrl(input.url);
  const text = await fetchCalendar(url, deps.web);
  try {
    expand(text, windowFor(copenhagenDate(deps.now?.() ?? new Date())));
  } catch {
    throw new HttpError(422, 'not_calendar');
  }
  const cipher = await seal(url, key);
  return deps.db.add({
    householdId: caller.householdId, person: caller.person, userId: caller.userId,
    label: input.label, color: input.color, shared: input.shared, cipher,
  });
}

const feedError = (e: unknown): FeedError => {
  if (e instanceof HttpError && (e.code === 'blocked' || e.code === 'too_large' || e.code === 'not_calendar')) return e.code;
  if (e instanceof HttpError) return 'fetch_failed';
  if (e instanceof ParseError) return 'parse_failed';
  return 'fetch_failed';
};
class ParseError extends Error {}

/** Events from an older cache, cut to the current window. */
const inWindow = (events: FeedEvent[], win: CalendarWindow) =>
  events.filter((e) => (e.allDay ? e.start < win.to && e.end > win.from : Date.parse(e.start) < win.endMs && Date.parse(e.end) >= win.startMs));

export async function calendarEvents(caller: Caller, deps: CalendarDeps): Promise<EventsResult> {
  const key = await deps.key();
  const now = deps.now?.() ?? new Date();
  const today = copenhagenDate(now);
  const win = windowFor(today);
  // The database query already limits this; the filter here keeps the rule even if it ever changes.
  const feeds = (await deps.db.feeds(caller.householdId, caller.person)).filter((f) => f.person === caller.person || f.shared);

  type One = { events: FeedEvent[]; stale: boolean; updatedAt: string | null };
  const fromCache = (f: FeedRow): One => ({ events: inWindow(f.cached_events ?? [], win), stale: true, updatedAt: f.cached_at });

  const refresh = async (f: FeedRow): Promise<One> => {
    const fresh = f.cached_for === today && f.cached_at && now.getTime() - Date.parse(f.cached_at) < CACHE_MS;
    if (fresh) return { events: f.cached_events ?? [], stale: false, updatedAt: f.cached_at };
    try {
      const text = await fetchCalendar(await open(f.url_cipher, key), deps.web);
      let events: FeedEvent[];
      try { events = expand(text, win); } catch { throw new ParseError(); }
      await deps.db.saveCache(f.source_id, { events, forDate: today });
      return { events, stale: false, updatedAt: now.toISOString() };
    } catch (e) {
      await deps.db.saveCache(f.source_id, { error: feedError(e) }).catch(() => {});
      return fromCache(f);
    }
  };

  const budget = deps.budgetMs ?? BUDGET_MS;
  const results = await Promise.all(feeds.map((f) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<One>((resolve) => { timer = setTimeout(() => resolve(fromCache(f)), budget); });
    return Promise.race([refresh(f), late]).finally(() => clearTimeout(timer));
  }));

  // The same calendar added by both people as Fælles shows once, in the first calendar's colour.
  const seen = new Set<string>();
  const events: CalendarEvent[] = [];
  feeds.forEach((f, i) => {
    for (const e of results[i].events) {
      const id = `${e.uid}|${e.start}`;
      if (e.uid && seen.has(id)) continue;
      seen.add(id);
      events.push({
        sourceId: f.source_id, title: e.title, start: e.start, end: e.end, allDay: e.allDay,
        color: f.color, shared: f.shared, mine: f.person === caller.person, stale: results[i].stale,
      });
    }
  });
  events.sort((a, b) => sortKey(a) - sortKey(b) || Number(b.allDay) - Number(a.allDay));
  return { today, events, sources: feeds.map((f, i) => ({ id: f.source_id, stale: results[i].stale, updatedAt: results[i].updatedAt })) };
}
