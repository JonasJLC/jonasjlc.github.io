import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getClient } from '../auth';
import { subscribeHousehold } from '../realtime';
import type { GroceryCategory, ShoppingRow, Status } from './model';
import { applyOps, compact, loadCache, loadQueue, newOpId, saveCache, saveQueue, type NewOp, type Op } from './queue';
import { isNetworkError, loadGroceryCategories, loadRows, sendOp } from './repo';

export type ShoppingState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; rows: ShoppingRow[]; categories: GroceryCategory[] };

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

  const reload = useCallback(async () => {
    if (!householdId) return;
    try {
      const [rows, categories] = await Promise.all([loadRows(), loadGroceryCategories()]);
      setServer({ status: 'ready', rows, categories });
      setOffline(false);
      saveCache(householdId, { rows, categories });
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
    if (cached) setServer({ status: 'ready', ...cached });
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

  const state = useMemo<ShoppingState>(
    () => (server.status === 'ready' ? { ...server, rows: applyOps(server.rows, queue) } : server),
    [server, queue],
  );

  return {
    state, reload, setStatus, addItem, offline, pending: queue.length,
    retry: () => { setServer({ status: 'loading' }); void reload(); },
  };
}
