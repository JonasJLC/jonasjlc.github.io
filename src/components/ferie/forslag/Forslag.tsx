import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { remoteEnabled } from '../lib/remote';
import { loadBoard, subscribeRequests, type Board } from '../lib/forslag';
import type { SyncStatus } from '../lib/use-sync';
import { PageTitle, SectionTitle } from '../page';
import { Chat } from './Chat';
import { RequestList } from './RequestList';

/** Wishes for the app: a short chat turns an idea into a request, and the list tracks what happens to it. */
export function Forslag({ status }: { status: SyncStatus }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [failed, setFailed] = useState(false);
  const live = remoteEnabled && (status === 'synced' || status === 'saving');

  const reload = useCallback(async () => {
    try {
      setBoard(await loadBoard());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    if (!live) return;
    void reload();
  }, [live, reload]);

  const householdId = board?.householdId;
  useEffect(() => {
    if (!householdId) return;
    let off: (() => void) | undefined;
    let cancelled = false;
    void subscribeRequests(householdId, () => void reload()).then((u) => {
      if (cancelled) u(); else off = u;
    }).catch(() => { /* live updates are a convenience */ });
    return () => { cancelled = true; off?.(); };
  }, [householdId, reload]);

  return (
    <>
      <PageTitle title="Forslag">
        Mangler der noget i Ferieplan, eller kan noget være nemmere? Fortæl det her, så stiller chatten et par spørgsmål og gemmer et klart forslag.
      </PageTitle>

      {!live ? (
        <p role="status" className="rounded-panel bg-panel p-5 text-sm text-muted-foreground">
          {remoteEnabled ? 'Log ind og vent til Ferieplan er forbundet for at sende forslag.' : 'Forslag kræver login og deling, og er slået fra i denne udgave.'}
        </p>
      ) : (
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <section aria-labelledby="forslag-chat">
            <SectionTitle><span id="forslag-chat">Nyt forslag</span></SectionTitle>
            <Chat
              householdId={board?.householdId ?? null}
              onSaved={() => { toast.success('Forslaget er gemt'); void reload(); }}
            />
          </section>
          <section aria-labelledby="forslag-list">
            <SectionTitle><span id="forslag-list">Alle forslag</span></SectionTitle>
            {failed && <p role="alert" className="mb-3 text-sm text-warn">Kunne ikke hente forslagene. Prøv at genindlæse siden.</p>}
            <RequestList board={board} onChanged={() => void reload()} />
          </section>
        </div>
      )}
    </>
  );
}
