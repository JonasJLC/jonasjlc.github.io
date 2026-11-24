import { ChevronLeft } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { loadBoard, loadIssueStates, subscribeRequests, type Board, type IssueStates } from '../lib/forslag';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { SegmentedControl, SegmentedPanel } from '../ui/segmented-control';
import { notify } from '../ui/toast';
import { Chat } from './Chat';
import { RequestList } from './RequestList';

const options = [{ value: 'ny', label: 'Nyt forslag' }, { value: 'alle', label: 'Alle forslag' }] as const;

/** Wishes for the app (`#hjem/forslag`): a short chat turns an idea into a request, and the list tracks what happens to it. */
export function ForslagView({ householdId }: { householdId: string | null }) {
  const [segment, setSegment] = useState<string>('ny');
  const [board, setBoard] = useState<Board | null>(null);
  const [issues, setIssues] = useState<IssueStates>({});
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [b, i] = await Promise.all([loadBoard(), loadIssueStates()]);
      setBoard(b);
      setIssues(i);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    if (householdId) void reload();
  }, [householdId, reload]);

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
    <div className="flex flex-col gap-sp-gap">
      <a href="#hjem" className="sp-button-sm -ml-2 inline-flex min-h-sp-target w-fit items-center gap-1 rounded-sp-pill px-2 text-sp-primary active:bg-sp-track">
        <Icon icon={ChevronLeft} />Hjem
      </a>
      <header className="flex flex-col gap-2">
        <h1 id="view-title" tabIndex={-1} className="sp-title-page">Forslag</h1>
        <p className="sp-body text-sp-muted">
          Mangler der noget i Strandparken, eller kan noget være nemmere? Fortæl det her, så stiller chatten et par spørgsmål og gemmer et klart forslag. Jonas får det som en opgave på GitHub.
        </p>
      </header>

      {!householdId ? (
        <p role="status" className="sp-body text-sp-muted">Forslag kræver, at appen er koblet til databasen.</p>
      ) : (
        <SegmentedControl aria-label="Forslag" options={options} value={segment} onValueChange={setSegment} className="flex flex-col gap-sp-gap">
          {/* Both panels stay mounted so a half-written chat survives a look at the list. */}
          <SegmentedPanel value="ny" forceMount className="data-[state=inactive]:hidden">
            <Chat
              householdId={board?.householdId ?? householdId}
              onSaved={() => { notify('Forslaget er gemt'); setSegment('alle'); void reload(); }}
            />
          </SegmentedPanel>
          <SegmentedPanel value="alle" forceMount className="data-[state=inactive]:hidden">
            {failed && !board ? (
              <div className="flex flex-col items-start gap-2">
                <p role="alert" className="sp-body text-sp-danger">Kunne ikke hente forslagene.</p>
                <Button variant="outline" onClick={() => void reload()}>Prøv igen</Button>
              </div>
            ) : !board ? (
              <p role="status" className="sp-body text-sp-muted">Henter forslag …</p>
            ) : (
              <>
                {failed && <p role="alert" className="sp-small mb-2 text-sp-danger">Kunne ikke opdatere forslagene.</p>}
                <RequestList board={board} issues={issues} onChanged={() => void reload()} />
              </>
            )}
          </SegmentedPanel>
        </SegmentedControl>
      )}
    </div>
  );
}
