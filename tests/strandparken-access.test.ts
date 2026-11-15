import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAccess } from '../src/components/strandparken/lib/access.ts';
import { keyFromPerson, personFromKey } from '../src/components/strandparken/lib/people.ts';

test('person keys follow /ferie: a is Camilla, b is Jonas', () => {
  assert.equal(personFromKey('a'), 'camilla');
  assert.equal(personFromKey('b'), 'jonas');
  assert.equal(keyFromPerson('camilla'), 'a');
  assert.equal(keyFromPerson('jonas'), 'b');
});

test('an unknown person key maps to nobody', () => {
  for (const k of [null, undefined, '', 'c', 'A', 1]) assert.equal(personFromKey(k), null);
});

test('a member with a person key is ready', () => {
  assert.deepEqual(resolveAccess({ household_id: 'h1', person: 'b' }), { status: 'ready', householdId: 'h1', person: 'jonas' });
});

test('no membership, or one without a known person, is no-access', () => {
  assert.deepEqual(resolveAccess(null), { status: 'no-access' });
  assert.deepEqual(resolveAccess(undefined), { status: 'no-access' });
  assert.deepEqual(resolveAccess({ household_id: 'h1', person: null }), { status: 'no-access' });
  assert.deepEqual(resolveAccess({ household_id: 'h1', person: 'x' }), { status: 'no-access' });
  assert.deepEqual(resolveAccess({ person: 'a' }), { status: 'no-access' });
});
