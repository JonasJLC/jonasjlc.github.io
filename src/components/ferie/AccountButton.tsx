import { CloudCheckIcon, CloudOffIcon, LoaderCircleIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { signOut } from './lib/remote';
import type { SyncStatus } from './lib/use-sync';
import { Button } from './ui/button';
import { ResponsiveSheet } from './ui/sheet';

const SHORT: Record<SyncStatus, string> = {
  off: 'Kun på denne enhed',
  'signed-out': 'Ikke logget ind',
  connecting: 'Forbinder …',
  synced: 'Gemt og delt',
  saving: 'Gemmer …',
  offline: 'Offline',
  'no-access': 'Ingen adgang',
};

const LONG: Record<SyncStatus, string> = {
  off: 'Data ligger kun på denne enhed.',
  'signed-out': '',
  connecting: 'Forbinder …',
  synced: 'Alt er gemt og delt mellem jeres enheder.',
  saving: 'Gemmer …',
  offline: 'Ingen forbindelse. Ændringer ligger på denne enhed og gemmes, når forbindelsen er tilbage.',
  'no-access': '',
};

export interface SyncProps { status: SyncStatus; email: string | null; signedIn: boolean }

export function SyncIcon({ status, className }: { status: SyncStatus; className?: string }) {
  const Icon = status === 'offline' ? CloudOffIcon : status === 'saving' || status === 'connecting' ? LoaderCircleIcon : CloudCheckIcon;
  const spin = status === 'saving' || status === 'connecting';
  return <Icon aria-hidden className={`${className ?? ''} ${spin ? 'animate-spin' : ''} ${status === 'offline' ? 'text-caution' : ''}`} />;
}

export const syncLabel = (s: SyncStatus) => SHORT[s];

/** Who is signed in, the sync state in words, and sign-out. */
export function AccountDetails({ status, email, onDone }: SyncProps & { onDone?: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      {email && <p className="text-sm">Logget ind som <span className="font-medium">{email}</span></p>}
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <SyncIcon status={status} className="mt-0.5 size-4 shrink-0" />
        {LONG[status]}
      </p>
      {status !== 'off' && (
        <Button
          variant="outline"
          className="self-start"
          onClick={() => { void signOut(); toast('Du er logget ud. Data ligger stadig på denne enhed.'); onDone?.(); }}
        >
          Log ud
        </Button>
      )}
    </div>
  );
}

/** Sync status as a sidebar row; opens the account sheet. Sign-in itself happens on the gate screen. */
export function AccountButton({ status, email, signedIn, className }: SyncProps & { className?: string }) {
  const [open, setOpen] = useState(false);
  if (status === 'off' || !signedIn) return null;
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} aria-label={`Konto: ${SHORT[status]}`}>
        <SyncIcon status={status} className="size-4 shrink-0" />
        <span className="truncate">{SHORT[status]}</span>
      </button>
      <ResponsiveSheet open={open} onOpenChange={setOpen} title="Konto" description="Jeres data deles mellem jeres enheder.">
        <AccountDetails status={status} email={email} signedIn={signedIn} onDone={() => setOpen(false)} />
      </ResponsiveSheet>
    </>
  );
}
