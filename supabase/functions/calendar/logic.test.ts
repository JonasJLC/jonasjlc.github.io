// Run: deno test --node-modules-dir=none --no-lock --allow-env supabase/functions
import assert from 'node:assert/strict';
import { importKey, open, seal } from '../_shared/crypto.ts';
import { fakeCaller } from '../_shared/fakes.ts';
import { HttpError } from '../_shared/http.ts';
import * as fx from './fixtures.ts';
import { copenhagenDate, expand, prefilter, windowFor, zonedToEpoch } from './ics.ts';
import {
  addCalendar, calendarEvents, CACHE_MS, Input, normaliseUrl, type CacheWrite, type CalendarDb, type FeedRow, type SourceRow,
} from './logic.ts';

const win = windowFor('2026-11-26');
const titles = (text: string, w = win) => expand(text, w).map((e) => `${e.title} ${e.start}–${e.end}`);
const code = async (p: Promise<unknown>) => {
  try { await p; return 'ok'; } catch (e) { return e instanceof HttpError ? `${e.status} ${e.code}` : 'other'; }
};
const key = () => importKey(btoa(String.fromCharCode(...new Uint8Array(32).fill(3))));
const pub = () => Promise.resolve(['93.184.216.34']);
const ics = (body: string, type = 'text/calendar; charset=utf-8') => new Response(body, { headers: { 'content-type': type } });
const now = new Date('2026-11-26T11:00:00Z'); // Thursday 12:00 in Copenhagen

Deno.test('the window is today and tomorrow in Copenhagen, across DST', () => {
  assert.equal(copenhagenDate(new Date('2026-11-25T23:30:00Z')), '2026-11-26');
  assert.equal(new Date(win.startMs).toISOString(), '2026-11-25T23:00:00.000Z');
  assert.equal(new Date(win.endMs).toISOString(), '2026-11-27T23:00:00.000Z');
  const dst = windowFor('2026-10-25');
  assert.equal(new Date(dst.startMs).toISOString(), '2026-10-24T22:00:00.000Z');
  assert.equal(new Date(dst.endMs).toISOString(), '2026-10-26T23:00:00.000Z');
  assert.equal(new Date(zonedToEpoch(2026, 7, 1, 9, 0, 0, 'Europe/Copenhagen')).toISOString(), '2026-07-01T07:00:00.000Z');
});

Deno.test('a single event, with location and description left out; old events are dropped before parsing', () => {
  const out = expand(fx.single, win);
  assert.deepEqual(out, [{ uid: 'single-1@google.com', title: 'Tandlæge', start: '2026-11-26T08:30:00.000Z', end: '2026-11-26T09:00:00.000Z', allDay: false }]);
  assert.ok(!prefilter(fx.single, win.from).includes('Gammel aftale'));
  assert.ok(prefilter(fx.single, win.from).includes('Tandlæge'));
});

Deno.test('a weekly RRULE with one EXDATE', () => {
  assert.deepEqual(titles(fx.weeklyWithExdate), ['Svømning 2026-11-26T16:00:00.000Z–2026-11-26T17:00:00.000Z']);
});

Deno.test('a moved occurrence (RECURRENCE-ID) replaces the original; another series with the same RECURRENCE-ID is separate', () => {
  assert.deepEqual(titles(fx.movedOccurrence), [
    'Andet møde 2026-11-27T07:00:00.000Z–2026-11-27T08:00:00.000Z',
    'Morgenmøde (flyttet) 2026-11-27T11:00:00.000Z–2026-11-27T12:00:00.000Z',
  ]);
});

Deno.test('all-day events use dates with an exclusive end; one that started yesterday still shows', () => {
  assert.deepEqual(titles(fx.allDay), ['Kursus 2026-11-25–2026-11-28', 'Mormors fødselsdag 2026-11-27–2026-11-28']);
  assert.ok(expand(fx.allDay, win).every((e) => e.allDay));
});

Deno.test('events crossing midnight show on both days they touch', () => {
  assert.deepEqual(titles(fx.crossingMidnight), [
    'Fest 2026-11-25T21:00:00.000Z–2026-11-26T01:00:00.000Z',
    'Nattevagt 2026-11-27T22:00:00.000Z–2026-11-28T06:00:00.000Z',
  ]);
});

Deno.test('a UTC feed and a feed with its own (Windows-named) VTIMEZONE', () => {
  assert.deepEqual(titles(fx.utcFeed), ['Standup 2026-11-26T08:00:00.000Z–2026-11-26T08:30:00.000Z']);
  assert.deepEqual(titles(fx.windowsZone), ['Frisør 2026-11-26T13:00:00.000Z–2026-11-26T14:00:00.000Z']);
});

Deno.test('the end of summer time: 09:00 local is 07:00Z on Saturday and 08:00Z on Sunday', () => {
  assert.deepEqual(titles(fx.dstEnd, windowFor('2026-10-24')), [
    'Gåtur 2026-10-24T07:00:00.000Z–2026-10-24T07:30:00.000Z',
    'Gåtur 2026-10-25T08:00:00.000Z–2026-10-25T08:30:00.000Z',
  ]);
});

Deno.test('series running for ten years: the right occurrences, quickly (the long history is not walked)', () => {
  const started = performance.now();
  assert.deepEqual(titles(fx.longSeries), [
    'Medicin 2026-11-26T06:00:00.000Z–2026-11-26T06:15:00.000Z',
    'Kor 2026-11-26T18:00:00.000Z–2026-11-26T19:00:00.000Z',
  ]);
  assert.ok(performance.now() - started < 500);
});

Deno.test('cancelled events and cancelled occurrences are left out', () => {
  assert.deepEqual(titles(fx.cancelled), ['Daglig 2026-11-26T09:00:00.000Z–2026-11-26T10:00:00.000Z']);
});

Deno.test('titles are clipped to 120 characters', () => {
  const long = fx.single.replace('SUMMARY:Tandlæge', `SUMMARY:${'x'.repeat(300)}`);
  assert.equal(expand(long, win)[0].title.length, 120);
});

Deno.test('input: add needs a label, a token colour and the shared flag; webcal is https', () => {
  assert.equal(Input.safeParse({ action: 'add', url: 'webcal://p01.icloud.com/x', label: 'Arbejde', color: 'cal-2', shared: false }).success, true);
  assert.equal(Input.safeParse({ action: 'add', url: 'https://x.dk/a.ics', label: 'A', color: '#ff0000', shared: false }).success, false);
  assert.equal(Input.safeParse({ action: 'add', url: 'https://x.dk/a.ics', label: ' ', color: 'cal-1', shared: false }).success, false);
  assert.equal(Input.safeParse({ action: 'add', url: 'https://x.dk/a.ics', label: 'x'.repeat(61), color: 'cal-1', shared: false }).success, false);
  assert.equal(Input.safeParse({ action: 'events' }).success, true);
  assert.equal(normaliseUrl(' webcal://p01.icloud.com/published/2/abc '), 'https://p01.icloud.com/published/2/abc');
});

function fakeDb(feeds: FeedRow[] = []) {
  const added: Parameters<CalendarDb['add']>[0][] = [];
  const writes: [string, CacheWrite][] = [];
  const db: CalendarDb = {
    add: (r) => { added.push(r); return Promise.resolve({ id: 's-new', household_id: r.householdId, person: r.person, label: r.label, color: r.color, shared: r.shared } as SourceRow); },
    feeds: () => Promise.resolve(feeds),
    saveCache: (id, w) => { writes.push([id, w]); return Promise.resolve(); },
  };
  return { db, added, writes };
}

Deno.test('add: fetches, proves it is a calendar, stores only the sealed address', async () => {
  const { db, added } = fakeDb();
  const seen: string[] = [];
  const row = await addCalendar(fakeCaller(), { action: 'add', url: 'webcal://cal.example.dk/a.ics', label: 'Arbejde', color: 'cal-3', shared: true }, {
    db, key, now: () => now, web: { resolve: pub, fetch: (u) => { seen.push(u.toString()); return Promise.resolve(ics(fx.single)); } },
  });
  assert.deepEqual(seen, ['https://cal.example.dk/a.ics']);
  assert.equal(row.id, 's-new');
  assert.equal(added.length, 1);
  assert.equal(added[0].person, 'b');
  assert.ok(!added[0].cipher.includes('example'));
  assert.equal(await open(added[0].cipher, await key()), 'https://cal.example.dk/a.ics');
});

Deno.test('add: text/plain and octet-stream iCal are accepted; HTML, http and private addresses are refused', async () => {
  const run = (url: string, res: () => Response) => {
    const { db } = fakeDb();
    return code(addCalendar(fakeCaller(), { action: 'add', url, label: 'A', color: 'cal-1', shared: false }, {
      db, key, now: () => now, web: { resolve: pub, fetch: () => Promise.resolve(res()) },
    }));
  };
  assert.equal(await run('https://x.dk/a.ics', () => ics(fx.single, 'text/plain')), 'ok');
  assert.equal(await run('https://x.dk/a.ics', () => ics(fx.single, 'application/octet-stream')), 'ok');
  assert.equal(await run('https://x.dk/a.ics', () => ics(fx.notCalendar, 'text/html')), '422 not_calendar');
  assert.equal(await run('https://x.dk/a.ics', () => ics(fx.notCalendar, 'text/plain')), '422 not_calendar');
  assert.equal(await run('http://x.dk/a.ics', () => ics(fx.single)), '422 bad_url');
  assert.equal(await run('https://192.168.1.1/x.ics', () => ics(fx.single)), '422 blocked');
  assert.equal(await run('https://x.dk/a.ics', () => new Response('nope', { status: 404 })), '502 fetch_failed');
});

Deno.test('add and events: a missing key is 503 not_configured, before anything is fetched', async () => {
  let fetched = false;
  const deps = { db: fakeDb().db, key: () => importKey(undefined), web: { resolve: pub, fetch: () => { fetched = true; return Promise.resolve(ics(fx.single)); } } };
  assert.equal(await code(addCalendar(fakeCaller(), { action: 'add', url: 'https://x.dk/a.ics', label: 'A', color: 'cal-1', shared: false }, deps)), '503 not_configured');
  assert.equal(await code(calendarEvents(fakeCaller(), deps)), '503 not_configured');
  assert.equal(fetched, false);
});

const feed = async (over: Partial<FeedRow> & { url?: string } = {}): Promise<FeedRow> => ({
  source_id: 's1', person: 'b', color: 'cal-1', shared: false, cached_events: null, cached_for: null, cached_at: null,
  url_cipher: await seal(over.url ?? 'https://cal.example.dk/1.ics', await key()),
  ...over,
});

Deno.test('events: fetches, caches and labels own and shared events', async () => {
  const { db, writes } = fakeDb([
    await feed({ source_id: 'mine', url: 'https://cal.example.dk/mine.ics' }),
    await feed({ source_id: 'theirs', person: 'a', shared: true, color: 'cal-4', url: 'https://cal.example.dk/theirs.ics' }),
  ]);
  const out = await calendarEvents(fakeCaller(), {
    db, key, now: () => now,
    web: { resolve: pub, fetch: (u) => Promise.resolve(ics(new URL(u.toString()).pathname === '/mine.ics' ? fx.single : fx.utcFeed)) },
  });
  assert.equal(out.today, '2026-11-26');
  assert.deepEqual(out.events.map((e) => [e.title, e.sourceId, e.mine, e.shared, e.color, e.stale]), [
    ['Standup', 'theirs', false, true, 'cal-4', false],
    ['Tandlæge', 'mine', true, false, 'cal-1', false],
  ]);
  assert.deepEqual(writes.map(([id, w]) => [id, 'events' in w ? w.forDate : w.error]), [['mine', '2026-11-26'], ['theirs', '2026-11-26']]);
  assert.ok(!JSON.stringify(out).includes('Hemmelig adresse'));
});

Deno.test('events: the other person\'s private calendar is never fetched', async () => {
  const fetched: string[] = [];
  const { db } = fakeDb([await feed({ source_id: 'private-other', person: 'a', shared: false, url: 'https://cal.example.dk/secret.ics' })]);
  const out = await calendarEvents(fakeCaller(), { db, key, now: () => now, web: { resolve: pub, fetch: (u) => { fetched.push(u.toString()); return Promise.resolve(ics(fx.single)); } } });
  assert.deepEqual(fetched, []);
  assert.deepEqual(out.events, []);
  assert.deepEqual(out.sources, []);
});

Deno.test('events: a cache from today under 15 minutes old is used; older or from yesterday is refetched', async () => {
  const cached = [{ uid: 'c', title: 'Fra cache', start: '2026-11-26T15:00:00.000Z', end: '2026-11-26T16:00:00.000Z', allDay: false }];
  let fetches = 0;
  const web = { resolve: pub, fetch: () => { fetches++; return Promise.resolve(ics(fx.single)); } };
  const at = (ms: number) => new Date(now.getTime() - ms).toISOString();

  let r = await calendarEvents(fakeCaller(), { db: fakeDb([await feed({ cached_events: cached, cached_for: '2026-11-26', cached_at: at(CACHE_MS - 1000) })]).db, key, now: () => now, web });
  assert.deepEqual([fetches, r.events[0].title], [0, 'Fra cache']);
  r = await calendarEvents(fakeCaller(), { db: fakeDb([await feed({ cached_events: cached, cached_for: '2026-11-26', cached_at: at(CACHE_MS + 1000) })]).db, key, now: () => now, web });
  assert.deepEqual([fetches, r.events[0].title], [1, 'Tandlæge']);
  r = await calendarEvents(fakeCaller(), { db: fakeDb([await feed({ cached_events: cached, cached_for: '2026-11-25', cached_at: at(1000) })]).db, key, now: () => now, web });
  assert.deepEqual([fetches, r.events[0].title], [2, 'Tandlæge']);
});

Deno.test('events: a failing feed returns its last cache marked stale and records the error; the others still load', async () => {
  const cached = [{ uid: 'c', title: 'Gammel', start: '2026-11-26T15:00:00.000Z', end: '2026-11-26T16:00:00.000Z', allDay: false }];
  const { db, writes } = fakeDb([
    await feed({ source_id: 'bad', url: 'https://cal.example.dk/bad.ics', cached_events: cached, cached_for: '2026-11-26', cached_at: '2026-11-26T08:00:00.000Z' }),
    await feed({ source_id: 'good', url: 'https://cal.example.dk/good.ics' }),
  ]);
  const out = await calendarEvents(fakeCaller(), {
    db, key, now: () => now,
    web: { resolve: pub, fetch: (u) => Promise.resolve(new URL(u.toString()).pathname === '/bad.ics' ? new Response('', { status: 500 }) : ics(fx.single)) },
  });
  assert.deepEqual(out.events.map((e) => [e.title, e.stale]), [['Tandlæge', false], ['Gammel', true]]);
  assert.deepEqual(out.sources, [
    { id: 'bad', stale: true, updatedAt: '2026-11-26T08:00:00.000Z' },
    { id: 'good', stale: false, updatedAt: now.toISOString() },
  ]);
  assert.deepEqual(writes.find(([id]) => id === 'bad')?.[1], { error: 'fetch_failed' });
});

Deno.test('events: a feed slower than the budget answers from its cache', async () => {
  const { db } = fakeDb([await feed()]);
  const out = await calendarEvents(fakeCaller(), {
    db, key, now: () => now, budgetMs: 20,
    web: { resolve: pub, fetch: () => new Promise((resolve) => setTimeout(() => resolve(ics(fx.single)), 200)) },
  });
  assert.deepEqual(out.sources, [{ id: 's1', stale: true, updatedAt: null }]);
  await new Promise((r) => setTimeout(r, 250));
});

Deno.test('events: the same shared calendar added by both people shows once, in the first calendar\'s colour', async () => {
  const { db } = fakeDb([
    await feed({ source_id: 'mine', shared: true, color: 'cal-2' }),
    await feed({ source_id: 'theirs', person: 'a', shared: true, color: 'cal-5' }),
  ]);
  const out = await calendarEvents(fakeCaller(), { db, key, now: () => now, web: { resolve: pub, fetch: () => Promise.resolve(ics(fx.single)) } });
  assert.deepEqual(out.events.map((e) => [e.sourceId, e.color]), [['mine', 'cal-2']]);
});
