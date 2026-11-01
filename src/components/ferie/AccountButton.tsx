import { CloudCheckIcon, CloudOffIcon, LoaderCircleIcon, UserRoundIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { LabeledField } from './labeled-field';
import { sendMagicLink, signOut } from './lib/remote';
import type { SyncStatus } from './lib/use-sync';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import { FieldGroup } from './ui/field';
import { Input } from './ui/input';
import { ResponsiveSheet } from './ui/sheet';

const LABEL: Record<SyncStatus, string> = {
  off: '',
  'signed-out': 'Ikke logget ind. Data gemmes kun på denne enhed.',
  connecting: 'Forbinder …',
  synced: 'Alt er gemt og delt.',
  saving: 'Gemmer …',
  offline: 'Ingen forbindelse. Ændringer ligger på denne enhed og gemmes, når forbindelsen er tilbage.',
  'no-access': 'Denne e-mail er ikke inviteret endnu.',
};

export function AccountButton({ status, email, signedIn }: { status: SyncStatus; email: string | null; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [mail, setMail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (status === 'off') return null;

  const Icon = !signedIn ? UserRoundIcon : status === 'offline' ? CloudOffIcon : status === 'synced' ? CloudCheckIcon : LoaderCircleIcon;

  const send = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await sendMagicLink(mail);
    setBusy(false);
    if (err) setError(err);
    else setSent(true);
  };

  return (
    <>
      <Button variant="outline" size="icon" aria-label={signedIn ? `Konto: ${LABEL[status]}` : 'Log ind'} onClick={() => setOpen(true)}>
        <Icon className={status === 'saving' || status === 'connecting' ? 'animate-spin' : undefined} />
      </Button>
      <ResponsiveSheet
        open={open}
        onOpenChange={setOpen}
        title={signedIn ? 'Konto' : 'Log ind'}
        description={signedIn ? 'Jeres data deles mellem jeres enheder.' : 'Log ind for at dele planen på tværs af telefon og computer.'}
      >
        {signedIn ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm">Logget ind som <b>{email}</b></p>
            {status === 'no-access' ? (
              <Alert variant="destructive">
                <AlertTitle>Ikke inviteret</AlertTitle>
                <AlertDescription>Denne e-mail har ikke adgang til jeres fælles plan endnu. Data gemmes kun på denne enhed.</AlertDescription>
              </Alert>
            ) : (
              <p className="text-sm text-muted-foreground">{LABEL[status]}</p>
            )}
            <Button variant="outline" onClick={() => { void signOut(); setSent(false); toast('Du er logget ud. Data ligger stadig på denne enhed.'); setOpen(false); }}>Log ud</Button>
          </div>
        ) : sent ? (
          <Alert>
            <AlertTitle>Tjek din e-mail</AlertTitle>
            <AlertDescription>Vi har sendt et login-link til {mail}. Åbn det på den enhed, du vil logge ind på.</AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={send}>
            <FieldGroup>
              <LabeledField label="E-mail" hint="Du får et link, der logger dig ind. Kun inviterede e-mails får adgang til data.">
                <Input type="email" required autoComplete="email" inputMode="email" value={mail} onChange={(e) => setMail(e.target.value)} />
              </LabeledField>
              {error && <p role="alert" className="text-sm text-warn">{error}</p>}
              <Button type="submit" disabled={busy || !mail.trim()}>{busy ? 'Sender …' : 'Send login-link'}</Button>
            </FieldGroup>
          </form>
        )}
      </ResponsiveSheet>
    </>
  );
}
