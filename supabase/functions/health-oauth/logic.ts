// health-oauth (idea 10 Task 5, ADR-06): connecting and disconnecting health sources. Signed-in actions go through the
// shared guard; the Oura callback is a plain GET from Oura's redirect and is authenticated by the sealed `state` alone.
//   oura-start   → the Oura authorise URL; `state` seals {household, person, PKCE verifier, return origin, expiry}.
//   callback     → verify state, exchange the code (with the verifier), store tokens encrypted, redirect to the app.
//   garmin-key   → check the personal API key with one token exchange, store it encrypted, optional step goal.
//   garmin-goal  → change the Strandparken step goal used when Garmin gives none (ADR-06 Decision 2 fallback).
//   disconnect   → revoke at Oura (best effort), delete tokens and the connection, optionally the fetched rows.
import type { Caller } from '../_shared/guard.ts';
import { HttpError } from '../_shared/http.ts';
import { z } from '../_shared/schema.ts';
import type { HealthDb } from '../_shared/health/db.ts';
import { garminConnect, type GarminDeps } from '../_shared/health/garmin.ts';
import { ouraAuthorizeUrl, ouraConnect, ouraRevoke, type OuraDeps } from '../_shared/health/oura.ts';
import { pkce, seal, unseal } from '../_shared/health/tokens.ts';

export const STATE_TTL_MS = 10 * 60_000;
const APP_ORIGINS = ['https://jonasjlc.github.io', 'http://localhost:4321'];
const DEFAULT_ORIGIN = APP_ORIGINS[0];

const stepGoal = z.number().int().min(100).max(100_000).nullable();
export const Input = z.discriminatedUnion('action', [
  z.object({ action: z.literal('oura-start') }),
  z.object({ action: z.literal('garmin-key'), key: z.string().trim().min(16).max(512), stepGoal: stepGoal.optional() }),
  z.object({ action: z.literal('garmin-goal'), stepGoal }),
  z.object({ action: z.literal('disconnect'), source: z.enum(['oura', 'garmin']), deleteData: z.boolean() }),
]);
export type OAuthInput = z.infer<typeof Input>;

export interface OAuthDeps {
  db: HealthDb;
  oura: OuraDeps;
  garmin: GarminDeps;
  stateKey: () => Promise<CryptoKey>;
  /** The registered redirect URI: `<SUPABASE_URL>/functions/v1/health-oauth`. */
  redirectUri: string;
  now: () => number;
}

type State = { h: string; p: 'a' | 'b'; v: string; o: string; exp: number };

export const appOrigin = (origin: string | null) => (origin && APP_ORIGINS.includes(origin) ? origin : DEFAULT_ORIGIN);

export async function run(deps: OAuthDeps, caller: Caller, input: OAuthInput, origin: string | null): Promise<unknown> {
  const who = { householdId: caller.householdId, person: caller.person };
  switch (input.action) {
    case 'oura-start': {
      const client = deps.oura.client();
      const { verifier, challenge } = await pkce();
      const state = await seal({ h: who.householdId, p: who.person, v: verifier, o: appOrigin(origin), exp: deps.now() + STATE_TTL_MS } satisfies State, await deps.stateKey());
      return { url: ouraAuthorizeUrl({ clientId: client.id, redirectUri: deps.redirectUri, state, challenge }) };
    }
    case 'garmin-key':
      await garminConnect(deps.garmin, who, input.key, input.stepGoal ?? null);
      return { ok: true };
    case 'garmin-goal': {
      const connected = (await deps.db.connections(who)).some((c) => c.source === 'garmin');
      if (!connected) throw new HttpError(404, 'not_connected');
      await deps.db.upsertConnection(who, 'garmin', { stepGoal: input.stepGoal });
      return { ok: true };
    }
    case 'disconnect': {
      if (input.source === 'oura') await ouraRevoke(deps.oura, who);
      await deps.db.deleteTokens(who, input.source);
      await deps.db.deleteConnection(who, input.source);
      if (input.deleteData) await deps.db.deleteDays(who, input.source);
      return { ok: true };
    }
  }
}

const back = (origin: string, query: string) => new Response(null, {
  status: 302,
  headers: { Location: `${origin}/strandparken/#hjem?${query}`, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
});

/** Oura's redirect back. Always answers with a redirect into the app; the error code is short and carries no values. */
export async function callback(deps: OAuthDeps, url: URL): Promise<Response> {
  const sealed = url.searchParams.get('state');
  let state: State | null = null;
  try {
    state = sealed ? await unseal<State>(sealed, await deps.stateKey()) : null;
  } catch {
    return back(DEFAULT_ORIGIN, 'forbind=fejl&kode=not_configured');
  }
  if (!state || typeof state.exp !== 'number' || (state.p !== 'a' && state.p !== 'b') || typeof state.h !== 'string') {
    return back(DEFAULT_ORIGIN, 'forbind=fejl&kode=state');
  }
  const origin = appOrigin(state.o);
  if (state.exp < deps.now()) return back(origin, 'forbind=fejl&kode=expired');
  if (url.searchParams.get('error')) return back(origin, 'forbind=afbrudt');
  const code = url.searchParams.get('code');
  if (!code || code.length > 2048) return back(origin, 'forbind=fejl&kode=bad_request');
  try {
    await ouraConnect(deps.oura, { householdId: state.h, person: state.p }, { code, verifier: state.v, redirectUri: deps.redirectUri });
  } catch (e) {
    return back(origin, `forbind=fejl&kode=${encodeURIComponent(e instanceof HttpError ? e.code : 'internal')}`);
  }
  return back(origin, 'forbundet=oura');
}
