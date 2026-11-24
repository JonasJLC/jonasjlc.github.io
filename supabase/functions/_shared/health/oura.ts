// Oura API v2 adapter (ADR-06 Decision 1). Camilla connects once with the OAuth2 authorisation code flow + PKCE (scope
// `daily`); the function keeps the tokens encrypted and refreshes them itself. Oura refresh tokens are single-use, so a
// refresh first takes a lease in the database (advisory lock inside the RPC) and stores the new pair only if nobody
// overtook it; a run that finds the lease taken waits for the winner's pair instead of spending the token again.
import { HttpError } from '../http.ts';
import type { HealthDb, Who } from './db.ts';
import { addDays, day, goal, hasValues, progress } from './normalise.ts';
import { decrypt, encrypt } from './tokens.ts';
import type { FetchContext, HealthDay, HealthSource } from './types.ts';

export const OURA_AUTHORIZE = 'https://cloud.ouraring.com/oauth/authorize';
export const OURA_TOKEN = 'https://api.ouraring.com/oauth/token';
export const OURA_REVOKE = 'https://api.ouraring.com/oauth/revoke';
export const OURA_API = 'https://api.ouraring.com/v2/usercollection';
export const OURA_SCOPE = 'daily';
const UA = { 'User-Agent': 'Strandparken/1.0' };
/** How long one run may hold the refresh lease. */
export const LEASE_SECONDS = 30;
/** Refresh when the access token has less than this left. */
const MARGIN_MS = 60_000;

export interface OuraClient {
  id: string;
  secret: string;
}

export interface OuraDeps {
  db: HealthDb;
  key: () => Promise<CryptoKey>;
  client: () => OuraClient;
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  now: () => number;
  wait: (ms: number) => Promise<void>;
}

/** The OAuth client from the function secrets; `503 not_configured` until they are set. */
export function ouraClientFromEnv(): OuraClient {
  const id = Deno.env.get('OURA_CLIENT_ID');
  const secret = Deno.env.get('OURA_CLIENT_SECRET');
  if (!id || !secret) throw new HttpError(503, 'not_configured');
  return { id, secret };
}

export function ouraAuthorizeUrl(o: { clientId: string; redirectUri: string; state: string; challenge: string }): string {
  const u = new URL(OURA_AUTHORIZE);
  u.search = new URLSearchParams({
    response_type: 'code',
    client_id: o.clientId,
    redirect_uri: o.redirectUri,
    scope: OURA_SCOPE,
    state: o.state,
    code_challenge: o.challenge,
    code_challenge_method: 'S256',
  }).toString();
  return u.toString();
}

type Grant = { access: string; refresh: string; expiresAt: string };

async function tokenRequest(deps: OuraDeps, form: Record<string, string>): Promise<Grant> {
  const c = deps.client();
  let res: Response;
  try {
    res = await deps.fetch(OURA_TOKEN, {
      method: 'POST',
      headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ ...form, client_id: c.id, client_secret: c.secret }).toString(),
    });
  } catch {
    throw new HttpError(502, 'upstream');
  }
  // 400/401 is invalid_grant: the code or refresh token is spent or revoked. Only a new connect fixes that.
  if (res.status === 400 || res.status === 401) throw new HttpError(409, 'reconnect');
  if (!res.ok) throw new HttpError(502, 'upstream');
  const body = (await res.json().catch(() => null)) as { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown } | null;
  if (typeof body?.access_token !== 'string' || typeof body.refresh_token !== 'string') throw new HttpError(502, 'upstream');
  const ttl = typeof body.expires_in === 'number' && body.expires_in > 0 ? body.expires_in : 86_400;
  return { access: body.access_token, refresh: body.refresh_token, expiresAt: new Date(deps.now() + ttl * 1000).toISOString() };
}

/** Code → tokens, stored encrypted (connect). */
export async function ouraConnect(deps: OuraDeps, who: Who, o: { code: string; verifier: string; redirectUri: string }): Promise<void> {
  const g = await tokenRequest(deps, { grant_type: 'authorization_code', code: o.code, redirect_uri: o.redirectUri, code_verifier: o.verifier });
  const key = await deps.key();
  await deps.db.putTokens(who, 'oura', {
    access: await encrypt(g.access, key),
    refresh: await encrypt(g.refresh, key),
    expiresAt: g.expiresAt,
    scopes: [OURA_SCOPE],
  });
  await deps.db.upsertConnection(who, 'oura', {});
}

/**
 * A usable access token. Refreshes when it is about to expire or when `stale` (the token the caller just saw rejected) is
 * still the stored one. Never spends a refresh token while another run holds the lease.
 */
export async function ouraAccessToken(deps: OuraDeps, who: Who, stale?: string): Promise<string> {
  const key = await deps.key();
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await deps.db.getTokens(who, 'oura');
    if (!row?.access || !row.refresh) throw new HttpError(409, 'reconnect');
    const access = await decrypt(row.access, key);
    const fresh = row.expiresAt !== null && Date.parse(row.expiresAt) - deps.now() > MARGIN_MS;
    if (fresh && access !== stale) return access;

    const lease = await deps.db.claimRefresh(who, 'oura', LEASE_SECONDS);
    if (!lease.claimed) {
      // Another run is refreshing: wait for its pair.
      await deps.wait(1500);
      continue;
    }
    // The lease returns the refresh token current under the lock, so spending it is safe even if the row changed since the read.
    if (!lease.refresh) throw new HttpError(409, 'reconnect');
    const g = await tokenRequest(deps, { grant_type: 'refresh_token', refresh_token: await decrypt(lease.refresh, key) });
    const stored = await deps.db.storeRefresh(who, 'oura', lease.version, {
      access: await encrypt(g.access, key),
      refresh: await encrypt(g.refresh, key),
      expiresAt: g.expiresAt,
    });
    if (!stored) throw new HttpError(409, 'busy');
    return g.access;
  }
  throw new HttpError(409, 'busy');
}

/** Best effort: Oura forgets the grant. A failure here must not stop the local delete. */
export async function ouraRevoke(deps: OuraDeps, who: Who): Promise<void> {
  try {
    const row = await deps.db.getTokens(who, 'oura');
    if (!row?.access) return;
    const access = await decrypt(row.access, await deps.key());
    await deps.fetch(`${OURA_REVOKE}?${new URLSearchParams({ access_token: access })}`, { headers: UA });
  } catch {
    // ignored on purpose
  }
}

type OuraSleep = { day?: unknown; score?: unknown };
type OuraActivity = { day?: unknown; steps?: unknown; active_calories?: unknown; target_calories?: unknown };

/** Maps the two collections to days in [from, to]. Activity: goal = target_calories (kcal), progress = active / target. */
export function mapOura(sleep: OuraSleep[], activity: OuraActivity[], from: string, to: string, at: Date): HealthDay[] {
  const byDay = new Map<string, { sleep?: OuraSleep; activity?: OuraActivity }>();
  for (const s of sleep) if (typeof s.day === 'string') byDay.set(s.day, { ...byDay.get(s.day), sleep: s });
  for (const a of activity) if (typeof a.day === 'string') byDay.set(a.day, { ...byDay.get(a.day), activity: a });
  return [...byDay]
    .filter(([d]) => d >= from && d <= to)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([d, v]) => {
      const target = goal(v.activity?.target_calories);
      return day('oura', d, {
        sleep_score: v.sleep?.score as number | null,
        steps: v.activity?.steps as number | null,
        activity_goal: target,
        activity_goal_unit: 'kcal',
        activity_progress: target === null ? null : progress(v.activity?.active_calories, target),
      }, at);
    })
    .filter(hasValues);
}

async function collection<T>(deps: OuraDeps, token: string, name: string, from: string, to: string): Promise<T[] | 401> {
  const out: T[] = [];
  let next: string | null = null;
  for (let page = 0; page < 5; page++) {
    const q = new URLSearchParams({ start_date: from, end_date: addDays(to, 1) });
    if (next) q.set('next_token', next);
    let res: Response;
    try {
      res = await deps.fetch(`${OURA_API}/${name}?${q}`, { headers: { ...UA, Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    } catch {
      throw new HttpError(502, 'upstream');
    }
    if (res.status === 401) return 401;
    // 403: no active Oura membership, or the `daily` consent was withdrawn in Oura.
    if (res.status === 403) throw new HttpError(409, 'no_access');
    if (res.status === 429) throw new HttpError(429, 'rate_limited');
    if (!res.ok) throw new HttpError(502, 'upstream');
    const body = (await res.json().catch(() => null)) as { data?: unknown; next_token?: unknown } | null;
    if (!Array.isArray(body?.data)) throw new HttpError(502, 'upstream');
    out.push(...(body.data as T[]));
    next = typeof body.next_token === 'string' && body.next_token ? body.next_token : null;
    if (!next) break;
  }
  return out;
}

export function ouraSource(deps: OuraDeps): HealthSource {
  return {
    id: 'oura',
    async fetchDays(ctx: FetchContext) {
      const who = { householdId: ctx.householdId, person: ctx.person };
      let token = await ouraAccessToken(deps, who);
      for (let attempt = 0; attempt < 2; attempt++) {
        const sleep = await collection<OuraSleep>(deps, token, 'daily_sleep', ctx.from, ctx.to);
        const activity = sleep === 401 ? 401 : await collection<OuraActivity>(deps, token, 'daily_activity', ctx.from, ctx.to);
        if (sleep !== 401 && activity !== 401) return mapOura(sleep, activity, ctx.from, ctx.to, new Date(deps.now()));
        if (attempt === 0) token = await ouraAccessToken(deps, who, token); // refresh once, then try again
      }
      throw new HttpError(409, 'reconnect');
    },
  };
}
