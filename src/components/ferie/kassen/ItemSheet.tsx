import { Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { LabeledField } from '../labeled-field';
import { fmtRange, toTime } from '../lib/dates';
import { sortedTrips } from '../lib/balance';
import { CATEGORIES, type FerieState, type MoneyItem, type Payer } from '../lib/types';
import { Button } from '../ui/button';
import { Field, FieldGroup, FieldLabel } from '../ui/field';
import { Input } from '../ui/input';
import { ResponsiveSheet } from '../ui/sheet';
import { Segmented } from '../ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { parseNum, payerOptions } from './helpers';

export interface ItemDraft {
  id?: string;
  kind: 'expense' | 'deposit';
  tripId: string | null;
  cat: string;
  label: string;
  est: string;
  act: string;
  date: string;
  payer: Payer;
  fromPlan?: boolean;
}

export const draftFromItem = (it: MoneyItem): ItemDraft => ({
  id: it.id, kind: it.kind, tripId: it.tripId, cat: CATEGORIES.includes(it.cat as never) ? it.cat : 'Andet',
  label: it.label, est: it.est === null ? '' : String(it.est), act: it.act === null ? '' : String(it.act),
  date: it.date, payer: it.payer, fromPlan: it.fromPlan,
});

interface Props {
  state: FerieState;
  draft: ItemDraft | null;
  onClose: () => void;
  onSave: (item: Omit<MoneyItem, 'created'> & { created?: number }) => void;
  onDelete: (id: string) => void;
}

export function ItemSheet(props: Props) {
  const { draft, onClose } = props;
  return (
    <ResponsiveSheet
      open={draft !== null}
      onOpenChange={(o) => !o && onClose()}
      title={draft?.kind === 'deposit' ? (draft.id ? 'Ret indskud' : 'Nyt indskud') : draft?.id ? 'Ret udgift' : 'Ny udgift'}
      description="Estimater vises stiplet, til de er betalt."
    >
      {draft && <ItemForm key={draft.id ?? 'new'} {...props} draft={draft} />}
    </ResponsiveSheet>
  );
}

function ItemForm({ state, draft, onClose, onSave, onDelete }: Props & { draft: ItemDraft }) {
  const [f, setF] = useState<ItemDraft>(draft);
  const [confirm, setConfirm] = useState(false);
  const dep = f.kind === 'deposit';
  const est = parseNum(f.est);
  const act = parseNum(f.act);
  const valid = est !== null || act !== null;
  const paid = f.act.trim() !== '';
  const trips = sortedTrips(state.trips);

  const submit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!valid) return;
    onSave({
      id: f.id ?? '',
      kind: f.kind,
      tripId: dep ? null : f.tripId,
      cat: dep ? 'Indskud' : f.cat,
      label: f.label.trim(),
      est, act,
      date: f.date,
      payer: dep ? 'acc' : f.payer,
      fromPlan: f.fromPlan,
    });
  };

  return (
    <form onSubmit={submit}>
      <FieldGroup>
        {!draft.id && (
          <Segmented
            label="Type"
            value={f.kind}
            onValueChange={(kind) => setF({ ...f, kind })}
            options={[{ value: 'expense', label: 'Udgift' }, { value: 'deposit', label: 'Ekstra indskud' }]}
          />
        )}
        {!dep && (
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="it-trip">Rejse</FieldLabel>
              <Select value={f.tripId ?? 'none'} onValueChange={(v) => setF({ ...f, tripId: v === 'none' ? null : v })}>
                <SelectTrigger id="it-trip" className="h-11 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ingen rejse</SelectItem>
                  {trips.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name || 'Rejse'}, {fmtRange(toTime(t.from), toTime(t.to), state.settings.year)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="it-cat">Kategori</FieldLabel>
              <Select value={f.cat} onValueChange={(cat) => setF({ ...f, cat })}>
                <SelectTrigger id="it-cat" className="h-11 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
        )}
        <LabeledField label="Beskrivelse">
          <Input value={f.label} maxLength={60} placeholder={dep ? 'Fx feriepenge eller skat tilbage' : 'Fx flybilletter t/r'} onChange={(e) => setF({ ...f, label: e.target.value })} />
        </LabeledField>
        <div className="grid grid-cols-2 gap-3">
          <LabeledField label={dep ? 'Forventet beløb' : 'Estimeret beløb'}>
            <Input inputMode="decimal" placeholder="kr." value={f.est} onChange={(e) => setF({ ...f, est: e.target.value })} />
          </LabeledField>
          <LabeledField label={dep ? 'Indsat beløb' : 'Faktisk beløb'}>
            <Input inputMode="decimal" placeholder={dep ? 'Når det er sat ind' : 'Når det er betalt'} value={f.act} onChange={(e) => setF({ ...f, act: e.target.value })} />
          </LabeledField>
        </div>
        <LabeledField label={paid ? (dep ? 'Sat ind d.' : 'Betalt d.') : dep ? 'Hvornår kommer pengene?' : 'Hvornår betales det?'}>
          <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </LabeledField>
        {!dep && (
          <Field>
            <FieldLabel>Betales af</FieldLabel>
            <Segmented label="Betales af" value={f.payer} onValueChange={(payer) => setF({ ...f, payer })} options={payerOptions(state)} />
          </Field>
        )}
        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={!valid}>Gem</Button>
          <Button variant="outline" onClick={onClose}>Annullér</Button>
          {draft.id && (confirm
            ? <Button variant="destructive" onClick={() => onDelete(draft.id!)}>Slet</Button>
            : <Button variant="ghost" size="icon" aria-label="Slet" onClick={() => setConfirm(true)}><Trash2Icon className="text-warn" /></Button>)}
        </div>
      </FieldGroup>
    </form>
  );
}
