import assert from 'node:assert/strict';
import test from 'node:test';
import { sundhedHref, parseSundhedPath } from '../src/components/strandparken/lib/routes.ts';
import type { DayView, SourceStatus } from '../src/components/strandparken/lib/health/model.ts';
import { barHeight, formatSteps, freshness, sourceLine, todayTiles, trend, viewerCanSee } from '../src/components/strandparken/lib/health/view.ts';

const day = (date: string, extra: Partial<DayView> = {}): DayView => ({ date, sources: {}, ...extra });
const TODAY = '2026-11-24'; // a Tuesday

test('parseSundhedPath reads tab and person', () => {
  assert.deepEqual(parseSundhedPath([]), { tab: 'data', person: null });
  assert.deepEqual(parseSundhedPath(['data', 'camilla']), { tab: 'data', person: 'camilla' });
  assert.deepEqual(parseSundhedPath(['data', 'jonas']), { tab: 'data', person: 'jonas' });
  assert.deepEqual(parseSundhedPath(['data', 'x']), { tab: 'data', person: null });
  assert.deepEqual(parseSundhedPath(['vaner']), { tab: 'vaner', person: null });
  assert.deepEqual(parseSundhedPath(['ukendt']), { tab: 'data', person: null });
});

test('sundhedHref', () => {
  assert.equal(sundhedHref('jonas'), '#sundhed/data/jonas');
  assert.equal(sundhedHref('camilla'), '#sundhed/data/camilla');
  assert.equal(sundhedHref(), '#sundhed');
});

test('todayTiles: order and formatting', () => {
  const d = day(TODAY, { sleep_score: 82, activity: { progress: 0.78, goal: 8000, unit: 'steps' }, steps: 6420, cycle_day: 14 });
  const tiles = todayTiles(d, [], true);
  assert.deepEqual(tiles.map((t) => [t.label, t.value]), [['Søvn', '82'], ['Aktivitet', '78%'], ['Skridt', '6.420'], ['Cyklus', 'Dag 14']]);
});

test('todayTiles: a hidden metric has no tile; null is an empty tile', () => {
  const d = day(TODAY, { sleep_score: null, activity: null, steps: null });
  const tiles = todayTiles(d, ['cycle_day'], false);
  assert.deepEqual(tiles.map((t) => t.label), ['Søvn', 'Aktivitet', 'Skridt']);
  assert.deepEqual(tiles.map((t) => [t.value, t.empty]), [[null, 'Ingen data i nat'], [null, 'Ingen data i dag'], [null, 'Ingen data i dag']]);
  assert.deepEqual(todayTiles(day(TODAY, { sleep_score: 70 }), ['sleep_score', 'activity', 'steps'], false), []);
});

test('todayTiles: Cyklus only with a cycle value or an owner log; activity above 100 % is shown as is', () => {
  assert.deepEqual(todayTiles(day(TODAY, { sleep_score: 1, cycle_day: null }), [], false).map((t) => t.label), ['Søvn', 'Aktivitet', 'Skridt']);
  assert.equal(todayTiles(day(TODAY, { cycle_day: null }), [], true, true).map((t) => t.label).at(-1), 'Cyklus');
  assert.equal(todayTiles(day(TODAY, { activity: { progress: 1.34, goal: null, unit: null } }), [], false)[1].value, '134%');
});

test('todayTiles with no day: empty tiles for what may be seen', () => {
  assert.deepEqual(todayTiles(null, [], false).map((t) => t.value), [null, null, null]);
});

test('formatSteps uses Danish grouping', () => {
  assert.equal(formatSteps(980), '980');
  assert.equal(formatSteps(6420), '6.420');
  assert.equal(formatSteps(1234567), '1.234.567');
});

test('freshness never shows yesterday as today', () => {
  const days = [day('2026-11-23', { sleep_score: 80 })];
  assert.deepEqual(freshness(days, TODAY), { day: null, stale: true, newest: '2026-11-23' });
  const fresh = [day('2026-11-23', { sleep_score: 80 }), day(TODAY, { sleep_score: 75 })];
  const f = freshness(fresh, TODAY);
  assert.equal(f.stale, false);
  assert.equal(f.day?.sleep_score, 75);
  assert.deepEqual(freshness([], TODAY), { day: null, stale: true, newest: null });
  assert.equal(freshness([day('2026-11-23', { steps: 5 }), day(TODAY, { steps: null })], TODAY).stale, true);
});

test('trend: seven days ending today, average over values only', () => {
  const days = [day('2026-11-18', { sleep_score: 70 }), day('2026-11-20', { sleep_score: 81 }), day(TODAY, { sleep_score: 90 })];
  const t = trend(days, TODAY, 'sleep_score')!;
  assert.equal(t.entries.length, 7);
  assert.equal(t.entries[0].date, '2026-11-18');
  assert.equal(t.entries[6].date, TODAY);
  assert.equal(t.entries[6].isToday, true);
  assert.deepEqual(t.entries.map((e) => e.letter), ['O', 'T', 'F', 'L', 'S', 'M', 'T']);
  assert.equal(t.entries[1].value, null);
  assert.equal(t.entries[2].label, 'Fredag');
  assert.equal(t.average, 80);
});

test('trend: activity is percent of goal; all null gives null', () => {
  const days = [day(TODAY, { activity: { progress: 0.456, goal: null, unit: null } })];
  assert.equal(trend(days, TODAY, 'activity')!.entries[6].value, 46);
  assert.equal(trend([day(TODAY, { sleep_score: null })], TODAY, 'sleep_score'), null);
  assert.equal(trend([day(TODAY)], TODAY, 'sleep_score'), null);
});

test('barHeight caps at 100', () => {
  assert.equal(barHeight(50), 50);
  assert.equal(barHeight(134), 100);
  assert.equal(barHeight(-5), 0);
});

test('sourceLine', () => {
  const now = new Date('2026-11-24T19:00:00+01:00');
  const s = (source: 'oura' | 'garmin', at: string | null): SourceStatus => ({ person: 'camilla', source, connectedAt: '2026-11-01T00:00:00Z', lastSyncedAt: at, lastError: null, stepGoal: null });
  assert.equal(sourceLine([s('oura', '2026-11-24T19:45:00+01:00')], now), 'Oura · synk. 19.45');
  assert.equal(sourceLine([s('oura', '2026-11-24T07:30:00+01:00'), s('garmin', '2026-11-24T08:05:00+01:00')], now), 'Oura · synk. 07.30 · Garmin · synk. 08.05');
  assert.equal(sourceLine([], now), null);
});

test('viewerCanSee is false only when every metric is hidden', () => {
  assert.equal(viewerCanSee([]), true);
  assert.equal(viewerCanSee(['cycle_day']), true);
  assert.equal(viewerCanSee(['sleep_score', 'activity', 'steps', 'cycle_day']), false);
});
