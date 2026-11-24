import type { Tables } from '../../../../lib/supabase/database.types.ts';
import { addDays, dayOfMonth, todayIso, weekdayShort, type IsoDate } from '../madplan/dates.ts';
import type { Person } from '../people.ts';

export type Todo = Tables<'sp_todos'>;

/** `a` Camilla, `b` Jonas (the `household_members.person` keys), `both` Fælles. */
export type Owner = 'a' | 'b' | 'both';
export const owners: { value: Owner; label: string }[] = [
  { value: 'a', label: 'Camilla' },
  { value: 'b', label: 'Jonas' },
  { value: 'both', label: 'Fælles' },
];
export const ownerLabel = (owner: string) => owners.find((o) => o.value === owner)?.label ?? 'Fælles';
export const asOwner = (value: string): Owner => (value === 'a' || value === 'b' ? value : 'both');
export const ownerPerson = (owner: string): Person | null => (owner === 'a' ? 'camilla' : owner === 'b' ? 'jonas' : null);

/** How long a completed to-do stays visible under "Klaret". */
export const klaretDays = 30;

export const TITLE_MAX = 200;
export const NOTE_MAX = 1000;

export type TodoGroups = { snart: Todo[]; naarDerErTid: Todo[]; klaret: Todo[] };

const byCreated = (a: Todo, b: Todo) => a.created_at.localeCompare(b.created_at);

/**
 * Snart: open with a due date, soonest first (ties by when they were added). Når der er tid: open without a date, newest
 * first. Klaret: completed within the last 30 days (Copenhagen dates), newest first; older ones are left out.
 */
export function groupTodos(todos: Todo[], today: IsoDate): TodoGroups {
  const since = addDays(today, -klaretDays);
  const snart: Todo[] = [];
  const naarDerErTid: Todo[] = [];
  const klaret: Todo[] = [];
  for (const t of todos) {
    if (t.completed_at) {
      if (todayIso(new Date(t.completed_at)) >= since) klaret.push(t);
    } else if (t.due_date) snart.push(t);
    else naarDerErTid.push(t);
  }
  snart.sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? '') || byCreated(a, b));
  naarDerErTid.sort((a, b) => byCreated(b, a));
  klaret.sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));
  return { snart, naarDerErTid, klaret };
}

/** An open to-do whose date has passed. A done to-do is never overdue. */
export const isOverdue = (t: Pick<Todo, 'due_date' | 'completed_at'>, today: IsoDate) =>
  !t.completed_at && !!t.due_date && t.due_date < today;

const monthShort = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
/** "30. nov". */
export const shortDate = (iso: IsoDate) => `${dayOfMonth(iso)}. ${monthShort[Number(iso.slice(5, 7)) - 1]}`;

/** "i dag", "i morgen", a weekday ("lør") within the next six days, otherwise the date ("30. nov"). Past dates keep the date. */
export function dueLabel(due: IsoDate, today: IsoDate): string {
  if (due === today) return 'i dag';
  if (due === addDays(today, 1)) return 'i morgen';
  if (due > today && due <= addDays(today, 6)) return weekdayShort(due).toLowerCase();
  return shortDate(due);
}

/** No chip selected shows everything; several chips combine with OR. */
export const filterTodos = (todos: Todo[], selected: ReadonlySet<Owner>) =>
  selected.size === 0 ? todos : todos.filter((t) => selected.has(asOwner(t.owner)));

/** Exactly one selected chip counts as choosing that owner for new to-dos; otherwise Fælles (open question 1, default). */
export const newTodoOwner = (selected: ReadonlySet<Owner>): Owner => (selected.size === 1 ? [...selected][0] : 'both');

/** Trimmed, single-spaced, at most 200 characters; `null` when nothing is left. */
export function cleanTitle(raw: string): string | null {
  const s = raw.trim().replace(/\s+/g, ' ').slice(0, TITLE_MAX).trim();
  return s ? s : null;
}

/** Trimmed, at most 1000 characters (line breaks kept); `null` when empty. */
export function cleanNote(raw: string): string | null {
  const s = raw.trim().slice(0, NOTE_MAX);
  return s ? s : null;
}
