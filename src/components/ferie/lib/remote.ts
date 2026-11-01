import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from './supabase-config';

export const remoteEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY);

export interface RemoteRow {
  version: number;
  data: unknown;
}

export type RemoteLoad =
  | { status: 'no-access' }
  | { status: 'ok'; householdId: string; row: RemoteRow | null };

let clientPromise: Promise<SupabaseClient> | null = null;

/** Loaded lazily so the library only downloads when sync is used. */
export function getClient(): Promise<SupabaseClient> {
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }),
  );
  return clientPromise;
}

/** Finds the signed-in user's household and its shared state (null row = nothing saved yet). */
export async function fetchRemote(): Promise<RemoteLoad> {
  const c = await getClient();
  const m = await c.from('household_members').select('household_id').limit(1).maybeSingle();
  if (m.error) throw m.error;
  if (!m.data) return { status: 'no-access' };
  const householdId = m.data.household_id as string;
  const s = await c.from('ferie_state').select('version,data').eq('household_id', householdId).maybeSingle();
  if (s.error) throw s.error;
  return { status: 'ok', householdId, row: s.data ? { version: s.data.version as number, data: s.data.data } : null };
}

/** First save for a household. Returns false if someone else created the row first. */
export async function createRemote(householdId: string, data: unknown): Promise<boolean> {
  const c = await getClient();
  const { error } = await c.from('ferie_state').insert({ household_id: householdId, data });
  if (!error) return true;
  if (error.code === '23505') return false;
  throw error;
}

/** Saves only if the stored version still matches what we read; otherwise reports a conflict. */
export async function pushRemote(
  householdId: string,
  version: number,
  data: unknown,
): Promise<{ ok: true; version: number } | { ok: false }> {
  const c = await getClient();
  const { data: rows, error } = await c
    .from('ferie_state')
    .update({ data })
    .eq('household_id', householdId)
    .eq('version', version)
    .select('version');
  if (error) throw error;
  return rows && rows.length > 0 ? { ok: true, version: rows[0].version as number } : { ok: false };
}

export async function subscribeRemote(householdId: string, onRow: (row: RemoteRow) => void): Promise<() => void> {
  const c = await getClient();
  const channel = c
    .channel(`ferie:${householdId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'ferie_state', filter: `household_id=eq.${householdId}` },
      (payload) => onRow(payload.new as RemoteRow),
    )
    .subscribe();
  return () => {
    void c.removeChannel(channel);
  };
}

/** Starts Google sign-in; the browser leaves the page and returns to /ferie/ signed in. */
export async function signInWithGoogle(): Promise<string | null> {
  const c = await getClient();
  const { error } = await c.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${location.origin}/ferie/`, queryParams: { prompt: 'select_account' } },
  });
  return error ? error.message : null;
}

export async function signOut(): Promise<void> {
  const c = await getClient();
  await c.auth.signOut();
}
