import { getClient } from '../auth';
import { calendarErrorMessage, type CalColor, type CalendarSource, type EventsResult } from './model';

export class CalendarError extends Error {}

/** The `calendar` edge function. Errors become Danish copy; the code stays in `cause`. */
async function call<T>(body: Record<string, unknown>): Promise<T> {
  const c = await getClient();
  const { data, error } = await c.functions.invoke('calendar', { body });
  if (error) {
    let code: string | undefined;
    try {
      code = ((await (error as { context?: Response }).context?.json()) as { error?: string } | undefined)?.error;
    } catch {
      /* no readable body: a network failure or a crashed function */
    }
    throw new CalendarError(calendarErrorMessage(code), { cause: code });
  }
  return data as T;
}

/** The person's own calendars and the other person's shared ones (row-level security does the filtering). */
export async function loadSources(): Promise<CalendarSource[]> {
  const c = await getClient();
  const { data, error } = await c.from('sp_calendar_sources').select('*').order('position');
  if (error) throw error;
  return data;
}

/** Sends the secret address once. The function test-fetches it and stores it encrypted; it never comes back. */
export const addSource = (input: { url: string; label: string; color: CalColor; shared: boolean }) =>
  call<CalendarSource>({ action: 'add', ...input });

export type SourcePatch = Partial<Pick<CalendarSource, 'label' | 'color' | 'shared' | 'enabled' | 'position'>>;

export async function updateSource(id: string, patch: SourcePatch): Promise<CalendarSource> {
  const c = await getClient();
  const { data, error } = await c.from('sp_calendar_sources').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

/** Deleting a calendar also deletes its stored address and cache. */
export async function removeSource(id: string): Promise<void> {
  const c = await getClient();
  const { error } = await c.from('sp_calendar_sources').delete().eq('id', id);
  if (error) throw error;
}

export const loadEvents = () => call<EventsResult>({ action: 'events' });
