import assert from 'node:assert/strict';
import test from 'node:test';
import { hrefFor, labels, legacyAlias, listerHref, listerSegment, madplanDay, madplanDayHref, parseHash, queryOf, subPath, views } from '../src/components/strandparken/lib/routes.ts';

test('the five views, in bottom-bar order', () => {
  assert.deepEqual([...views], ['hjem', 'madplan', 'lister', 'sundhed', 'opskrifter']);
  assert.deepEqual(views.map((v) => labels[v]), ['Hjem', 'Madplan', 'Lister', 'Sundhed', 'Opskrifter']);
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

test('queryOf reads the query string after the path, and parseHash and subPath ignore it', () => {
  assert.equal(queryOf('#lister/indkob?for=a,b').get('for'), 'a,b');
  assert.equal(queryOf('#lister/indkob').toString(), '');
  assert.equal(queryOf('').toString(), '');
  assert.equal(parseHash('#lister/indkob?for=a,b'), 'lister');
  assert.deepEqual(subPath('#lister/indkob?for=a,b'), ['indkob']);
});

test('the old Indkøb addresses, in either spelling and any case, open Lister', () => {
  assert.equal(parseHash('#indkob'), 'lister');
  assert.equal(parseHash('#indkøb'), 'lister');
  assert.equal(parseHash('#ind%6B%C3%B8b'), 'lister');
  assert.equal(parseHash('#Indkob'), 'lister');
  assert.equal(parseHash('#Sundhed'), 'sundhed');
});

test('a malformed percent escape falls back to Hjem instead of throwing', () => {
  assert.equal(parseHash('#%E0%A4%A'), 'hjem');
});

test('#hjem/forslag is Hjem with the sub-path forslag', () => {
  assert.equal(parseHash('#hjem/forslag'), 'hjem');
  assert.deepEqual(subPath('#hjem/forslag'), ['forslag']);
  assert.deepEqual(subPath('#hjem'), []);
  assert.deepEqual(subPath('#hjem/forslag?x=1'), ['forslag']);
});

test('old Indkøb links are rewritten to Lister › Indkøb, keeping a query string', () => {
  assert.equal(legacyAlias('#indkob'), '#lister/indkob');
  assert.equal(legacyAlias('#indk%C3%B8b'), '#lister/indkob');
  assert.equal(legacyAlias('#indkøb'), '#lister/indkob');
  assert.equal(legacyAlias('#Indkob'), '#lister/indkob');
  assert.equal(legacyAlias('indkob'), '#lister/indkob');
  assert.equal(legacyAlias('#indkob?x=1'), '#lister/indkob?x=1');
  assert.equal(legacyAlias('#madplan'), null);
  assert.equal(legacyAlias('#lister/indkob'), null);
  assert.equal(legacyAlias(''), null);
  assert.equal(legacyAlias('#%E0%A4%A'), null);
});

test('the Lister segment comes from the sub-path, and anything else is Indkøb', () => {
  assert.equal(listerSegment([]), 'indkob');
  assert.equal(listerSegment(['indkob']), 'indkob');
  assert.equal(listerSegment(['todo']), 'todo');
  assert.equal(listerSegment(['ukendt']), 'indkob');
  assert.equal(listerSegment(['todo', 'x']), 'todo');
});

test('a Lister segment round-trips through its href', () => {
  assert.equal(listerHref('todo'), '#lister/todo');
  assert.equal(listerHref('indkob'), '#lister/indkob');
  for (const s of ['indkob', 'todo'] as const) {
    assert.equal(parseHash(listerHref(s)), 'lister');
    assert.equal(listerSegment(subPath(listerHref(s))), s);
  }
});

test('#madplan/<date>/dag names the day whose sheet opens (idea 6)', () => {
  assert.equal(parseHash('#madplan/2026-11-19/dag'), 'madplan');
  assert.deepEqual(subPath('#madplan/2026-11-19/dag'), ['2026-11-19', 'dag']);
  assert.equal(madplanDayHref('2026-11-19'), '#madplan/2026-11-19/dag');
  assert.equal(madplanDay(subPath(madplanDayHref('2026-11-19'))), '2026-11-19');
  assert.equal(madplanDay(['2026-11-19']), null);
  assert.equal(madplanDay([]), null);
  assert.equal(madplanDay(['2026-02-30', 'dag']), null);
  assert.equal(madplanDay(['i-morgen', 'dag']), null);
});
