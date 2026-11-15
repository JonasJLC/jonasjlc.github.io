import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { remoteEnabled } from '../../../lib/supabase/client';
import { resolveAccess } from './access';
import { getClient } from './auth';
import type { Person } from './people';

export type AuthState =
  /** Built without Supabase (`PUBLIC_SUPABASE_URL=`): no gate, the shell shows Jonas. */
  | { status: 'off' }
  | { status: 'connecting' }
  | { status: 'offline' }
  | { status: 'signed-out' }
  | { status: 'no-access'; email: string | null }
  | { status: 'ready'; householdId: string; person: Person; userId: string; email: string | null };

/** The stored session, then this person's household and person key. */
export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null | undefined>(remoteEnabled ? undefined : null);
  const [access, setAccess] = useState<AuthState | null>(null);
  const [failed, setFailed] = useState(false);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!remoteEnabled) return;
    let cancelled = false;
    let unsub: (() => void) | undefined;
    getClient()
      .then((c) => {
        if (cancelled) return;
        void c.auth.getSession().then(({ data }) => { if (!cancelled) setSession(data.session); });
        const { data } = c.auth.onAuthStateChange((_event, s) => { if (!cancelled) setSession(s); });
        unsub = () => data.subscription.unsubscribe();
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; unsub?.(); };
  }, []);

  useEffect(() => {
    setAccess(null);
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      try {
        const c = await getClient();
        const { data, error } = await c.from('household_members').select('household_id, person').limit(1).maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        const found = resolveAccess(data);
        const email = session?.user.email ?? null;
        setFailed(false);
        setAccess(found.status === 'ready' ? { ...found, userId, email } : { status: 'no-access', email });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!remoteEnabled) return { status: 'off' };
  if (failed && !access) return { status: 'offline' };
  if (session === undefined) return { status: 'connecting' };
  if (!session) return { status: 'signed-out' };
  return access ?? { status: 'connecting' };
}
