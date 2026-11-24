// health-sync (idea 10 Task 4): pulls the last 8 days (7-day trend + today) from every connected source and upserts
// `sp_health_daily`. Two modes:
// - `self`: the signed-in caller, on app open, skipped when the source synced less than 30 minutes ago (unless `force`).
// - `all`: every connected person, from pg_cron with the cron secret; `hours` limits it to those Copenhagen hours, so one
//   UTC schedule works across daylight saving time.
// A failing source records a short code in `last_error`, keeps its old rows and never blocks another source.
// Logs carry the function name, outcome, duration and counts only: never values or tokens.
import { HttpError } from '../_shared/http.ts';
import { z } from '../_shared/schema.ts';
import type { Connection, HealthDb, Who } from '../_shared/health/db.ts';
import { addDays, copenhagenDate, copenhagenHour } from '../_shared/health/normalise.ts';
import type { HealthSource, ProviderId } from '../_shared/health/types.ts';

export const THROTTLE_MS = 30 * 60_000;
export const DAYS = 8;

export const SelfInput = z.object({ mode: z.literal('self'), force: z.boolean().optional() });
export const AllInput = z.object({ mode: z.literal('all'), hours: z.array(z.number().int().min(0).max(23)).max(24).optional() });

export interface SyncDeps {
  db: HealthDb;
  sources: Partial<Record<ProviderId, HealthSource>>;
  now: () => number;
}

export type Counts = { synced: number; skipped: number; failed: number };

const errorCode = (e: unknown) => (e instanceof HttpError ? e.code : 'internal').slice(0, 80);

async function syncConnection(deps: SyncDeps, c: Connection, force: boolean, counts: Counts): Promise<void> {
  const now = deps.now();
  if (!force && c.lastSyncedAt && now - Date.parse(c.lastSyncedAt) < THROTTLE_MS) {
    counts.skipped++;
    return;
  }
  const who: Who = { householdId: c.householdId, person: c.person };
  const source = deps.sources[c.source];
  try {
    if (!source) throw new HttpError(500, 'no_adapter');
    const to = copenhagenDate(new Date(now));
    const days = await source.fetchDays({ ...who, from: addDays(to, -(DAYS - 1)), to });
    await deps.db.upsertDays(who, days.filter((d) => d.source === c.source));
    await deps.db.setSyncResult(who, c.source, { at: new Date(deps.now()).toISOString(), error: null });
    counts.synced++;
  } catch (e) {
    counts.failed++;
    try {
      await deps.db.setSyncResult(who, c.source, { at: null, error: errorCode(e) });
    } catch {
      // the error code is best effort; the next sync tries again
    }
  }
}

/** One person's sources (mode `self`). */
export async function syncPerson(deps: SyncDeps, who: Who, opts: { force?: boolean } = {}): Promise<Counts> {
  const counts: Counts = { synced: 0, skipped: 0, failed: 0 };
  for (const c of await deps.db.connections(who)) await syncConnection(deps, c, !!opts.force, counts);
  return counts;
}

/** Everyone's sources (mode `all`, cron). Always fetches: the schedule is the throttle. */
export async function syncAll(deps: SyncDeps, opts: { hours?: number[] } = {}): Promise<Counts & { outOfHours?: true }> {
  if (opts.hours && !opts.hours.includes(copenhagenHour(new Date(deps.now())))) {
    return { synced: 0, skipped: 0, failed: 0, outOfHours: true };
  }
  const counts: Counts = { synced: 0, skipped: 0, failed: 0 };
  for (const c of await deps.db.connections()) await syncConnection(deps, c, true, counts);
  return counts;
}
