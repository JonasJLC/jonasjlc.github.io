import { getClient } from '../auth';
import { klaretDays, type Owner, type Todo } from './model';

export type TodoPatch = Partial<Pick<Todo, 'title' | 'owner' | 'due_date' | 'note'>>;

/** Open to-dos, plus those completed in the last 30 days (older ones stay in the table but are not shown). */
export async function loadTodos(): Promise<Todo[]> {
  const c = await getClient();
  const since = new Date(Date.now() - (klaretDays + 1) * 86_400_000).toISOString();
  const { data, error } = await c.from('sp_todos').select('*').or(`completed_at.is.null,completed_at.gte.${since}`).order('created_at');
  if (error) throw error;
  return data;
}

/** The id is made on the phone, so the optimistic row and the stored row are the same to-do. */
export async function addTodo(householdId: string, todo: { id: string; title: string; owner: Owner }): Promise<Todo> {
  const c = await getClient();
  const { data, error } = await c.from('sp_todos').insert({ household_id: householdId, ...todo }).select().single();
  if (error) throw error;
  return data;
}

export async function updateTodo(id: string, patch: TodoPatch): Promise<Todo> {
  const c = await getClient();
  const { data, error } = await c.from('sp_todos').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

/** Tick or untick. The database sets the real `completed_at` and `completed_by`; the values sent only say done or not. */
export async function setDone(id: string, done: boolean): Promise<Todo> {
  const c = await getClient();
  const { data, error } = await c.from('sp_todos').update({ completed_at: done ? new Date().toISOString() : null }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteTodo(id: string): Promise<void> {
  const c = await getClient();
  const { error } = await c.from('sp_todos').delete().eq('id', id);
  if (error) throw error;
}

/** Puts a deleted to-do back with the same id. Audit columns are left to the database (a done to-do is re-stamped by the restorer). */
export async function restoreTodo(row: Todo): Promise<Todo> {
  const c = await getClient();
  const { created_at: _a, updated_at: _b, created_by: _c, completed_by: _d, ...rest } = row;
  const { data, error } = await c.from('sp_todos').insert(rest).select().single();
  if (error) throw error;
  return data;
}
