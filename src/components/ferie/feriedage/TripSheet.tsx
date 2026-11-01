import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { tripDays } from '../lib/balance';
import { fmtN, toTime } from '../lib/dates';
import type { FerieState, Trip, Who } from '../lib/types';
import { Button } from '../ui/button';
import { Field, Input } from '../ui/input';
import { ResponsiveSheet } from '../ui/sheet';
import { Segmented } from '../ui/toggle-group';
import { impact, personColor, personName, whoOptions } from './helpers';

export interface Draft {
  id?: string;
  name: string;
  from: string;
  to: string;
  who: Who;
  days: number | null;
}

interface Props {
  state: FerieState;
  draft: Draft | null;
  onClose: () => void;
  onSave: (d: Draft) => void;
  onDelete: (id: string) => void;
}

export function TripSheet({ state, draft, onClose, onSave, onDelete }: Props) {
  return (
    <ResponsiveSheet
      open={draft !== null}
      onOpenChange={(o) => !o && onClose()}
      title={draft?.id ? 'Ret rejse' : 'Ny rejse'}
      description="Feriedage tælles uden weekender og helligdage."
    >
      {draft && <TripForm key={draft.id ?? 'new'} state={state} draft={draft} onClose={onClose} onSave={onSave} onDelete={onDelete} />}
    </ResponsiveSheet>
  );
}

function TripForm({ state, draft, onClose, onSave, onDelete }: Props & { draft: Draft }) {
  const [f, setF] = useState<Draft>(draft);
  const [override, setOverride] = useState(draft.days === null ? '' : String(draft.days));
  const [confirm, setConfirm] = useState(false);

  const a = toTime(f.from), b = toTime(f.to);
  const valid = !Number.isNaN(a) && !Number.isNaN(b) && b >= a;
  const auto = valid ? tripDays({ from: f.from, to: f.to, days: null }, state.settings.extraOff) : 0;
  const ov = override.trim() === '' ? null : Number(override.replace(',', '.'));
  const days = ov !== null && !Number.isNaN(ov) && ov >= 0 ? ov : auto;
  const shown = valid ? impact(state, f.who, a, days, f.id) : [];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onSave({ ...f, name: f.name.trim(), days: ov !== null && !Number.isNaN(ov) && ov >= 0 ? ov : null });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Navn">
        <Input value={f.name} maxLength={60} placeholder="Fx Rovaniemi" autoFocus={!draft.id}
          onChange={(e) => setF({ ...f, name: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fra"><Input type="date" required value={f.from} onChange={(e) => setF({ ...f, from: e.target.value, to: f.to < e.target.value ? e.target.value : f.to })} /></Field>
        <Field label="Til"><Input type="date" required min={f.from} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Hvem tager med?</span>
        <Segmented label="Hvem tager med" value={f.who} onValueChange={(who) => setF({ ...f, who })} options={whoOptions(state)} />
      </div>
      <Field
        label="Feriedage"
        hint={valid ? `Tælles automatisk til ${fmtN(auto)} (uden weekender og helligdage). Skriv et tal for at overskrive, fx 4,5 ved halve dage.` : 'Vælg gyldige datoer'}
      >
        <Input inputMode="decimal" placeholder={fmtN(auto)} value={override} onChange={(e) => setOverride(e.target.value)} />
      </Field>
      {valid && (
        <ul className="grid gap-2 rounded-xl border bg-muted p-3 text-sm" aria-label="Saldo før og efter">
          {shown.map((s) => (
            <li key={s.k} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 font-semibold">
                <i className="size-2.5 rounded-full" style={{ background: personColor(s.k) }} />{personName(state, s.k)}
              </span>
              <span className={s.lowest < -1e-9 ? 'font-bold text-warn' : ''}>
                {fmtN(s.before)} → <b>{fmtN(s.after)}</b>
                {s.lowest < -1e-9 ? ' · mangler dage' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2 pt-1">
        <Button type="submit" className="flex-1" disabled={!valid}>Gem</Button>
        <Button variant="outline" onClick={onClose}>Annullér</Button>
        {draft.id && (
          confirm ? (
            <Button variant="destructive" onClick={() => onDelete(draft.id!)}>Slet rejsen</Button>
          ) : (
            <Button variant="ghost" size="icon" aria-label="Slet rejse" onClick={() => setConfirm(true)}><Trash2 className="text-warn" /></Button>
          )
        )}
      </div>
    </form>
  );
}

export const draftFromTrip = (t: Trip): Draft => ({ id: t.id, name: t.name, from: t.from, to: t.to, who: t.who, days: t.days });
