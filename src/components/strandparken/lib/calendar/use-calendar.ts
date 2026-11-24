import { useCallback, useEffect, useRef, useState } from 'react';
import type { EventsResult } from './model';
import { loadEvents, loadSources } from './repo';

export type CalendarState =
  | { status: 'loading' }
  /** No calendar to show yet: the card invites the person to add one. */
  | { status: 'empty' }
  /** `failed`: the last refresh did not work, and `result` is what was shown before (possibly from an earlier visit). */
  | { status: 'ready'; result: EventsResult; failed: boolean }
  | { status: 'error' };

const MIN_GAP_MS = 60_000;
const CHANGED = 'sp-calendar-changed';
const storageKey = (householdId: string) => `sp-calendar:${householdId}`;

function readCache(householdId: string): EventsResult | null {
  try {
    const raw = localStorage.getItem(storageKey(householdId));
    return raw ? (JSON.parse(raw) as EventsResult) : null;
  } catch {
    return null;
  }
}

function writeCache(householdId: string, result: EventsResult) {
  try { localStorage.setItem(storageKey(householdId), JSON.stringify(result)); } catch { /* private mode or full: the card still works */ }
}

/** Tell an open Hjem that calendars were added, changed or removed in Indstillinger. */
export const calendarsChanged = () => window.dispatchEvent(new Event(CHANGED));

/**
 * Hjem's calendar (Idé 7). Shows the last result from this phone at once, then asks the function for fresh events:
 * on open, when the app comes back to the front, and after a change in Indstillinger, at most once a minute (except
 * after a change). The function itself caches each feed for 15 minutes.
 */
export function useCalendar(householdId: string | null) {
  const [state, setState] = useState<CalendarState>(() => {
    const cached = householdId ? readCache(householdId) : null;
    return cached ? { status: 'ready', result: cached, failed: false } : { status: 'loading' };
  });
  const last = useRef(0);

  const refresh = useCallback(async (force = false) => {
    if (!householdId) return;
    if (!force && Date.now() - last.current < MIN_GAP_MS) return;
    last.current = Date.now();
    try {
      const sources = await loadSources();
      if (!sources.some((s) => s.enabled)) {
        setState({ status: 'empty' });
        return;
      }
      const result = await loadEvents();
      writeCache(householdId, result);
      setState({ status: 'ready', result, failed: false });
    } catch {
      setState((s) => (s.status === 'ready' ? { ...s, failed: true } : { status: 'error' }));
    }
  }, [householdId]);

  useEffect(() => {
    void refresh(true);
    const visible = () => document.visibilityState === 'visible' && void refresh();
    const changed = () => void refresh(true);
    document.addEventListener('visibilitychange', visible);
    window.addEventListener(CHANGED, changed);
    return () => {
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener(CHANGED, changed);
    };
  }, [refresh]);

  return { state, retry: () => void refresh(true) };
}
