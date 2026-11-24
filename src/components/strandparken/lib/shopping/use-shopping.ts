import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getClient } from '../auth';
import { subscribeHousehold } from '../realtime';
import type { GroceryCategory, ShoppingRow, Status } from './model';
import { applyOps, compact, loadCache, loadQueue, newOpId, saveCache, saveQueue, type NewOp, type Op } from './queue';
import { clearUnitPreference, loadUnitPreferences, saveUnitPreference } from './preferences';
import { isNetworkError, loadEntryDates, loadGroceryCategories, loadRows, sendOp } from './repo';

export type ShoppingState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; rows: ShoppingRow[]; categories: GroceryCategory[]; dates: Record<string, string>; prefs: Record<string, string> };

/**
 * The household's shopping rows and categories (ADR-09). Opens at once from the last copy on the phone, refetches, and
 * refetches again on every change from the other phone (Realtime). Ticking, clearing and adding go through a queue that
 * is shown immediately and sent as soon as there is a connection.
 */
export function useShopping(householdId: string | null) {
  const [server, setServer] = useState<ShoppingState>({ status: 'loading' });
  const [queue, setQueue] = useState<Op[]>([]);
  const [offline, setOffline] = useState(false);
  const queueRef = useRef<Op[]>([]);
  const flushing = useRef(false);

  const setQ = useCallback((next: Op[]) => {
    queueRef.current = next;
    setQueue(next);
    if (householdId) saveQueue(householdId, next);
  }, [householdId]);

  /** The last known unit preferences: kept when a refetch of them fails, so the list does not jump back to defaults. */
  const prefsRef = useRef<Record<string, string>>({});

  const reload = useCallback(async () => {
    if (!householdId) return;
    try {
      const [rows, categories, prefs] = await Promise.all([
        loadRows(), loadGroceryCategories(), loadUnitPreferences().catch(() => prefsRef.current),
      ]);
      prefsRef.current = prefs;
      // Dates only label the item sheet: a failure there must not hide the list.
      const dates = await loadEntryDates(rows).catch((): Record<string, string> => ({}));
      setServer({ status: 'ready', rows, categories, dates, prefs });
      setOffline(false);
      saveCache(householdId, { rows, categories, dates, prefs });
    } catch {
      setOffline(true);
      setServer((s) => (s.status === 'ready' ? s : { status: 'error' }));
    }
  }, [householdId]);

  const flush = useCallback(async () => {
    if (flushing.current || !queueRef.current.length) return;
    flushing.current = true;
    try {
      while (queueRef.current.length) {
        const [next] = queueRef.current;
        try {
          await sendOp(next);
        } catch (e) {
          if (isNetworkError(e)) {
            setOffline(true);
            return;
          }
          // The database refused this change (the row is gone, say): drop it so the rest can go through.
        }
        setQ(queueRef.current.filter((o) => o.opId !== next.opId));
      }
    } finally {
      flushing.current = false;
      void reload();
    }
  }, [reload, setQ]);

  // First paint from the copy on the phone, then the network.
  useEffect(() => {
    if (!householdId) return;
    const cached = loadCache(householdId);
    if (cached) {
      prefsRef.current = cached.prefs;
      setServer({ status: 'ready', ...cached });
    }
    setQ(loadQueue(householdId));
    void flush().then(reload);
  }, [householdId, reload, flush, setQ]);

  // Back online, or the page comes back to the front: send what is waiting, then fetch.
  useEffect(() => {
    const go = () => void flush().then(reload);
    const visible = () => document.visibilityState === 'visible' && go();
    window.addEventListener('online', go);
    document.addEventListener('visibilitychange', visible);
    const timer = window.setInterval(() => queueRef.current.length && go(), 15000);
    return () => {
      window.removeEventListener('online', go);
      document.removeEventListener('visibilitychange', visible);
      window.clearInterval(timer);
    };
  }, [flush, reload]);

  useEffect(() => {
    if (!householdId) return;
    let off: (() => void) | undefined;
    let gone = false;
    void subscribeHousehold(householdId, 'sp_shopping_items', () => void reload()).then((stop) => {
      if (gone) stop();
      else off = stop;
    }).catch(() => {});
    return () => {
      gone = true;
      off?.();
    };
  }, [householdId, reload]);

  const enqueue = useCallback(async (op: NewOp) => {
    const full = { ...op, opId: newOpId(), at: new Date().toISOString() } as Op;
    setQ(compact([...queueRef.current, full]));
    void flush();
  }, [flush, setQ]);

  const setStatus = useCallback(async (ids: string[], status: Status) => {
    let by: string | null = null;
    if (status === 'checked') {
      try {
        by = (await (await getClient()).auth.getSession()).data.session?.user.id ?? null;
      } catch {
        /* offline: the tick is still recorded, just without who */
      }
    }
    await enqueue({ kind: 'status', ids, status, by });
  }, [enqueue]);

  const addItem = useCallback(
    (name: string, categoryId: string | null) =>
      enqueue({ kind: 'add', row: { id: crypto.randomUUID(), household_id: householdId!, name, grocery_category_id: categoryId } }),
    [enqueue, householdId],
  );

  /**
   * Remembers (or with `null` forgets) a unit for an ingredient. Needs a connection, like changing a category: it throws
   * when the save fails, and the line only changes once the database has it.
   */
  const setUnit = useCallback(async (ingredientKey: string, unit: string | null) => {
    if (!householdId) return;
    if (unit === null) await clearUnitPreference(householdId, ingredientKey);
    else await saveUnitPreference(householdId, ingredientKey, unit);
    const { [ingredientKey]: _old, ...rest } = prefsRef.current;
    const prefs = unit === null ? rest : { ...rest, [ingredientKey]: unit };
    prefsRef.current = prefs;
    setServer((s) => {
      if (s.status !== 'ready') return s;
      const next = { ...s, prefs };
      saveCache(householdId, { rows: next.rows, categories: next.categories, dates: next.dates, prefs });
      return next;
    });
  }, [householdId]);

  const state = useMemo<ShoppingState>(
    () => (server.status === 'ready' ? { ...server, rows: applyOps(server.rows, queue) } : server),
    [server, queue],
  );

  return {
    state, reload, setStatus, addItem, setUnit, offline, pending: queue.length,
    retry: () => { setServer({ status: 'loading' }); void reload(); },
  };
}
