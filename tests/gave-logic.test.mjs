import assert from 'node:assert/strict';
import test from 'node:test';
import {
  initialState,
  isValidSavedState,
  matchesAnswer,
  normalizeAnswer,
} from '../src/scripts/gave-logic.mjs';

test('normalizes destination answers regardless of casing, spaces, and punctuation', () => {
  assert.equal(normalizeAnswer('  KERTE-minde! '), 'kerteminde');
  assert.equal(matchesAnswer('Kerte Minde', ['kerteminde', 'kerte minde']), true);
});

test('accepts Danish and English answers for the name puzzles', () => {
  assert.equal(matchesAnswer('GREAT', ['stor', 'big', 'great']), true);
  assert.equal(matchesAnswer('north', ['nord', 'north']), true);
});

test('validates only supported persisted state', () => {
  assert.equal(isValidSavedState({ ...initialState, scene: 'unknown' }, 10), false);
  assert.equal(isValidSavedState({ ...initialState, packingIndex: 10 }, 10), true);
  assert.equal(isValidSavedState({ ...initialState, packingIndex: 11 }, 10), false);
  assert.equal(isValidSavedState({ ...initialState, unlockedClueIds: ['not-a-clue'] }, 10), false);
});
