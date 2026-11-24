// Garmin Connect Personal API adapter (ADR-06 Decision 2). Jonas pastes a personal API key once; it is stored encrypted
// and exchanged for a 24-hour access token on every sync (no refresh token, the access token is not stored).
//
// The token exchange is documented. The DATA endpoints are not confirmed yet (the Personal Swagger docs need a signed-in
// browser), so the paths default to the business Health API's pull endpoints and can be changed without a code change
// through the function secrets GARMIN_API_BASE, GARMIN_DAILIES_PATH and GARMIN_SLEEPS_PATH. The mapping accepts the
// business data dictionary's field names and the obvious alternatives. Fallback (ADR-06 Decision 2): whatever Garmin does
// not give is filled from Strandparken (a step goal Jonas sets when connecting); a missing sleep endpoint leaves the sleep
// score null instead of failing the sync.
import { HttpError } from '../http.ts';
import type { HealthDb, Who } from './db.ts';
import { addDays, count, day, goal, hasValues, progress } from './normalise.ts';
import { decrypt, encrypt } from './tokens.ts';
import type { FetchContext, HealthDay, HealthSource } from './types.ts';

export const GARMIN_TOKEN =
  'https://personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token';

export interface GarminEndpoints {
  base: string;
  dailies: string;
  sleeps: string;
}

/** Unconfirmed defaults: the business Health API pull paths. Override with secrets once the Swagger docs are checked. */
export function garminEndpointsFromEnv(): GarminEndpoints {
  return {
    base: Deno.env.get('GARMIN_API_BASE') ?? 'https://personal.connectapi.garmin.com',
    dailies: Deno.env.get('GARMIN_DAILIES_PATH') ?? '/wellness-api/rest/dailies',
    sleeps: Deno.env.get('GARMIN_SLEEPS_PATH') ?? '/wellness-api/rest/sleeps',
  };
}

export interface GarminDeps {
  db: HealthDb;
  key: () => Promise<CryptoKey>;
  endpoints: GarminEndpoints;
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  now: () => number;
}

const UA = { 'User-Agent': 'Strandparken/1.0', Accept: 'application/json' };

/** A personal API key: printable, no spaces, 16–512 characters. */
export const isGarminKey = (k: string) => /^[\x21-\x7e]{16,512}$/.test(k);

/** Key → 24 h access token. A rejected key (expired or deleted in Garmin Connect) is `reconnect`. */
export async function garminAccessToken(deps: Pick<GarminDeps, 'fetch'>, apiKey: string): Promise<string> {
  let res: Response;
  try {
    res = await deps.fetch(GARMIN_TOKEN, { method: 'POST', headers: { ...UA, Authorization: `ApiKey ${apiKey}` } });
  } catch {
    throw new HttpError(502, 'upstream');
  }
  if (res.status === 400 || res.status === 401 || res.status === 403) throw new HttpError(409, 'reconnect');
  if (!res.ok) throw new HttpError(502, 'upstream');
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const token = body?.access_token ?? body?.accessToken ?? body?.token;
  if (typeof token !== 'string' || !token) throw new HttpError(502, 'upstream');
  return token;
}

/** Checks the key with one token exchange, then stores it encrypted (never returned to the browser). */
export async function garminConnect(deps: GarminDeps, who: Who, apiKey: string, stepGoal: number | null): Promise<void> {
  if (!isGarminKey(apiKey)) throw new HttpError(400, 'bad_key');
  await garminAccessToken(deps, apiKey);
  await deps.db.putTokens(who, 'garmin', { apiKey: await encrypt(apiKey, await deps.key()) });
  await deps.db.upsertConnection(who, 'garmin', { stepGoal });
}

type Daily = Record<string, unknown>;

const pick = (o: Record<string, unknown> | undefined, ...paths: string[]): unknown => {
  for (const p of paths) {
    let v: unknown = o;
    for (const part of p.split('.')) v = v && typeof v === 'object' ? (v as Record<string, unknown>)[part] : undefined;
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
};

/** Maps daily and sleep summaries to days in [from, to]. Later summaries for the same date win (Garmin re-sends updates). */
export function mapGarmin(dailies: Daily[], sleeps: Daily[], from: string, to: string, fallbackGoal: number | null, at: Date): HealthDay[] {
  const byDay = new Map<string, { daily?: Daily; sleep?: Daily }>();
  for (const d of dailies) {
    const date = pick(d, 'calendarDate');
    if (typeof date === 'string') byDay.set(date, { ...byDay.get(date), daily: d });
  }
  for (const s of sleeps) {
    const date = pick(s, 'calendarDate');
    if (typeof date === 'string') byDay.set(date, { ...byDay.get(date), sleep: s });
  }
  return [...byDay]
    .filter(([d]) => d >= from && d <= to)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => {
      const steps = count(pick(v.daily, 'steps', 'totalSteps'));
      const target = goal(pick(v.daily, 'stepsGoal', 'dailyStepGoal', 'stepGoal')) ?? (v.daily ? goal(fallbackGoal) : null);
      return day('garmin', date, {
        steps,
        activity_goal: target,
        activity_goal_unit: 'steps',
        activity_progress: target === null ? null : progress(steps, target),
        sleep_score: pick(v.sleep, 'overallSleepScore.value', 'sleepScores.overall.value', 'sleepScore', 'overallSleepScore') as number,
      }, at);
    })
    .filter(hasValues);
}

/** One summary endpoint over [from, to], in 24 h upload windows (the Health API's limit). 'missing' when the path does not exist. */
async function summaries(deps: GarminDeps, token: string, path: string, from: string, to: string): Promise<Daily[] | 'missing'> {
  const out: Daily[] = [];
  const start = Date.parse(`${addDays(from, -1)}T00:00:00Z`) / 1000;
  const end = Math.min(Math.floor(deps.now() / 1000), Date.parse(`${addDays(to, 1)}T23:59:59Z`) / 1000);
  for (let t = start; t < end; t += 86_400) {
    const q = new URLSearchParams({ uploadStartTimeInSeconds: String(t), uploadEndTimeInSeconds: String(Math.min(t + 86_400, end)) });
    let res: Response;
    try {
      res = await deps.fetch(`${deps.endpoints.base}${path}?${q}`, { headers: { ...UA, Authorization: `Bearer ${token}` } });
    } catch {
      throw new HttpError(502, 'upstream');
    }
    if (res.status === 404 || res.status === 405) return 'missing';
    if (res.status === 401 || res.status === 403) throw new HttpError(409, 'reconnect');
    if (res.status === 429) throw new HttpError(429, 'rate_limited');
    if (!res.ok) throw new HttpError(502, 'upstream');
    const body = await res.json().catch(() => null);
    const list = Array.isArray(body) ? body : Array.isArray((body as { data?: unknown })?.data) ? (body as { data: unknown[] }).data : null;
    if (!list) throw new HttpError(502, 'garmin_shape');
    out.push(...(list as Daily[]));
  }
  return out;
}

export function garminSource(deps: GarminDeps): HealthSource {
  return {
    id: 'garmin',
    async fetchDays(ctx: FetchContext) {
      const who = { householdId: ctx.householdId, person: ctx.person };
      const row = await deps.db.getTokens(who, 'garmin');
      if (!row?.apiKey) throw new HttpError(409, 'reconnect');
      const token = await garminAccessToken(deps, await decrypt(row.apiKey, await deps.key()));
      const [conn] = await deps.db.connections(who).then((cs) => cs.filter((c) => c.source === 'garmin'));
      const dailies = await summaries(deps, token, deps.endpoints.dailies, ctx.from, ctx.to);
      const sleeps = await summaries(deps, token, deps.endpoints.sleeps, ctx.from, ctx.to);
      // Neither path exists: the Personal API differs from the defaults. Set GARMIN_*_PATH (see config.toml).
      if (dailies === 'missing' && sleeps === 'missing') throw new HttpError(502, 'garmin_endpoint');
      return mapGarmin(dailies === 'missing' ? [] : dailies, sleeps === 'missing' ? [] : sleeps, ctx.from, ctx.to, conn?.stepGoal ?? null, new Date(deps.now()));
    },
  };
}
