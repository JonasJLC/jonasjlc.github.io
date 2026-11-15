/* eslint-disable @typescript-eslint/no-explicit-any -- `any` is supabase-js's own default schema type. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from './config';

export const remoteEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY);

export interface AuthOptions {
  /** Path the Google redirect flow returns to, e.g. `/strandparken/`. */
  redirectPath: string;
  /**
   * `pkce` returns `?code=` in the query string, which never collides with a `#view` hash.
   * `implicit` (supabase-js default) returns tokens in the hash; /ferie keeps it, as it has no hash routing.
   */
  flowType?: 'pkce' | 'implicit';
}

export interface SupabaseAuth<DB = any> {
  /** Loaded lazily so the library only downloads when sync is used. One client per page. */
  getClient(): Promise<SupabaseClient<DB>>;
  /** Starts Google sign-in; the browser leaves the page and returns to `redirectPath` signed in. */
  signInWithGoogle(): Promise<string | null>;
  /** Finishes sign-in with an ID token from Google's button; `nonce` is the raw (unhashed) nonce. */
  signInWithGoogleIdToken(token: string, nonce: string): Promise<string | null>;
  signOut(): Promise<void>;
}

/** The one sign-in implementation both apps use. Returns error messages instead of throwing, for display. */
export function createSupabaseAuth<DB = any>({ redirectPath, flowType }: AuthOptions): SupabaseAuth<DB> {
  let clientPromise: Promise<SupabaseClient<DB>> | null = null;

  const getClient = () => {
    clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
      createClient<DB>(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, ...(flowType ? { flowType } : {}) },
      }),
    );
    return clientPromise;
  };

  return {
    getClient,
    async signInWithGoogle() {
      const c = await getClient();
      const { error } = await c.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${location.origin}${redirectPath}`, queryParams: { prompt: 'select_account' } },
      });
      return error ? error.message : null;
    },
    async signInWithGoogleIdToken(token, nonce) {
      const c = await getClient();
      const { error } = await c.auth.signInWithIdToken({ provider: 'google', token, nonce });
      return error ? error.message : null;
    },
    async signOut() {
      const c = await getClient();
      await c.auth.signOut();
    },
  };
}
