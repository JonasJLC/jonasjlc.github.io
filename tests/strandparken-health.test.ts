import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  connectResult,
  copenhagenToday,
  defaultSharing,
  errorText,
  formatSync,
  isStale,
  missingDataHint,
  sharingFor,
  sourcesFrom,
  toHealthView,
  type HealthRow,
} from '../src/components/strandparken/lib/health/model.ts';

const row = (over: Partial<HealthRow>): HealthRow => ({
  date: '2026-11-20',
  source: 'oura',
  sleep_score: null,
  activity_progress: null,
  activity_goal: null,
  activity_goal_unit: null,
  steps: null,
  cycle_day: null,
  synced_at: '2026-11-20T06:00:00Z',
  hidden: [],
  ...over,
});

test('formatSync shows the source and the Copenhagen time, with the date when it is not today', () => {
  const now = new Date('2026-11-19T20:00:00Z');
  assert.equal(formatSync('oura', '2026-11-19T18:45:00Z', now), 'Oura · synk. 19.45');
  assert.equal(formatSync('garmin', '2026-11-18T07:05:00Z', now), 'Garmin · synk. 18. nov. 08.05');
  assert.equal(formatSync('oura', null, now), 'Oura · ikke synkroniseret endnu');
  assert.equal(formatSync('oura', '2026-07-01T05:30:00Z', new Date('2026-07-01T10:00:00Z')), 'Oura · synk. 07.30');
});

test('today is the Copenhagen calendar day', () => {
  assert.equal(copenhagenToday(new Date('2026-11-19T23:30:00Z')), '2026-11-20');
});

test('isStale is true when the newest day with a value is not today', () => {
  const view = toHealthView([row({ date: '2026-11-19', steps: 100 }), row({ date: '2026-11-20' })]);
  assert.equal(isStale(view.days, '2026-11-20'), true);
  assert.equal(isStale(toHealthView([row({ steps: 5 })]).days, '2026-11-20'), false);
  assert.equal(isStale([], '2026-11-20'), true);
});

test('two sources per day: each metric comes from the preferred source that has a value', () => {
  const view = toHealthView([
    row({ source: 'garmin', sleep_score: 60, steps: 9000, activity_progress: 0.9, activity_goal: 10000, activity_goal_unit: 'steps' }),
    row({ source: 'oura', sleep_score: 82, steps: null, activity_progress: 0.5, activity_goal: 500, activity_goal_unit: 'kcal' }),
    row({ source: 'manual', cycle_day: 4 }),
  ]);
  const [d] = view.days;
  assert.equal(d.sleep_score, 82, 'Oura before Garmin by default');
  assert.equal(d.steps, 9000, 'Garmin fills the gap');
  assert.deepEqual(d.activity, { progress: 0.5, goal: 500, unit: 'kcal' }, 'activity fields come from one source');
  assert.equal(d.cycle_day, 4);
  assert.deepEqual(d.sources, { sleep_score: 'oura', steps: 'garmin', activity: 'oura', cycle_day: 'manual' });
  const garminFirst = toHealthView([row({ source: 'garmin', sleep_score: 60 }), row({ source: 'oura', sleep_score: 82 })], ['garmin', 'oura', 'manual']);
  assert.equal(garminFirst.days[0].sleep_score, 60, 'the order is configurable');
});

test('hidden metrics are removed from the view; null metrics stay as no data', () => {
  const view = toHealthView([row({ sleep_score: 80, hidden: ['steps', 'cycle_day'] })]);
  const [d] = view.days;
  assert.deepEqual(view.hidden, ['steps', 'cycle_day']);
  assert.equal(d.sleep_score, 80);
  assert.equal(d.activity, null, 'no data');
  assert.equal('steps' in d, false, 'hidden');
  assert.equal('cycle_day' in d, false, 'hidden');
});

test('days are sorted by date and unknown sources and hidden names are ignored', () => {
  const view = toHealthView([row({ date: '2026-11-20', steps: 1 }), row({ date: '2026-11-18', steps: 2 }), row({ source: 'weird', steps: 3 }), row({ hidden: ['bogus'] })]);
  assert.deepEqual(view.days.map((d) => d.date), ['2026-11-18', '2026-11-20']);
  assert.deepEqual(view.hidden, []);
});

test('sources map person keys and keep the error only where the database returned it', () => {
  const s = sourcesFrom([
    { person: 'a', source: 'oura', connected_at: 'c', last_synced_at: 's', last_error: 'reconnect', step_goal: null },
    { person: 'b', source: 'garmin', connected_at: 'c', last_synced_at: null, last_error: null, step_goal: 8000 },
    { person: 'x', source: 'oura', connected_at: 'c', last_synced_at: null, last_error: null, step_goal: null },
  ]);
  assert.deepEqual(s.map((x) => [x.person, x.source, x.lastError, x.stepGoal]), [['camilla', 'oura', 'reconnect', null], ['jonas', 'garmin', null, 8000]]);
});

test('sharing: no rows is unconfirmed (nothing shared); defaults are sleep, activity, steps on and cycle off', () => {
  assert.deepEqual(defaultSharing, { sleep_score: true, activity: true, steps: true, cycle_day: false });
  assert.deepEqual(sharingFor([], 'camilla'), { confirmed: false, values: { sleep_score: false, activity: false, steps: false, cycle_day: false } });
  const s = sharingFor([{ person: 'a', metric: 'sleep_score', shared: true }, { person: 'b', metric: 'steps', shared: true }], 'camilla');
  assert.equal(s.confirmed, true);
  assert.deepEqual(s.values, { sleep_score: true, activity: false, steps: false, cycle_day: false });
});

test('error codes become Danish text; reconnect asks to connect again', () => {
  assert.equal(errorText('reconnect'), 'Forbindelsen er udløbet — forbind igen');
  assert.equal(errorText('not_configured'), 'Forbindelsen er ikke sat op endnu.');
  assert.equal(errorText('anything'), 'Seneste synkronisering fejlede.');
  assert.equal(errorText(null), null);
});

test('missing-data hint names the right app', () => {
  assert.equal(missingDataHint('oura'), 'Ingen data i nat — tjek at ringen har synkroniseret i Oura-appen.');
  assert.match(missingDataHint('garmin'), /Garmin Connect-appen/);
});

test('the Oura redirect result is read from the hash query', () => {
  assert.deepEqual(connectResult('#hjem?forbundet=oura'), { kind: 'connected', source: 'oura' });
  assert.deepEqual(connectResult('#hjem?forbind=afbrudt'), { kind: 'cancelled' });
  assert.deepEqual(connectResult('#hjem?forbind=fejl&kode=expired'), { kind: 'error', code: 'expired' });
  assert.equal(connectResult('#hjem'), null);
  assert.equal(connectResult('#hjem?forbundet=evil'), null);
});
