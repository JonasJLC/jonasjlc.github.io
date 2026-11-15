import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeHousehold } from '../realtime';
import type { PlanEntry } from './model';
import { loadEntries } from './repo';

export type PlanState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; entries: PlanEntry[] };

/** The plan entries of one week, refetched when the other phone changes anything (Realtime) and after every local change. */
export function usePlan(householdId: string | null, from: string, to: string) {
  const [state, setState] = useState<PlanState>({ status: 'loading' });
  const range = useRef({ from, to });
  range.current = { from, to };

  const reload = useCallback(async () => {
    const asked = range.current;
    try {
      const entries = await loadEntries(asked.from, asked.to);
      if (asked.from === range.current.from) setState({ status: 'ready', entries });
    } catch {
      setState((s) => (s.status === 'ready' ? s : { status: 'error' }));
    }
  }, []);

  // A new week starts from "loading" so last week's days are never shown under the new heading.
  useEffect(() => {
    setState({ status: 'loading' });
    void reload();
  }, [from, to, reload]);

  useEffect(() => {
    if (!householdId) return;
    let off: (() => void) | undefined;
    let gone = false;
    void subscribeHousehold(householdId, 'sp_meal_plan_entries', () => void reload()).then((stop) => {
      if (gone) stop();
      else off = stop;
    }).catch(() => {});
    return () => {
      gone = true;
      off?.();
    };
  }, [householdId, reload]);

  return { state, reload, retry: () => { setState({ status: 'loading' }); void reload(); } };
}
