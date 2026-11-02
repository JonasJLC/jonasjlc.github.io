import { LogOutIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { GoogleButton } from './GoogleButton';
import { signInWithGoogle, signOut } from './lib/remote';
import { GOOGLE_CLIENT_ID } from './lib/supabase-config';
import type { SyncStatus } from './lib/use-sync';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Mark } from './Mark';

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden data-icon="inline-start">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.8 3.6-4.9 6.7-4.9z" />
    </svg>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-frame">
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
        <Mark className="mb-5 size-10 text-foreground" />
        <h1 className="title-serif mb-1 text-[40px]">Ferieplan</h1>
        <p className="mb-8 text-sm text-muted-foreground">Feriedage, rejsekasse og rejseplan for jer to.</p>
        {children}
      </main>
    </div>
  );
}

/**
 * Shows the app only to signed-in users. This is a convenience screen, not the security
 * boundary: the data itself is protected by row-level security in Supabase.
 */
export function AuthGate({
  status, email, children,
}: {
  status: SyncStatus; email: string | null; children: React.ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [waited, setWaited] = useState(false);
  // Google's own button when configured and its script loads; otherwise the Supabase redirect.
  const [useRedirect, setUseRedirect] = useState(!GOOGLE_CLIENT_ID);
  const fallBack = useCallback(() => setUseRedirect(true), []);

  // Don't hold the app hostage on a slow connection: show it after a few seconds.
  useEffect(() => {
    if (status !== 'connecting') { setWaited(false); return; }
    const t = window.setTimeout(() => setWaited(true), 6000);
    return () => window.clearTimeout(t);
  }, [status]);

  if (status === 'off') return <>{children}</>;

  if (status === 'connecting' && !waited) {
    return (
      <Shell>
        <p role="status" className="text-muted-foreground">Åbner Ferieplan …</p>
      </Shell>
    );
  }

  if (status === 'signed-out') {
    const go = async () => {
      setBusy(true);
      setError(null);
      const err = await signInWithGoogle();
      if (err) { setError(err); setBusy(false); }
    };
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle>Log ind</CardTitle>
            <CardDescription>Feriedage, rejsekasse og rejseplan er kun for inviterede.</CardDescription>
          </CardHeader>
          <CardContent>
            {useRedirect ? (
              <Button className="w-full" variant="outline" size="lg" onClick={go} disabled={busy}>
                <GoogleMark />
                {busy ? 'Åbner Google …' : 'Fortsæt med Google'}
              </Button>
            ) : (
              <GoogleButton clientId={GOOGLE_CLIENT_ID} onError={setError} onUnavailable={fallBack} />
            )}
            {error && <p role="alert" className="mt-3 text-sm text-warn">{error}</p>}
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <a className="underline underline-offset-2" href="/ferie/privatliv/">Privatlivspolitik</a>
        </p>
      </Shell>
    );
  }

  if (status === 'no-access') {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle>Ikke inviteret</CardTitle>
            <CardDescription>
              {email ? <><b>{email}</b> har</> : 'Denne konto har'} ikke adgang til Ferieplan. Log ind med en anden Google-konto, eller bed om en invitation.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" onClick={() => void signOut()}>
              <LogOutIcon data-icon="inline-start" />
              Log ud
            </Button>
          </CardFooter>
        </Card>
      </Shell>
    );
  }

  return <>{children}</>;
}
