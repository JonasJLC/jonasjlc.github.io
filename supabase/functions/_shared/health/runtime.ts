// The real adapter dependencies, built from the platform variables and function secrets. Every secret is read lazily, so a
// function with missing secrets still starts and answers `503 not_configured` only where the secret is needed.
import { adminDb, type HealthDb } from './db.ts';
import { garminEndpointsFromEnv, garminSource, type GarminDeps } from './garmin.ts';
import { ouraClientFromEnv, ouraSource, type OuraDeps } from './oura.ts';
import { tokenKey } from './tokens.ts';
import type { HealthSource, ProviderId } from './types.ts';

export interface Runtime {
  db: HealthDb;
  oura: OuraDeps;
  garmin: GarminDeps;
  sources: Record<ProviderId, HealthSource>;
}

export function runtime(): Runtime {
  const db = adminDb();
  let key: Promise<CryptoKey> | null = null;
  const getKey = () => (key ??= tokenKey(Deno.env.get('SP_TOKEN_KEY')).catch((e) => { key = null; throw e; }));
  const now = () => Date.now();
  const fetchWithTimeout = (url: string, init?: RequestInit) => fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  const oura: OuraDeps = {
    db,
    key: getKey,
    client: ouraClientFromEnv,
    fetch: fetchWithTimeout,
    now,
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
  const garmin: GarminDeps = { db, key: getKey, endpoints: garminEndpointsFromEnv(), fetch: fetchWithTimeout, now };
  return { db, oura, garmin, sources: { oura: ouraSource(oura), garmin: garminSource(garmin) } };
}
