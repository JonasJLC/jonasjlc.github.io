import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Person } from '../people';
import { copenhagenToday, sharingFor, sourcesFrom, toHealthView, type DayView, type Metric, type SourceStatus } from './model';
import { loadHealth, loadPeriodStarts, loadSharing, loadSources, syncHealth } from './repo';

export type HealthStatus = 'loading' | 'ready' | 'error';

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

let syncStarted: Promise<unknown> | null = null;

/**
 * Asks health-sync to pull the signed-in person's sources, once per app open. The function throttles to every 30 minutes,
 * so this is cheap; a failure is silent and the cards keep showing their last sync time.
 */
export function syncOnOpen(): Promise<unknown> {
  syncStarted ??= syncHealth().catch(() => null);
  return syncStarted;
}

/** Mount once in the shell: starts the on-open sync when signed in. */
export function useHealthSyncOnOpen(householdId: string | null) {
  useEffect(() => {
    if (householdId) void syncOnOpen();
  }, [householdId]);
}

/**
 * One person's health for ideas 11, 12 and 15: the last `days` days (default 8: the 7-day trend + today), today's view,
 * the person's sources, what the owner hides from the caller, and a reload. Waits for the on-open sync before the first
 * load so it shows fresh numbers when there are any.
 */
export function useHealth(householdId: string | null, person: Person, days = 8) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof loadHealth>> | null>(null);
  const [sourceRows, setSourceRows] = useState<Awaited<ReturnType<typeof loadSources>>>([]);
  const [status, setStatus] = useState<HealthStatus>('loading');
  const today = copenhagenToday();

  const reload = useCallback(async () => {
    try {
      const [h, s] = await Promise.all([loadHealth(person, addDays(today, -(days - 1)), today), loadSources()]);
      setRows(h);
      setSourceRows(s);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [person, days, today]);

  useEffect(() => {
    if (!householdId) return;
    let live = true;
    setStatus('loading');
    void syncOnOpen().then(() => { if (live) void reload(); });
    return () => { live = false; };
  }, [householdId, reload]);

  const view = useMemo(() => toHealthView(rows ?? []), [rows]);
  const sources: SourceStatus[] = useMemo(() => sourcesFrom(sourceRows).filter((s) => s.person === person), [sourceRows, person]);
  const todayView: DayView | null = view.days.find((d) => d.date === today) ?? null;
  const hidden: Metric[] = view.hidden;
  return { days: view.days, today: todayView, sources, hidden, status, reload };
}

/**
 * What the connect sheet and idea 11's sharing settings need: both people's sources, the signed-in person's sharing
 * (`confirmed` is false until the confirmation step has run) and their own period starts.
 */
export function useHealthSettings(householdId: string | null, person: Person) {
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [sharingRows, setSharingRows] = useState<Awaited<ReturnType<typeof loadSharing>>>([]);
  const [periods, setPeriods] = useState<Awaited<ReturnType<typeof loadPeriodStarts>>>([]);
  const [status, setStatus] = useState<HealthStatus>('loading');

  const reload = useCallback(async () => {
    try {
      const [s, sh, p] = await Promise.all([loadSources(), loadSharing(), loadPeriodStarts()]);
      setSources(sourcesFrom(s));
      setSharingRows(sh);
      setPeriods(p);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (householdId) void reload();
  }, [householdId, reload]);

  const sharing = useMemo(() => sharingFor(sharingRows, person), [sharingRows, person]);
  return { sources, sharing, periods, status, reload };
}
