import { useState } from 'react';
import { toast } from 'sonner';
import {
  AREA_LABEL, STATUS_LABEL, triage,
  type Board, type FeatureRequest, type RequestStatus,
} from '../lib/forslag';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';

const OPEN: RequestStatus[] = ['new', 'approved', 'building'];
const VARIANT: Record<RequestStatus, 'caution' | 'secondary' | 'ok' | 'outline' | 'default'> = {
  new: 'caution', approved: 'secondary', building: 'default', done: 'ok', declined: 'outline',
};

const dateFmt = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });

export function RequestList({ board, onChanged }: { board: Board | null; onChanged: () => void }) {
  if (!board) return <p role="status" className="text-sm text-muted-foreground">Henter forslag …</p>;
  if (board.requests.length === 0) {
    return <p className="rounded-panel bg-panel p-5 text-sm text-muted-foreground">Ingen forslag endnu. Det første kan blive dit.</p>;
  }
  // Open requests first; within each group the newest stays on top.
  const sorted = [...board.requests].sort(
    (a, b) => Number(OPEN.includes(b.status)) - Number(OPEN.includes(a.status)),
  );
  return (
    <ul className="flex flex-col gap-3">
      {sorted.map((r) => (
        <li key={r.id}><Item r={r} owner={board.isOwner} onChanged={onChanged} /></li>
      ))}
    </ul>
  );
}

function Item({ r, owner, onChanged }: { r: FeatureRequest; owner: boolean; onChanged: () => void }) {
  const [note, setNote] = useState(r.owner_note ?? '');
  const [busy, setBusy] = useState(false);
  const d = r.details ?? {};

  const run = async (patch: { status?: RequestStatus; owner_note?: string | null }) => {
    setBusy(true);
    try {
      await triage(r.id, patch);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ændringen blev ikke gemt.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="flex flex-col gap-2 rounded-panel bg-panel p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[15px] leading-6 font-semibold">{r.title}</h3>
        <Badge variant={VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {[d.area ? AREA_LABEL[d.area] : null, r.created_by_name || null, dateFmt.format(new Date(r.created_at))]
          .filter(Boolean).join(' · ')}
      </p>
      <p className="text-sm leading-6">{r.summary}</p>
      {d.why && <p className="text-sm leading-6 text-muted-foreground"><b className="font-medium text-foreground">Hvorfor: </b>{d.why}</p>}
      {d.acceptance && d.acceptance.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm leading-5 text-muted-foreground">
          {d.acceptance.map((a, i) => <li key={i}>{a}</li>)}
        </ul>
      )}
      {!owner && r.owner_note && (
        <p className="rounded-xl bg-card p-3 text-sm leading-6"><b className="font-medium">Svar: </b>{r.owner_note}</p>
      )}
      {owner && (
        <div className="mt-1 flex flex-col gap-2 border-t pt-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Status for ${r.title}`}>
            {(Object.keys(STATUS_LABEL) as RequestStatus[]).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={r.status === s ? 'default' : 'outline'}
                aria-pressed={r.status === s}
                disabled={busy || r.status === s}
                onClick={() => void run({ status: s })}
              >
                {STATUS_LABEL[s]}
              </Button>
            ))}
          </div>
          <label className="sr-only" htmlFor={`note-${r.id}`}>Svar til dem, der foreslog det</label>
          <Textarea
            id={`note-${r.id}`}
            rows={2}
            maxLength={1000}
            value={note}
            placeholder="Svar eller note …"
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => { if (note.trim() !== (r.owner_note ?? '')) void run({ owner_note: note.trim() || null }); }}
          />
        </div>
      )}
    </article>
  );
}
