import assert from 'node:assert/strict';
import test from 'node:test';
import { canDecrement, canIncrement, personsLabel, step } from '../src/components/strandparken/lib/stepper.ts';

const limits = { min: 1, max: 8 };

test('step moves by the delta and clamps to the limits', () => {
  assert.equal(step(2, 1, limits), 3);
  assert.equal(step(2, -1, limits), 1);
  assert.equal(step(1, -1, limits), 1);
  assert.equal(step(8, 1, limits), 8);
  assert.equal(step(7, 5, limits), 8);
  assert.equal(step(3, -9, limits), 1);
});

test('step pulls an out-of-range value back inside', () => {
  assert.equal(step(0, 0, limits), 1);
  assert.equal(step(12, 0, limits), 8);
});

test('canDecrement and canIncrement report the limits', () => {
  assert.equal(canDecrement(1, limits), false);
  assert.equal(canDecrement(2, limits), true);
  assert.equal(canIncrement(8, limits), false);
  assert.equal(canIncrement(7, limits), true);
});

test('personsLabel uses Danish singular and plural', () => {
  assert.equal(personsLabel(1), '1 person');
  assert.equal(personsLabel(2), '2 personer');
  assert.equal(personsLabel(8), '8 personer');
});
