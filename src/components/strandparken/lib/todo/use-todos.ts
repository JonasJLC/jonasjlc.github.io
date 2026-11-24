import { useCallback, useEffect, useRef, useState } from 'react';
import { isNetworkError } from '../shopping/repo';
import { subscribeHousehold } from '../realtime';
import type { Owner, Todo } from './model';
import { addTodo, deleteTodo, loadTodos, restoreTodo, setDone, updateTodo, type TodoPatch } from './repo';

export type TodoState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; todos: Todo[] };

const upsert = (todos: Todo[], row: Todo) => (todos.some((t) => t.id === row.id) ? todos.map((t) => (t.id === row.id ? row : t)) : [...todos, row]);
const without = (todos: Todo[], id: string) => todos.filter((t) => t.id !== id);

/**
 * The household's to-dos (idea 5). Every change shows at once and is rolled back if the database refuses it; the
 * returned promise says whether it went through, so the screen can say "Det lykkedes ikke". Changes from the other
 * phone arrive over Realtime and are patched in by id. No offline queue: ADR-09 covers only Indkøb.
 */
export function useTodos(householdId: string | null) {
  const [state, setState] = useState<TodoState>({ status: 'loading' });
  const [offline, setOffline] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const patch = useCallback((fn: (todos: Todo[]) => Todo[]) => {
    setState((s) => (s.status === 'ready' ? { status: 'ready', todos: fn(s.todos) } : s));
  }, []);

  const reload = useCallback(async () => {
    if (!householdId) return;
    try {
      const todos = await loadTodos();
      setState({ status: 'ready', todos });
      setOffline(false);
    } catch (e) {
      if (isNetworkError(e)) setOffline(true);
      setState((s) => (s.status === 'ready' ? s : { status: 'error' }));
    }
  }, [householdId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Back online or back to the front: a live event may have been missed.
  useEffect(() => {
    const go = () => void reload();
    const visible = () => document.visibilityState === 'visible' && go();
    window.addEventListener('online', go);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('online', go);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [reload]);

  useEffect(() => {
    if (!householdId) return;
    let off: (() => void) | undefined;
    let gone = false;
    void subscribeHousehold(householdId, 'sp_todos', (change) => {
      if (change.eventType === 'DELETE') {
        const id = (change.old as Partial<Todo>).id;
        if (id) patch((todos) => without(todos, id));
      } else {
        patch((todos) => upsert(todos, change.new));
      }
    }).then((stop) => {
      if (gone) stop();
      else off = stop;
    }).catch(() => {});
    return () => {
      gone = true;
      off?.();
    };
  }, [householdId, patch]);

  /** Applies `optimistic` now, then runs `send`; on failure puts back what was there before. */
  const run = useCallback(async (optimistic: (todos: Todo[]) => Todo[], send: () => Promise<Todo | void>): Promise<boolean> => {
    const before = stateRef.current.status === 'ready' ? stateRef.current.todos : null;
    patch(optimistic);
    try {
      const row = await send();
      if (row) patch((todos) => upsert(todos, row));
      setOffline(false);
      return true;
    } catch (e) {
      if (isNetworkError(e)) setOffline(true);
      if (before) setState({ status: 'ready', todos: before });
      return false;
    }
  }, [patch]);

  const add = useCallback((title: string, owner: Owner) => {
    if (!householdId) return Promise.resolve(false);
    const now = new Date().toISOString();
    const row: Todo = {
      id: crypto.randomUUID(), household_id: householdId, title, owner, due_date: null, note: null,
      completed_at: null, completed_by: null, created_at: now, updated_at: now, created_by: null,
    };
    return run((todos) => upsert(todos, row), () => addTodo(householdId, { id: row.id, title, owner }));
  }, [householdId, run]);

  const update = useCallback((todo: Todo, changes: TodoPatch) =>
    run((todos) => upsert(todos, { ...todo, ...changes }), () => updateTodo(todo.id, changes)), [run]);

  const toggle = useCallback((todo: Todo, done: boolean) =>
    run(
      (todos) => upsert(todos, { ...todo, completed_at: done ? new Date().toISOString() : null, completed_by: done ? todo.completed_by : null }),
      () => setDone(todo.id, done),
    ), [run]);

  const remove = useCallback((todo: Todo) => run((todos) => without(todos, todo.id), () => deleteTodo(todo.id)), [run]);

  const restore = useCallback((todo: Todo) => run((todos) => upsert(todos, todo), () => restoreTodo(todo)), [run]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    void reload();
  }, [reload]);

  return { state, offline, add, update, toggle, remove, restore, retry };
}
