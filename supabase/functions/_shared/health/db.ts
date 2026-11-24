// Database access for the health functions, as the service role. Everything goes through this interface so the logic can be
// tested with an in-memory fake (`fakeHealthDb` in fakes.ts). Tokens are stored as ciphertext only (tokens.ts); the
// private table is reached through service-role-only RPCs (migration `strandparken_health`).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { HttpError } from '../http.ts';
import type { HealthDay, PersonKey, ProviderId } from './types.ts';

export interface Who {
  householdId: string;
  person: PersonKey;
}

/** One stored grant, encrypted. `version` goes up on every write, so a refresh can tell it was overtaken. */
export interface TokenRow {
  access: string | null;
  refresh: string | null;
  apiKey: string | null;
  expiresAt: string | null;
  version: number;
}

export interface Connection extends Who {
  source: ProviderId;
  lastSyncedAt: string | null;
  stepGoal: number | null;
}

export interface HealthDb {
  getTokens(who: Who, provider: ProviderId): Promise<TokenRow | null>;
  /** Replaces the grant (connect). */
  putTokens(who: Who, provider: ProviderId, t: { access?: string | null; refresh?: string | null; apiKey?: string | null; expiresAt?: string | null; scopes?: string[] }): Promise<void>;
  /**
   * Takes the refresh lease under `pg_advisory_xact_lock`: `claimed` is false while another run holds an unexpired lease.
   * Oura refresh tokens are single-use, so only the lease holder may spend one.
   */
  claimRefresh(who: Who, provider: ProviderId, leaseSeconds: number): Promise<{ claimed: boolean; version: number; refresh: string | null }>;
  /** Stores the new pair only if `version` is still current; clears the lease. False when overtaken. */
  storeRefresh(who: Who, provider: ProviderId, version: number, t: { access: string; refresh: string; expiresAt: string }): Promise<boolean>;
  deleteTokens(who: Who, provider: ProviderId): Promise<void>;
  /** Connected sources, for one person or (no argument) for everyone. */
  connections(who?: Who): Promise<Connection[]>;
  upsertConnection(who: Who, source: ProviderId, patch: { stepGoal?: number | null }): Promise<void>;
  setSyncResult(who: Who, source: ProviderId, r: { at: string | null; error: string | null }): Promise<void>;
  deleteConnection(who: Who, source: ProviderId): Promise<void>;
  upsertDays(who: Who, days: HealthDay[]): Promise<void>;
  deleteDays(who: Who, source: ProviderId): Promise<void>;
}

const fail = (what: string) => {
  // The code only: messages can quote values.
  throw new HttpError(500, `db_${what}`);
};

export function adminDb(client?: SupabaseClient): HealthDb {
  const c = client ?? createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const key = (who: Who, provider: ProviderId) => ({ p_household: who.householdId, p_person: who.person, p_provider: provider });
  const one = <T>(data: unknown): T | null => (Array.isArray(data) ? (data[0] ?? null) : (data ?? null)) as T | null;

  return {
    async getTokens(who, provider) {
      const { data, error } = await c.rpc('sp_health_token_get', key(who, provider));
      if (error) fail('tokens');
      const r = one<{ access_ciphertext: string | null; refresh_ciphertext: string | null; api_key_ciphertext: string | null; expires_at: string | null; version: number }>(data);
      return r ? { access: r.access_ciphertext, refresh: r.refresh_ciphertext, apiKey: r.api_key_ciphertext, expiresAt: r.expires_at, version: r.version } : null;
    },
    async putTokens(who, provider, t) {
      const { error } = await c.rpc('sp_health_token_put', {
        ...key(who, provider),
        p_access: t.access ?? null,
        p_refresh: t.refresh ?? null,
        p_api_key: t.apiKey ?? null,
        p_expires_at: t.expiresAt ?? null,
        p_scopes: t.scopes ?? [],
      });
      if (error) fail('tokens');
    },
    async claimRefresh(who, provider, leaseSeconds) {
      const { data, error } = await c.rpc('sp_health_token_claim_refresh', { ...key(who, provider), p_lease_seconds: leaseSeconds });
      if (error) fail('tokens');
      const r = one<{ claimed: boolean; version: number; refresh_ciphertext: string | null }>(data);
      return { claimed: !!r?.claimed, version: r?.version ?? 0, refresh: r?.refresh_ciphertext ?? null };
    },
    async storeRefresh(who, provider, version, t) {
      const { data, error } = await c.rpc('sp_health_token_store_refresh', {
        ...key(who, provider),
        p_version: version,
        p_access: t.access,
        p_refresh: t.refresh,
        p_expires_at: t.expiresAt,
      });
      if (error) fail('tokens');
      return data === true;
    },
    async deleteTokens(who, provider) {
      const { error } = await c.rpc('sp_health_token_delete', key(who, provider));
      if (error) fail('tokens');
    },
    async connections(who) {
      let q = c.from('sp_health_connections').select('household_id, person, source, last_synced_at, step_goal').in('source', ['oura', 'garmin']);
      if (who) q = q.eq('household_id', who.householdId).eq('person', who.person);
      const { data, error } = await q;
      if (error) fail('connections');
      return (data ?? []).map((r) => ({
        householdId: r.household_id,
        person: r.person as PersonKey,
        source: r.source as ProviderId,
        lastSyncedAt: r.last_synced_at,
        stepGoal: r.step_goal,
      }));
    },
    async upsertConnection(who, source, patch) {
      const row: Record<string, unknown> = { household_id: who.householdId, person: who.person, source, last_error: null };
      if (patch.stepGoal !== undefined) row.step_goal = patch.stepGoal;
      const { error } = await c.from('sp_health_connections').upsert(row, { onConflict: 'household_id,person,source' });
      if (error) fail('connections');
    },
    async setSyncResult(who, source, r) {
      const patch: Record<string, unknown> = { last_error: r.error };
      if (r.at) patch.last_synced_at = r.at;
      const { error } = await c.from('sp_health_connections').update(patch)
        .eq('household_id', who.householdId).eq('person', who.person).eq('source', source);
      if (error) fail('connections');
    },
    async deleteConnection(who, source) {
      const { error } = await c.from('sp_health_connections').delete()
        .eq('household_id', who.householdId).eq('person', who.person).eq('source', source);
      if (error) fail('connections');
    },
    async upsertDays(who, days) {
      if (days.length === 0) return;
      const rows = days.map((d) => ({
        household_id: who.householdId,
        person: who.person,
        date: d.date,
        source: d.source,
        sleep_score: d.sleep_score,
        activity_progress: d.activity_progress,
        activity_goal: d.activity_goal,
        activity_goal_unit: d.activity_goal_unit,
        steps: d.steps,
        cycle_day: d.cycle_day,
        synced_at: d.last_synced_at,
      }));
      const { error } = await c.from('sp_health_daily').upsert(rows, { onConflict: 'household_id,person,date,source' });
      if (error) fail('days');
    },
    async deleteDays(who, source) {
      const { error } = await c.from('sp_health_daily').delete()
        .eq('household_id', who.householdId).eq('person', who.person).eq('source', source);
      if (error) fail('days');
    },
  };
}
