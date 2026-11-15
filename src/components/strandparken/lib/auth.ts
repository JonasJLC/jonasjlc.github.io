import { createSupabaseAuth } from '../../../lib/supabase/client';

/** PKCE: the redirect returns `?code=`, which never collides with the `#view` hash routing. */
export const auth = createSupabaseAuth({ redirectPath: '/strandparken/', flowType: 'pkce' });
export const { getClient, signInWithGoogle, signInWithGoogleIdToken, signOut } = auth;
