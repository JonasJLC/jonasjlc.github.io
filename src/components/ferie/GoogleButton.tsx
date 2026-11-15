import { useGoogleButton } from '../../lib/supabase/use-google-button';
import { signInWithGoogleIdToken } from './lib/remote';

/**
 * Google's own "Fortsæt med Google" button. Its popup names this site rather than the
 * Supabase project domain. Calls `onUnavailable` if the script can't load, so the caller
 * can show the redirect-based button instead.
 */
export function GoogleButton({
  clientId, onError, onUnavailable,
}: {
  clientId: string; onError: (message: string | null) => void; onUnavailable: () => void;
}) {
  const { slot, busy } = useGoogleButton({ clientId, signIn: signInWithGoogleIdToken, onError, onUnavailable });
  return (
    <>
      <div ref={slot} className="flex min-h-11 w-full justify-center" hidden={busy} />
      {busy && <p role="status" className="text-center text-sm text-muted-foreground">Logger ind …</p>}
    </>
  );
}
