import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { normalize } from './store';
import {
  createRemote, fetchRemote, getClient, pushRemote, remoteEnabled, subscribeRemote,
} from './remote';
import type { Action } from './use-ferie';
import type { FerieState } from './types';

export type SyncStatus =
  | 'off' | 'signed-out' | 'connecting' | 'synced' | 'saving' | 'offline' | 'no-access';

/** `connecting` also covers the moment before the stored session has been read. */

const BACKUP_KEY = 'ferie-v1-backup';

const hasContent = (s: FerieState) =>
  s.trips.length + s.money.length + s.itin.length + s.checks.length + s.tdays.length > 0;

/** An untouched document that was never filled in. */
const isEmptyDoc = (d: unknown) => !d || typeof d !== 'object' || Object.keys(d as object).length === 0;

/**
 * Keeps the local state and the shared Supabase document in step:
 * first sign-in imports local data, later sessions load the shared copy, edits are saved
 * (debounced, with a version check) and changes from the other phone arrive live.
 */
export function useSync(state: FerieState, dispatch: React.Dispatch<Action>) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SyncStatus>(remoteEnabled ? 'connecting' : 'off');
  const [sessionLoaded, setSessionLoaded] = useState(!remoteEnabled);
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);

  const household = useRef<string | null>(null);
  const version = useRef(0);
  const last = useRef('');
  const stateRef = useRef(state);
  stateRef.current = state;
  const userId = session?.user.id ?? null;

  // Session
  useEffect(() => {
    if (!remoteEnabled) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    getClient()
      .then((c) => {
        if (cancelled) return;
        void c.auth.getSession().then(({ data }) => {
          if (cancelled) return;
          setSession(data.session);
          setSessionLoaded(true);
        });
        const { data } = c.auth.onAuthStateChange((_e, s) => setSession(s));
        unsub = () => data.subscription.unsubscribe();
      })
      .catch(() => { setStatus('offline'); setSessionLoaded(true); });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const backupLocal = useCallback(() => {
    const cur = stateRef.current;
    if (!hasContent(cur)) return;
    try { localStorage.setItem(BACKUP_KEY, JSON.stringify(cur)); } catch { /* ignore */ }
  }, []);

  /** Replaces the local state with the shared copy. */
  const apply = useCallback((data: unknown, v: number) => {
    const next = normalize(data);
    const json = JSON.stringify(next);
    if (JSON.stringify(stateRef.current) !== json) backupLocal();
    last.current = json;
    version.current = v;
    dispatch({ type: 'replace', state: next });
  }, [dispatch, backupLocal]);

  // Initial sync + live updates, per signed-in user
  useEffect(() => {
    if (!remoteEnabled || !sessionLoaded) return;
    setReady(false);
    household.current = null;
    if (!userId) {
      setStatus('signed-out');
      return;
    }
    let cancelled = false;
    let off: (() => void) | undefined;
    void (async () => {
      setStatus('connecting');
      try {
        let r = await fetchRemote();
        if (cancelled) return;
        if (r.status === 'no-access') { setStatus('no-access'); return; }
        const hid = r.householdId;
        const local = stateRef.current;
        if (!r.row) {
          // First sign-in: import what is on this device.
          if (await createRemote(hid, local)) {
            last.current = JSON.stringify(local);
            version.current = 0;
          } else {
            r = await fetchRemote();
            if (r.status === 'ok' && r.row) apply(r.row.data, r.row.version);
          }
        } else if (isEmptyDoc(r.row.data)) {
          const res = await pushRemote(hid, r.row.version, local);
          if (res.ok) { last.current = JSON.stringify(local); version.current = res.version; }
          else { const again = await fetchRemote(); if (again.status === 'ok' && again.row) apply(again.row.data, again.row.version); }
        } else {
          apply(r.row.data, r.row.version);
        }
        if (cancelled) return;
        household.current = hid;
        const unsub = await subscribeRemote(hid, (row) => {
          if (row.version > version.current) { apply(row.data, row.version); setStatus('synced'); }
        });
        if (cancelled) { unsub(); return; }
        off = unsub;
        setReady(true);
        setStatus('synced');
      } catch {
        if (!cancelled) setStatus('offline');
      }
    })();
    return () => {
      cancelled = true;
      off?.();
    };
  }, [userId, sessionLoaded, apply, retry]);

  // Save edits (debounced)
  useEffect(() => {
    if (!ready || !household.current) return;
    if (JSON.stringify(state) === last.current) return;
    setStatus('saving');
    const timer = window.setTimeout(async () => {
      const hid = household.current;
      if (!hid) return;
      const snapshot = stateRef.current;
      const json = JSON.stringify(snapshot);
      try {
        const res = await pushRemote(hid, version.current, snapshot);
        if (res.ok) {
          version.current = res.version;
          last.current = json;
          setStatus(JSON.stringify(stateRef.current) === json ? 'synced' : 'saving');
        } else {
          const r = await fetchRemote();
          if (r.status === 'ok' && r.row) {
            apply(r.row.data, r.row.version);
            toast.warning('Opdateret af en anden. Dine seneste ændringer blev ikke gemt, men en kopi ligger i browseren.');
          }
          setStatus('synced');
        }
      } catch {
        setStatus('offline');
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [state, ready, retry, apply]);

  // Try again when the connection returns
  useEffect(() => {
    if (!remoteEnabled) return;
    const on = () => setRetry((n) => n + 1);
    window.addEventListener('online', on);
    return () => window.removeEventListener('online', on);
  }, []);

  return { status, email: session?.user.email ?? null, signedIn: !!userId };
}
