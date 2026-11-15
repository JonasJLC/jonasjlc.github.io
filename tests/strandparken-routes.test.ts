import assert from 'node:assert/strict';
import test from 'node:test';
import { hrefFor, labels, parseHash, views } from '../src/components/strandparken/lib/routes.ts';

test('the five views, in bottom-bar order', () => {
  assert.deepEqual([...views], ['hjem', 'madplan', 'indkob', 'sundhed', 'opskrifter']);
  assert.deepEqual(views.map((v) => labels[v]), ['Hjem', 'Madplan', 'Indkøb', 'Sundhed', 'Opskrifter']);
});

test('an empty, bare or unknown hash opens Hjem', () => {
  assert.equal(parseHash(''), 'hjem');
  assert.equal(parseHash('#'), 'hjem');
  assert.equal(parseHash('#ukendt'), 'hjem');
  assert.equal(parseHash('#/madplan'), 'hjem');
});

test('every view round-trips through its href', () => {
  for (const v of views) {
    assert.equal(hrefFor(v), `#${v}`);
    assert.equal(parseHash(hrefFor(v)), v);
  }
});

test('a hash without the leading # also parses', () => {
  assert.equal(parseHash('madplan'), 'madplan');
});

test('a query string after the view is ignored', () => {
  assert.equal(parseHash('#madplan?code=abc123'), 'madplan');
  assert.equal(parseHash('#?code=abc123'), 'hjem');
});

test('Indkøb is also reachable by its Danish spelling, and case does not matter', () => {
  assert.equal(parseHash('#indkøb'), 'indkob');
  assert.equal(parseHash('#ind%6B%C3%B8b'), 'indkob');
  assert.equal(parseHash('#Sundhed'), 'sundhed');
});

test('a malformed percent escape falls back to Hjem instead of throwing', () => {
  assert.equal(parseHash('#%E0%A4%A'), 'hjem');
});
