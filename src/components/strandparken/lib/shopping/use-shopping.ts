import { useCallback, useEffect, useState } from 'react';
import { subscribeHousehold } from '../realtime';
import type { GroceryCategory, ShoppingRow } from './model';
import { loadGroceryCategories, loadRows } from './repo';

export type ShoppingState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; rows: ShoppingRow[]; categories: GroceryCategory[] };

/** The household's shopping rows and categories. Refetched on every change from the other phone (Realtime) and after local writes. */
export function useShopping(householdId: string | null) {
  const [state, setState] = useState<ShoppingState>({ status: 'loading' });

  const reload = useCallback(async () => {
    try {
      const [rows, categories] = await Promise.all([loadRows(), loadGroceryCategories()]);
      setState({ status: 'ready', rows, categories });
    } catch {
      setState((s) => (s.status === 'ready' ? s : { status: 'error' }));
    }
  }, []);

  useEffect(() => {
    if (householdId) void reload();
  }, [householdId, reload]);

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

  /** Show a tick at once; the write and the refetch that follows make it real (or put it back if it failed). */
  const patchLocal = useCallback((ids: string[], status: ShoppingRow['status']) => {
    setState((s) => (s.status === 'ready' ? { ...s, rows: s.rows.map((r) => (ids.includes(r.id) ? { ...r, status } : r)) } : s));
  }, []);

  return { state, reload, patchLocal, retry: () => { setState({ status: 'loading' }); void reload(); } };
}
