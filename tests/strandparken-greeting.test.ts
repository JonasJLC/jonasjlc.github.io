import assert from 'node:assert/strict';
import test from 'node:test';
import { dateLine, greetingFor } from '../src/components/strandparken/lib/greeting.ts';

const at = (iso: string) => new Date(iso);

test('greeting follows the hour in Europe/Copenhagen, not UTC (winter, UTC+1)', () => {
  assert.equal(greetingFor(at('2026-11-12T03:00:00Z')), 'Godmorgen'); // 04:00
  assert.equal(greetingFor(at('2026-11-12T09:59:00Z')), 'Godmorgen'); // 10:59
  assert.equal(greetingFor(at('2026-11-12T10:00:00Z')), 'Goddag'); // 11:00
  assert.equal(greetingFor(at('2026-11-12T16:59:00Z')), 'Goddag'); // 17:59
  assert.equal(greetingFor(at('2026-11-12T17:00:00Z')), 'Godaften'); // 18:00
  assert.equal(greetingFor(at('2026-11-12T22:59:00Z')), 'Godaften'); // 23:59
  assert.equal(greetingFor(at('2026-11-12T02:59:00Z')), 'Godaften'); // 03:59
});

test('greeting uses summer time too (UTC+2)', () => {
  assert.equal(greetingFor(at('2026-07-01T09:00:00Z')), 'Goddag'); // 11:00 CEST
  assert.equal(greetingFor(at('2026-07-01T08:59:00Z')), 'Godmorgen'); // 10:59 CEST
});

test('date line is Danish, capitalised and uses the Copenhagen date', () => {
  assert.equal(dateLine(at('2026-11-12T10:00:00Z')), 'Torsdag 12. november');
  assert.equal(dateLine(at('2026-11-12T23:30:00Z')), 'Fredag 13. november'); // already past midnight in Copenhagen
  assert.equal(dateLine(at('2026-03-01T12:00:00Z')), 'Søndag 1. marts');
});
