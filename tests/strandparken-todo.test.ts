import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cleanNote, cleanTitle, dueLabel, filterTodos, groupTodos, isOverdue, newTodoOwner, type Owner, type Todo,
} from '../src/components/strandparken/lib/todo/model.ts';

const today = '2026-11-24'; // a Tuesday

let n = 0;
const todo = (t: Partial<Todo> = {}): Todo => ({
  id: `t${n++}`, household_id: 'h', title: 'X', owner: 'both', due_date: null, note: null,
  completed_at: null, completed_by: null, created_at: '2026-11-20T10:00:00Z', updated_at: '2026-11-20T10:00:00Z', created_by: null,
  ...t,
});

test('groupTodos: open with a date go to snart, soonest first, ties by created_at', () => {
  const a = todo({ title: 'a', due_date: '2026-11-30', created_at: '2026-11-01T00:00:00Z' });
  const b = todo({ title: 'b', due_date: '2026-11-25', created_at: '2026-11-02T00:00:00Z' });
  const c = todo({ title: 'c', due_date: '2026-11-25', created_at: '2026-11-01T00:00:00Z' });
  const late = todo({ title: 'late', due_date: '2026-11-01' });
  const g = groupTodos([a, b, c, late], today);
  assert.deepEqual(g.snart.map((t) => t.title), ['late', 'c', 'b', 'a']);
  assert.equal(g.naarDerErTid.length, 0);
});

test('groupTodos: open without a date go to naarDerErTid, newest first', () => {
  const old = todo({ title: 'old', created_at: '2026-11-01T00:00:00Z' });
  const fresh = todo({ title: 'new', created_at: '2026-11-23T00:00:00Z' });
  assert.deepEqual(groupTodos([old, fresh], today).naarDerErTid.map((t) => t.title), ['new', 'old']);
});

test('groupTodos: klaret holds the last 30 days, newest first; older ones are left out', () => {
  const done = (title: string, at: string) => todo({ title, completed_at: at, completed_by: 'u', due_date: '2026-11-01' });
  const g = groupTodos([
    done('recent', '2026-11-23T08:00:00Z'),
    done('newest', '2026-11-24T08:00:00Z'),
    done('edge', '2026-10-24T22:30:00Z'), // 25 Oct in Copenhagen: inside the window
    done('ancient', '2026-10-20T08:00:00Z'),
  ], today);
  assert.deepEqual(g.klaret.map((t) => t.title), ['newest', 'recent', 'edge']);
  assert.equal(g.snart.length, 0);
});

test('isOverdue: before today only, never when done', () => {
  assert.equal(isOverdue(todo({ due_date: '2026-11-23' }), today), true);
  assert.equal(isOverdue(todo({ due_date: today }), today), false);
  assert.equal(isOverdue(todo({ due_date: '2026-11-25' }), today), false);
  assert.equal(isOverdue(todo({ due_date: null }), today), false);
  assert.equal(isOverdue(todo({ due_date: '2026-11-01', completed_at: '2026-11-02T00:00:00Z', completed_by: 'u' }), today), false);
});

test('dueLabel: today, tomorrow, weekday within six days, otherwise the date', () => {
  assert.equal(dueLabel(today, today), 'i dag');
  assert.equal(dueLabel('2026-11-25', today), 'i morgen');
  assert.equal(dueLabel('2026-11-28', today), 'lør');
  assert.equal(dueLabel('2026-11-30', today), 'man');
  assert.equal(dueLabel('2026-12-01', today), '1. dec');
  assert.equal(dueLabel('2026-11-30', '2026-11-20'), '30. nov');
  assert.equal(dueLabel('2026-11-23', today), '23. nov');
});

test('filterTodos: none selected shows all; chips combine with OR', () => {
  const list = [todo({ owner: 'a' }), todo({ owner: 'b' }), todo({ owner: 'both' })];
  const owners = (sel: Owner[]) => filterTodos(list, new Set(sel)).map((t) => t.owner);
  assert.deepEqual(owners([]), ['a', 'b', 'both']);
  assert.deepEqual(owners(['a']), ['a']);
  assert.deepEqual(owners(['both']), ['both']);
  assert.deepEqual(owners(['a', 'both']), ['a', 'both']);
});

test('newTodoOwner: one chip picks the owner, otherwise Fælles', () => {
  assert.equal(newTodoOwner(new Set()), 'both');
  assert.equal(newTodoOwner(new Set<Owner>(['b'])), 'b');
  assert.equal(newTodoOwner(new Set<Owner>(['a', 'b'])), 'both');
});

test('cleanTitle trims, collapses spaces, cuts at 200 and refuses empty', () => {
  assert.equal(cleanTitle('  Ring   til\tVVS  '), 'Ring til VVS');
  assert.equal(cleanTitle('x'.repeat(250))?.length, 200);
  assert.equal(cleanTitle('   '), null);
  assert.equal(cleanTitle(''), null);
});

test('cleanNote trims, keeps line breaks, cuts at 1000 and turns empty into null', () => {
  assert.equal(cleanNote('  a\nb  '), 'a\nb');
  assert.equal(cleanNote('   '), null);
  assert.equal(cleanNote('x'.repeat(1200))?.length, 1000);
});
