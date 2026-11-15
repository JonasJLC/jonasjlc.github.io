import { useCallback, useState, type ReactNode } from 'react';
import { GOOGLE_CLIENT_ID } from '../../../lib/supabase/config';
import { useGoogleButton } from '../../../lib/supabase/use-google-button';
import { signInWithGoogle, signInWithGoogleIdToken, signOut } from '../lib/auth';
import type { AuthState } from '../lib/use-auth';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sp-column flex-col justify-center gap-sp-gap px-sp-page-x py-sp-page-bottom">
      <h1 className="sp-title-page">{title}</h1>
      {children}
    </main>
  );
}

function GoogleG() {
  return <img src="/strandparken/google-g.svg" alt="" width={20} height={20} />;
}

function GoogleOwnButton({ onError, onUnavailable }: { onError: (m: string | null) => void; onUnavailable: () => void }) {
  const { slot, busy } = useGoogleButton({ clientId: GOOGLE_CLIENT_ID, signIn: signInWithGoogleIdToken, onError, onUnavailable });
  return (
    <>
      <div ref={slot} className="flex min-h-sp-target w-full justify-center" hidden={busy} />
      {busy && <p role="status" className="sp-body text-center text-sp-muted">Logger ind …</p>}
    </>
  );
}

function SignIn() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Google's own button when configured and its script loads; otherwise the Supabase redirect.
  const [useRedirect, setUseRedirect] = useState(!GOOGLE_CLIENT_ID);
  const fallBack = useCallback(() => setUseRedirect(true), []);

  const go = async () => {
    setBusy(true);
    setError(null);
    const err = await signInWithGoogle();
    if (err) { setError(err); setBusy(false); }
  };

  return (
    <Screen title="Strandparken">
      <p className="sp-body text-sp-muted">Madplan, indkøb og hverdag for jer to.</p>
      <Card className="flex flex-col gap-sp-gap">
        <p className="sp-body">Log ind for at komme videre. Appen er kun for inviterede.</p>
        {useRedirect ? (
          <Button variant="outline" onClick={go} disabled={busy}>
            <GoogleG />
            {busy ? 'Åbner Google …' : 'Fortsæt med Google'}
          </Button>
        ) : (
          <GoogleOwnButton onError={setError} onUnavailable={fallBack} />
        )}
        {error && <p role="alert" className="sp-small text-sp-danger">{error}</p>}
      </Card>
    </Screen>
  );
}

/**
 * Shows the app only to signed-in members. A convenience screen, not the security boundary: every table is
 * protected by row-level security. Without Supabase (`PUBLIC_SUPABASE_URL=`) there is no gate.
 */
export function AuthGate({ state, children }: { state: AuthState; children: ReactNode }) {
  switch (state.status) {
    case 'off':
    case 'ready':
      return <>{children}</>;
    case 'connecting':
      return (
        <Screen title="Strandparken">
          <p role="status" className="sp-body text-sp-muted">Åbner Strandparken …</p>
        </Screen>
      );
    case 'offline':
      return (
        <Screen title="Ingen forbindelse">
          <p role="status" className="sp-body text-sp-muted">Strandparken kan ikke nå serveren. Tjek forbindelsen og prøv igen.</p>
          <Button variant="outline" onClick={() => location.reload()}>Prøv igen</Button>
        </Screen>
      );
    case 'signed-out':
      return <SignIn />;
    case 'no-access':
      return (
        <Screen title="Ikke inviteret">
          <Card className="flex flex-col gap-sp-gap">
            <p className="sp-body">
              {state.email ? <><b>{state.email}</b> har</> : 'Denne konto har'} ikke adgang til Strandparken. Log ind med en anden Google-konto, eller bed om en invitation.
            </p>
            <Button variant="outline" onClick={() => void signOut()}>Log ud</Button>
          </Card>
        </Screen>
      );
  }
}
