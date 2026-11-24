import { useState } from 'react';
import { STATUS_LABEL, areaLabel, effectiveStatus, sortRequests, triage, type Board, type FeatureRequest, type IssueStates, type RequestStatus } from '../lib/forslag';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { Chip } from '../ui/chip';
import { Textarea } from '../ui/textarea';
import { notify } from '../ui/toast';

const TONE: Record<RequestStatus, 'neutral' | 'positive'> = {
  new: 'neutral', approved: 'positive', building: 'positive', done: 'positive', declined: 'neutral',
};

const dateFmt = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });

export function RequestList({ board, issues, onChanged }: { board: Board; issues: IssueStates; onChanged: () => void }) {
  if (board.requests.length === 0) {
    return <p className="sp-body text-sp-muted">Ingen forslag endnu. Det første kan blive dit.</p>;
  }
  return (
    <ul className="flex flex-col gap-sp-gap">
      {sortRequests(board.requests, issues).map((r) => (
        <li key={r.id}><Item r={r} status={effectiveStatus(r, issues)} owner={board.isOwner} onChanged={onChanged} /></li>
      ))}
    </ul>
  );
}

function Item({ r, status, owner, onChanged }: { r: FeatureRequest; status: RequestStatus; owner: boolean; onChanged: () => void }) {
  const [note, setNote] = useState(r.owner_note ?? '');
  const [busy, setBusy] = useState(false);
  const d = r.details ?? {};
  const first = r.created_by_name.includes('@') ? '' : r.created_by_name.trim().split(/\s+/)[0];

  const run = async (patch: { status?: RequestStatus; owner_note?: string | null }) => {
    setBusy(true);
    try {
      await triage(r.id, patch);
      onChanged();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Ændringen blev ikke gemt.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card role="article" className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <h2 className="sp-title-group">{r.title}</h2>
        <Badge tone={TONE[status]}>{STATUS_LABEL[status]}</Badge>
      </div>
      <p className="sp-small text-sp-muted">
        {[areaLabel('strandparken', d.area), first || null, dateFmt.format(new Date(r.created_at))].filter(Boolean).join(' · ')}
      </p>
      <p className="sp-body">{r.summary}</p>
      {d.why && <p className="sp-body text-sp-muted"><b className="sp-body-strong text-sp-ink">Hvorfor: </b>{d.why}</p>}
      {d.acceptance && d.acceptance.length > 0 && (
        <ul className="sp-body list-disc space-y-1 pl-5 text-sp-muted">
          {d.acceptance.map((a, i) => <li key={i}>{a}</li>)}
        </ul>
      )}
      {r.github_issue_url && (
        <a href={r.github_issue_url} target="_blank" rel="noreferrer" className="sp-small inline-flex min-h-sp-target w-fit items-center text-sp-primary underline underline-offset-2">
          GitHub #{r.github_issue_number}
        </a>
      )}
      {!owner && r.owner_note && (
        <p className="sp-body rounded-sp-row bg-sp-bg p-3"><b className="sp-body-strong">Svar: </b>{r.owner_note}</p>
      )}
      {owner && (
        <div className="mt-1 flex flex-col gap-2 border-t border-sp-line-soft pt-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label={`Status for ${r.title}`}>
            {(Object.keys(STATUS_LABEL) as RequestStatus[]).map((s) => (
              <Chip key={s} selected={status === s} disabled={busy || r.status === s} onClick={() => void run({ status: s })}>
                {STATUS_LABEL[s]}
              </Chip>
            ))}
          </div>
          <label className="sr-only" htmlFor={`note-${r.id}`}>Svar til dem, der foreslog det</label>
          <Textarea
            id={`note-${r.id}`}
            className="bg-sp-bg"
            rows={2}
            maxLength={1000}
            value={note}
            placeholder="Svar eller note …"
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => { if (note.trim() !== (r.owner_note ?? '')) void run({ owner_note: note.trim() || null }); }}
          />
        </div>
      )}
    </Card>
  );
}
