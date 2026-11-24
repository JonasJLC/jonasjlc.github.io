import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calendarErrorMessage, calshowSeconds, clock, colorOf, copenhagenMidnight, covers, dayLink, isIos, label, nextToday, splitSources,
  summary, timeRange, tomorrow, updatedLabel, type CalEvent, type CalendarSource,
} from '../src/components/strandparken/lib/calendar/model.ts';

// Thursday 19 November 2026, 12:00 in Copenhagen (UTC+1).
const now = new Date('2026-11-19T11:00:00Z');
const today = '2026-11-19';

let n = 0;
const ev = (e: Partial<CalEvent>): CalEvent => ({
  sourceId: `s${n++}`, title: 'X', start: '2026-11-19T08:00:00.000Z', end: '2026-11-19T09:00:00.000Z', allDay: false,
  color: 'cal-1', shared: false, mine: true, stale: false, ...e,
});
const allDay = (title: string, start: string, end: string) => ev({ title, start, end, allDay: true });
const at = (title: string, start: string, end: string, more: Partial<CalEvent> = {}) => ev({ title, start, end, ...more });

test('clock uses Copenhagen time and Danish dots, across DST', () => {
  assert.equal(clock('2026-11-19T08:30:00.000Z'), '09.30');
  assert.equal(clock('2026-07-01T08:30:00.000Z'), '10.30');
  assert.equal(clock('2026-11-19T23:00:00.000Z'), '00.00');
});

test('covers: all-day ranges are exclusive at the end; an event ending at midnight does not touch the next day', () => {
  assert.equal(covers(allDay('A', '2026-11-18', '2026-11-20'), today), true);
  assert.equal(covers(allDay('A', '2026-11-18', '2026-11-19'), today), false);
  assert.equal(covers(at('Fest', '2026-11-18T21:00:00.000Z', '2026-11-19T01:00:00.000Z'), today), true);
  assert.equal(covers(at('Til midnat', '2026-11-18T20:00:00.000Z', '2026-11-18T23:00:00.000Z'), today), false);
});

test('nextToday: the first timed event that has not ended', () => {
  const events = [
    at('Morgen', '2026-11-19T07:00:00.000Z', '2026-11-19T08:00:00.000Z'),
    at('Frokost', '2026-11-19T11:00:00.000Z', '2026-11-19T12:00:00.000Z'),
    at('Tandlæge', '2026-11-19T14:30:00.000Z', '2026-11-19T15:00:00.000Z'),
    allDay('Fødselsdag', today, '2026-11-20'),
  ];
  assert.equal(nextToday(events, now)?.title, 'Frokost'); // running now, not ended
  assert.equal(nextToday(events, new Date('2026-11-19T12:30:00Z'))?.title, 'Tandlæge');
});

test('nextToday: an all-day event when no timed one is left, else null', () => {
  const events = [at('Morgen', '2026-11-19T07:00:00.000Z', '2026-11-19T08:00:00.000Z'), allDay('Fødselsdag', today, '2026-11-20')];
  assert.equal(nextToday(events, now)?.title, 'Fødselsdag');
  assert.equal(nextToday([events[0]], now), null);
  assert.equal(nextToday([at('I morgen', '2026-11-20T08:00:00.000Z', '2026-11-20T09:00:00.000Z')], now), null);
});

test('tomorrow: all-day first, then by start; two shown and "+ N mere"', () => {
  const events = [
    at('Bio', '2026-11-20T17:00:00.000Z', '2026-11-20T21:00:00.000Z', { shared: true }),
    at('Tandlæge', '2026-11-20T08:30:00.000Z', '2026-11-20T09:00:00.000Z'),
    allDay('Mormor', '2026-11-20', '2026-11-21'),
    at('I dag', '2026-11-19T15:00:00.000Z', '2026-11-19T16:00:00.000Z'),
  ];
  const t = tomorrow(events, today);
  assert.deepEqual(t.shown.map((e) => e.title), ['Mormor', 'Tandlæge']);
  assert.equal(t.more, 1);
  assert.deepEqual(tomorrow(events.slice(0, 2), today), { shown: [events[1], events[0]], more: 0 });
});

test('timeRange and label', () => {
  assert.equal(timeRange(at('A', '2026-11-19T08:30:00.000Z', '2026-11-19T09:00:00.000Z')), '09.30 – 10.00');
  assert.equal(timeRange(allDay('A', today, '2026-11-20')), 'Hele dagen');
  assert.equal(timeRange(at('A', '2026-11-19T08:30:00.000Z', '2026-11-19T08:30:00.000Z')), '09.30');
  assert.equal(label(ev({ title: 'Bio', shared: true })), 'Bio · fælles');
  assert.equal(label(ev({ title: 'Bio' })), 'Bio');
});

test('summary is the card\'s accessible name', () => {
  const events = [
    at('Tandlæge', '2026-11-20T08:30:00.000Z', '2026-11-20T09:00:00.000Z'),
    at('Bio', '2026-11-20T17:00:00.000Z', '2026-11-20T21:00:00.000Z', { shared: true }),
  ];
  assert.equal(summary(events, now), 'Kalender: torsdag 19. Ingen flere i dag. I morgen: Tandlæge 09.30 til 10.00, Bio fælles 18.00 til 22.00.');
  const more = [...events, allDay('Mormor', '2026-11-20', '2026-11-21'), at('Nu', '2026-11-19T15:00:00.000Z', '2026-11-19T16:00:00.000Z')];
  assert.equal(summary(more, now), 'Kalender: torsdag 19. I dag: Nu 16.00 til 17.00. I morgen: Mormor hele dagen, Tandlæge 09.30 til 10.00 og 1 mere.');
  assert.equal(summary([], now), 'Kalender: torsdag 19. Ingen flere i dag. Intet i morgen.');
});

test('isIos: iPhone, iPad, iPadOS as a Mac with touch; not Android or desktop', () => {
  assert.equal(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15'), true);
  assert.equal(isIos('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'), true);
  assert.equal(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 5), true);
  assert.equal(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 0), false);
  assert.equal(isIos('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36'), false);
  assert.equal(isIos('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), false);
});

test('calshowSeconds counts from 2001-01-01Z to Copenhagen midnight', () => {
  assert.equal(new Date(copenhagenMidnight('2026-11-19')).toISOString(), '2026-11-18T23:00:00.000Z');
  assert.equal(new Date(copenhagenMidnight('2026-07-01')).toISOString(), '2026-06-30T22:00:00.000Z');
  assert.equal(calshowSeconds('2001-01-01'), -3600);
  assert.equal(calshowSeconds('2026-11-19'), (Date.UTC(2026, 10, 18, 23) - Date.UTC(2001, 0, 1)) / 1000);
});

test('dayLink: calshow on iOS, Google Calendar day view elsewhere', () => {
  assert.equal(dayLink('2026-11-19', 'iPhone'), `calshow:${calshowSeconds('2026-11-19')}`);
  assert.equal(dayLink('2026-11-19', 'Android'), 'https://calendar.google.com/calendar/r/day/2026/11/19');
});

test('updatedLabel, colours and error copy', () => {
  assert.equal(updatedLabel('2026-11-19T13:05:00.000Z', now), 'opdateret 14.05');
  assert.equal(updatedLabel('2026-11-17T13:05:00.000Z', now), 'opdateret 17/11');
  assert.equal(colorOf('cal-3').bar, 'bg-sp-cal-3');
  assert.equal(colorOf('weird').bar, 'bg-sp-cal-1');
  assert.equal(calendarErrorMessage('fetch_failed'), 'Kalenderen kunne ikke hentes. Tjek adressen.');
  assert.equal(calendarErrorMessage('not_calendar'), 'Adressen er ikke en kalender (iCal).');
  assert.match(calendarErrorMessage(undefined), /Prøv igen/);
});

test('splitSources: own calendars, and only the other person\'s shared ones', () => {
  const row = (r: Partial<CalendarSource>): CalendarSource => ({
    id: 'x', household_id: 'h', person: 'b', label: 'L', color: 'cal-1', shared: false, enabled: true, position: 0,
    last_fetched_at: null, last_error: null, created_at: '2026-11-19T10:00:00Z', updated_at: '2026-11-19T10:00:00Z', created_by: null, ...r,
  });
  const out = splitSources([row({ id: '2', position: 1 }), row({ id: '1' }), row({ id: '3', person: 'a', shared: true }), row({ id: '4', person: 'a' })], 'b');
  assert.deepEqual(out.mine.map((r) => r.id), ['1', '2']);
  assert.deepEqual(out.theirs.map((r) => r.id), ['3']);
});
