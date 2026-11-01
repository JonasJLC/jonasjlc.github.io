import { CloudCheckIcon, CloudOffIcon, LoaderCircleIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { signOut } from './lib/remote';
import type { SyncStatus } from './lib/use-sync';
import { Button } from './ui/button';
import { ResponsiveSheet } from './ui/sheet';

const LABEL: Record<SyncStatus, string> = {
  off: '',
  'signed-out': '',
  connecting: 'Forbinder …',
  synced: 'Alt er gemt og delt.',
  saving: 'Gemmer …',
  offline: 'Ingen forbindelse. Ændringer ligger på denne enhed og gemmes, når forbindelsen er tilbage.',
  'no-access': '',
};

/** Sync status and sign-out. Sign-in itself happens on the gate screen. */
export function AccountButton({ status, email, signedIn }: { status: SyncStatus; email: string | null; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  if (status === 'off' || !signedIn) return null;
  const Icon = status === 'offline' ? CloudOffIcon : status === 'synced' ? CloudCheckIcon : LoaderCircleIcon;
  return (
    <>
      <Button variant="outline" size="icon" aria-label={`Konto: ${LABEL[status] || 'logget ind'}`} onClick={() => setOpen(true)}>
        <Icon className={status === 'saving' || status === 'connecting' ? 'animate-spin' : undefined} />
      </Button>
      <ResponsiveSheet open={open} onOpenChange={setOpen} title="Konto" description="Jeres data deles mellem jeres enheder.">
        <div className="flex flex-col gap-4">
          <p className="text-sm">Logget ind som <b>{email}</b></p>
          <p className="text-sm text-muted-foreground">{LABEL[status]}</p>
          <Button
            variant="outline"
            onClick={() => { void signOut(); toast('Du er logget ud. Data ligger stadig på denne enhed.'); setOpen(false); }}
          >
            Log ud
          </Button>
        </div>
      </ResponsiveSheet>
    </>
  );
}
