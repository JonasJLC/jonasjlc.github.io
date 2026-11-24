import { getClient } from '../auth';
import { keyFromPerson, type Person } from '../people';
import { METRICS, type HealthRow, type Metric, type ProviderId, type SourceRow } from './model';

/** Days in [from, to] for one person, through the database's visibility function (never the table directly). */
export async function loadHealth(person: Person, from: string, to: string): Promise<HealthRow[]> {
  const c = await getClient();
  const { data, error } = await c.rpc('sp_health_for', { p_person: keyFromPerson(person), p_from: from, p_to: to });
  if (error) throw error;
  return data ?? [];
}

/** Both people's connected sources; the other person's come without error or step goal. */
export async function loadSources(): Promise<SourceRow[]> {
  const c = await getClient();
  const { data, error } = await c.rpc('sp_health_sources');
  if (error) throw error;
  return data ?? [];
}

export async function loadSharing(): Promise<{ person: string; metric: string; shared: boolean }[]> {
  const c = await getClient();
  const { data, error } = await c.from('sp_health_sharing').select('person, metric, shared');
  if (error) throw error;
  return data;
}

/** One switch (idea 11 uses this). Takes effect at once: `sp_health_for` reads the row on every call. */
export async function setSharing(householdId: string, person: Person, metric: Metric, shared: boolean): Promise<void> {
  const c = await getClient();
  const { error } = await c.from('sp_health_sharing').upsert(
    { household_id: householdId, person: keyFromPerson(person), metric, shared },
    { onConflict: 'household_id,person,metric' },
  );
  if (error) throw error;
}

/** The confirmation step (Q6): writes all four rows in one request. */
export async function saveSharing(householdId: string, person: Person, values: Record<Metric, boolean>): Promise<void> {
  const c = await getClient();
  const rows = METRICS.map((metric) => ({ household_id: householdId, person: keyFromPerson(person), metric, shared: values[metric] }));
  const { error } = await c.from('sp_health_sharing').upsert(rows, { onConflict: 'household_id,person,metric' });
  if (error) throw error;
}

/** The signed-in person's own period starts, newest first. */
export async function loadPeriodStarts(): Promise<{ id: string; period_start: string }[]> {
  const c = await getClient();
  const { data, error } = await c.from('sp_cycle_log').select('id, period_start').order('period_start', { ascending: false }).limit(12);
  if (error) throw error;
  return data;
}

/** "Første dag i menstruation" (D39). A second tap on the same day is not an error. */
export async function logPeriodStart(householdId: string, person: Person, date: string): Promise<void> {
  const c = await getClient();
  const { error } = await c.from('sp_cycle_log').upsert(
    { household_id: householdId, person: keyFromPerson(person), period_start: date },
    { onConflict: 'household_id,person,period_start', ignoreDuplicates: true },
  );
  if (error) throw error;
}

export async function deletePeriodStart(id: string): Promise<void> {
  const c = await getClient();
  const { error } = await c.from('sp_cycle_log').delete().eq('id', id);
  if (error) throw error;
}

/** A function call's error code (`reconnect`, `not_configured`, …), or `network`. */
async function call<T>(fn: 'health-sync' | 'health-oauth', body: Record<string, unknown>): Promise<T> {
  const c = await getClient();
  const { data, error } = await c.functions.invoke(fn, { body });
  if (error) {
    let code = 'network';
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try { code = ((await ctx.json()) as { error?: string }).error ?? code; } catch { /* keep network */ }
    }
    throw new HealthCallError(code);
  }
  return data as T;
}

export class HealthCallError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = 'HealthCallError';
  }
}

export const syncHealth = (force = false) => call<{ synced: number; skipped: number; failed: number }>('health-sync', { mode: 'self', force });
export const startOura = () => call<{ url: string }>('health-oauth', { action: 'oura-start' });
export const saveGarminKey = (key: string, stepGoal: number | null) => call<{ ok: true }>('health-oauth', { action: 'garmin-key', key, stepGoal });
export const saveGarminGoal = (stepGoal: number | null) => call<{ ok: true }>('health-oauth', { action: 'garmin-goal', stepGoal });
export const disconnectSource = (source: ProviderId, deleteData: boolean) => call<{ ok: true }>('health-oauth', { action: 'disconnect', source, deleteData });
