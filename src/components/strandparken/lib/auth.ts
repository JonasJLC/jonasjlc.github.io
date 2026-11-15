import { createSupabaseAuth } from '../../../lib/supabase/client';
import type { Database } from '../../../lib/supabase/database.types';

/** PKCE: the redirect returns `?code=`, which never collides with the `#view` hash routing. Typed with the schema. */
export const auth = createSupabaseAuth<Database>({ redirectPath: '/strandparken/', flowType: 'pkce' });
export const { getClient, signInWithGoogle, signInWithGoogleIdToken, signOut } = auth;
