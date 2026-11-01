import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { tripDays, whoKeys } from '../lib/balance';
import { fmtN, toTime } from '../lib/dates';
import type { Action } from '../lib/use-ferie';
import type { FerieState, Trip, Who } from '../lib/types';
import { Button } from '../ui/button';
import { LabeledField as Field } from '../labeled-field';
import { Input } from '../ui/input';
import { ResponsiveSheet } from '../ui/sheet';
import { Segmented } from '../ui/segmented';
import { UnitToggle } from '../days-hours-field';
import { fmtHours, parseDays, toInput } from '../lib/units';
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
  dispatch: React.Dispatch<Action>;
  draft: Draft | null;
  onClose: () => void;
  onSave: (d: Draft) => void;
  onDelete: (id: string) => void;
}

export function TripSheet({ state, dispatch, draft, onClose, onSave, onDelete }: Props) {
  return (
    <ResponsiveSheet
      open={draft !== null}
      onOpenChange={(o) => !o && onClose()}
      title={draft?.id ? 'Ret rejse' : 'Ny rejse'}
      description="Feriedage tælles uden weekender, helligdage og faste fridage."
    >
      {draft && <TripForm key={draft.id ?? 'new'} state={state} dispatch={dispatch} draft={draft} onClose={onClose} onSave={onSave} onDelete={onDelete} />}
    </ResponsiveSheet>
  );
}

function TripForm({ state, dispatch, draft, onClose, onSave, onDelete }: Props & { draft: Draft }) {
  const [f, setF] = useState<Draft>(draft);
  const { unit } = state.settings;
  const [override, setOverride] = useState(draft.days === null ? '' : String(toInput(draft.days, unit, state.settings)).replace('.', ','));
  const [confirm, setConfirm] = useState(false);

  const a = toTime(f.from), b = toTime(f.to);
  const valid = !Number.isNaN(a) && !Number.isNaN(b) && b >= a;
  const autos = valid ? whoKeys(f.who).map((k) => tripDays(state, { from: f.from, to: f.to, days: null }, k)) : [0];
  const auto = Math.max(...autos);
  const autoTxt = autos.length > 1 && autos[0] !== autos[1]
    ? whoKeys(f.who).map((k, i) => `${personName(state, k)} ${fmtN(autos[i])}`).join(', ') + ' dage'
    : `${fmtN(auto)} dage = ${fmtHours(auto, state.settings)}`;
  const ov = override.trim() === '' ? null : parseDays(override, unit, state.settings);
  const days = ov !== null && !Number.isNaN(ov) && ov >= 0 ? ov : null;
  const shown = valid ? impact(state, f.who, { from: f.from, to: f.to, days }, f.id) : [];

  const submit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!valid) return;
    onSave({ ...f, name: f.name.trim(), days: ov !== null && !Number.isNaN(ov) && ov >= 0 ? ov : null });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Navn">
        <Input value={f.name} maxLength={60} placeholder="Fx Rovaniemi" autoFocus={!draft.id && !matchMedia('(pointer: coarse)').matches}
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
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Ferie angives i</span>
        <UnitToggle
          unit={unit}
          onChange={(u) => {
            if (ov !== null && !Number.isNaN(ov)) setOverride(String(toInput(ov, u, state.settings)).replace('.', ','));
            dispatch({ type: 'settings', patch: { unit: u } });
          }}
        />
      </div>
      <Field
        label={unit === 'hours' ? 'Ferietimer' : 'Feriedage'}
        hint={valid
          ? `Tælles automatisk til ${autoTxt} (uden weekender, helligdage og faste fridage). Skriv et tal for at overskrive, fx halve dage.${ov !== null && !Number.isNaN(ov) ? ` Nu: ${fmtN(ov)} dage = ${fmtHours(ov, state.settings)}.` : ''}`
          : 'Vælg gyldige datoer'}
      >
        <Input inputMode="decimal" placeholder={String(toInput(auto, unit, state.settings)).replace('.', ',')} value={override} onChange={(e) => setOverride(e.target.value)} />
      </Field>
      {valid && (
        <ul className="grid gap-2 rounded-xl border bg-muted p-3 text-sm" aria-label="Saldo før og efter">
          {shown.map((s) => (
            <li key={s.k} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 font-semibold">
                <i className="size-2.5 rounded-full" style={{ background: personColor(s.k) }} />{personName(state, s.k)}
              </span>
              <span className={s.short ? 'font-bold text-warn' : s.squeezes ? 'text-warn' : ''}>
                {fmtN(s.before)} → <b>{fmtN(s.after)}</b> dage ({fmtHours(s.after, state.settings)})
                {s.short ? ' · mangler dage' : s.squeezes ? ' · gør en senere rejse for dyr' : ''}
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
