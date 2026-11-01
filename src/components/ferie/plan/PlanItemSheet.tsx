import { Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { LabeledField } from '../labeled-field';
import { fmtShort, toISO } from '../lib/dates';
import { PLAN_STATUS, PLAN_TYPES, nextOrder, tripDates, typeInfo } from '../lib/plan';
import type { FerieState, PlanItem, PlanStatus, PlanType, Trip } from '../lib/types';
import { parseNum } from '../kassen/helpers';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '../ui/field';
import { Input } from '../ui/input';
import { ResponsiveSheet } from '../ui/sheet';
import { Segmented } from '../ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { WEEKDAYS } from '../lib/dates';

export interface PlanDraft {
  id?: string;
  type: PlanType;
  status: PlanStatus;
  day: string | null;
  title: string;
  time: string;
  place: string;
  link: string;
  note: string;
  bookBy: string;
  price: string;
  inBudget: boolean;
}

export const draftFromPlan = (it: PlanItem): PlanDraft => ({
  id: it.id, type: it.type, status: it.status, day: it.day, title: it.title, time: it.time, place: it.place,
  link: it.link, note: it.note, bookBy: it.bookBy, price: it.price === null ? '' : String(it.price), inBudget: it.inBudget,
});

export const newPlanDraft = (day: string | null, type: PlanType): PlanDraft => ({
  type, status: 'idea', day, title: '', time: '', place: '', link: '', note: '', bookBy: '', price: '', inBudget: false,
});

interface Props {
  state: FerieState;
  trip: Trip;
  draft: PlanDraft | null;
  onClose: () => void;
  onSave: (item: PlanItem) => void;
  onDelete: (id: string) => void;
}

export function PlanItemSheet(props: Props) {
  const { draft, onClose } = props;
  return (
    <ResponsiveSheet
      open={draft !== null}
      onOpenChange={(o) => !o && onClose()}
      title={draft?.id ? 'Ret plan' : 'Ny plan'}
      description="Planer kan ligge på en dag eller i idébanken."
    >
      {draft && <PlanForm key={draft.id ?? 'new'} {...props} draft={draft} />}
    </ResponsiveSheet>
  );
}

function PlanForm({ state, trip, draft, onClose, onSave, onDelete }: Props & { draft: PlanDraft }) {
  const [f, setF] = useState<PlanDraft>(draft);
  const [confirm, setConfirm] = useState(false);
  const info = typeInfo(f.type);
  const price = parseNum(f.price);
  const dates = tripDates(trip);
  const old = draft.id ? state.itin.find((x) => x.id === draft.id) : undefined;

  const submit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    const title = f.title.trim();
    if (!title) return;
    const day = f.day || null;
    const order = !old || old.day !== day ? nextOrder(state.itin.filter((x) => x.id !== old?.id), trip.id, day) : old.order;
    onSave({
      id: old?.id ?? '', tripId: trip.id, type: f.type, title, day, time: f.time, place: f.place.trim(),
      link: f.link.trim(), note: f.note.trim(), status: f.status, bookBy: f.status === 'booked' ? '' : f.bookBy,
      price, inBudget: f.inBudget && price !== null, moneyId: old?.moneyId ?? null, order, created: old?.created ?? 0,
    });
  };

  return (
    <form onSubmit={submit}>
      <FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="p-type">Type</FieldLabel>
            <Select value={f.type} onValueChange={(type) => setF({ ...f, type: type as PlanType })}>
              <SelectTrigger id="p-type" className="h-11 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{PLAN_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="p-day">Dag</FieldLabel>
            <Select value={f.day ?? 'ideas'} onValueChange={(v) => setF({ ...f, day: v === 'ideas' ? null : v })}>
              <SelectTrigger id="p-day" className="h-11 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ideas">Idébanken</SelectItem>
                {dates.map((t, i) => (
                  <SelectItem key={t} value={toISO(t)}>Dag {i + 1}: {WEEKDAYS[new Date(t).getUTCDay()]} {fmtShort(t)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <LabeledField label="Navn">
          <Input value={f.title} maxLength={80} placeholder={info.placeholder} autoFocus={!draft.id} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </LabeledField>
        <div className="grid grid-cols-2 gap-3">
          <LabeledField label="Tidspunkt"><Input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></LabeledField>
          <LabeledField label="Sted"><Input value={f.place} maxLength={80} onChange={(e) => setF({ ...f, place: e.target.value })} /></LabeledField>
        </div>
        <Field>
          <FieldLabel>Status</FieldLabel>
          <Segmented label="Status" value={f.status} onValueChange={(status) => setF({ ...f, status })} options={PLAN_STATUS} />
        </Field>
        {f.status !== 'booked' && (
          <LabeledField label="Book senest" hint="Bliver gult 14 dage før og rødt, når fristen er overskredet.">
            <Input type="date" value={f.bookBy} onChange={(e) => setF({ ...f, bookBy: e.target.value })} />
          </LabeledField>
        )}
        <div className="grid grid-cols-2 gap-3">
          <LabeledField label="Pris (kr.)"><Input inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></LabeledField>
          <LabeledField label="Link"><Input inputMode="url" placeholder="https://" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} /></LabeledField>
        </div>
        <Field orientation="horizontal">
          <Checkbox id="p-budget" checked={f.inBudget && price !== null} disabled={price === null} onCheckedChange={(v) => setF({ ...f, inBudget: v === true })} />
          <div className="flex flex-col gap-0.5">
            <FieldLabel htmlFor="p-budget">Læg i rejsekassen</FieldLabel>
            <FieldDescription>{price !== null ? 'Prisen lægges ind som en udgift på rejsens budget.' : 'Skriv en pris for at kunne lægge den i rejsekassen.'}</FieldDescription>
          </div>
        </Field>
        <LabeledField label="Noter"><Textarea rows={3} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></LabeledField>
        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={!f.title.trim()}>Gem</Button>
          <Button variant="outline" onClick={onClose}>Annullér</Button>
          {draft.id && (confirm
            ? <Button variant="destructive" onClick={() => onDelete(draft.id!)}>Slet{old?.moneyId ? ' (og udgift)' : ''}</Button>
            : <Button variant="ghost" size="icon" aria-label="Slet plan" onClick={() => setConfirm(true)}><Trash2Icon className="text-warn" /></Button>)}
        </div>
      </FieldGroup>
    </form>
  );
}
