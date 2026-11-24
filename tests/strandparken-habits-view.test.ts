import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayCounts, dayRing, type Habit } from '../src/components/strandparken/lib/habits/model.ts';
import type { Rule } from '../src/components/strandparken/lib/habits/rules.ts';
import {
  availableMetrics, goalFraction, healthMetricOf, textToThreshold, thresholdToText, todayValueFor,
} from '../src/components/strandparken/lib/habits/view.ts';

const stepsRule: Rule = { metric: 'steps', op: '>=', threshold: 8000 };
const act: Rule = { metric: 'activity_progress', op: '>=', threshold: 1 };

test('todayValueFor: value when visible, hidden metric gives no value, no data stays null', () => {
  assert.deepEqual(todayValueFor(stepsRule, { steps: 6420 }, []), { value: 6420, visible: true });
  assert.deepEqual(todayValueFor(stepsRule, { steps: 6420 }, ['steps']), { value: null, visible: false });
  assert.deepEqual(todayValueFor(stepsRule, null, []), { value: null, visible: true });
  assert.deepEqual(todayValueFor(act, { activity: { progress: 0.5 } }, []), { value: 0.5, visible: true });
  assert.deepEqual(todayValueFor(act, { activity: { progress: 0.5 } }, ['activity']), { value: null, visible: false });
  assert.equal(todayValueFor(null, { steps: 1 }, []), null);
  assert.equal(healthMetricOf('activity_progress'), 'activity');
});

test('availableMetrics: a connected source gives all three, otherwise only metrics with data', () => {
  assert.deepEqual(availableMetrics(true, []), ['steps', 'sleep_score', 'activity_progress']);
  assert.deepEqual(availableMetrics(false, []), []);
  assert.deepEqual(availableMetrics(false, [{ steps: 100 }, { sleep_score: null }]), ['steps']);
  assert.deepEqual(availableMetrics(false, [{ activity: { progress: 0.2 } }]), ['activity_progress']);
});

test('threshold text: activity is shown as a percentage and read back', () => {
  assert.equal(thresholdToText({ metric: 'activity_progress', threshold: 1 }), '100');
  assert.equal(thresholdToText({ metric: 'steps', threshold: 8000 }), '8000');
  assert.equal(textToThreshold('activity_progress', '75'), 0.75);
  assert.equal(textToThreshold('steps', '8.5'), 8.5);
  assert.equal(textToThreshold('steps', '8,5'), 8.5);
  assert.equal(textToThreshold('steps', ''), null);
  assert.equal(textToThreshold('steps', 'abc'), null);
  assert.equal(textToThreshold('steps', '-3'), null);
});

test('dayCounts: counts behind the ring, null for future days and days with nothing due', () => {
  const h: Habit = {
    id: 'x', owner: 'b', title: 'X', tracking: 'manual', frequency: { kind: 'daily' }, rule: null, color: 'sage', icon: null,
    reminderTime: null, archivedAt: null, createdAt: '2026-01-01T10:00:00Z',
  };
  const cs = [{ habitId: 'x', date: '2026-11-24', completedBy: 'b' as const, source: 'manual' as const }];
  assert.deepEqual(dayCounts([h], cs, '2026-11-24', '2026-11-25'), { done: 1, total: 1 });
  assert.deepEqual(dayCounts([h], cs, '2026-11-25', '2026-11-25'), { done: 0, total: 1 });
  assert.equal(dayCounts([h], cs, '2026-11-26', '2026-11-25'), null);
  assert.equal(dayCounts([], cs, '2026-11-24', '2026-11-25'), null);
  assert.equal(dayRing([h], cs, '2026-11-24', '2026-11-25'), 1);
});

test('goalFraction: only steps, only when visible, capped at 1', () => {
  assert.equal(goalFraction(stepsRule, { value: 4000, visible: true }), 0.5);
  assert.equal(goalFraction(stepsRule, { value: 9000, visible: true }), 1);
  assert.equal(goalFraction(stepsRule, { value: 4000, visible: false }), null);
  assert.equal(goalFraction(stepsRule, { value: null, visible: true }), null);
  assert.equal(goalFraction({ metric: 'sleep_score', op: '>', threshold: 75 }, { value: 80, visible: true }), null);
});
