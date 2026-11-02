import { Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { LabeledField } from '../labeled-field';
import { fmtShort, toISO } from '../lib/dates';
import { PLAN_STATUS, PLAN_TYPES, nextOrder, parseMins, tripDates, typeInfo } from '../lib/plan';
import { flightOf } from '../lib/store';
import type { FerieState, Flight, PlanItem, PlanStatus, PlanType, Trip } from '../lib/types';
import { parseNum } from '../kassen/helpers';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '../ui/field';
import { Input } from '../ui/input';
import { PlaceInput } from './PlaceInput';
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
  lat?: number;
  lng?: number;
  link: string;
  note: string;
  bookBy: string;
  price: string;
  inBudget: boolean;
  /** Transport only: show and save the flight fields. */
  fly: boolean;
  flight: FlightDraft;
}

type FlightDraft = Omit<Flight, 'mins'> & { mins: string };

const emptyFlight = (): FlightDraft => ({ from: '', fromCity: '', to: '', toCity: '', dep: '', arr: '', arrPlus: 0, mins: '', airline: '', no: '', ref: '' });

export const draftFromPlan = (it: PlanItem): PlanDraft => ({
  id: it.id, type: it.type, status: it.status, day: it.day, title: it.title, time: it.time, place: it.place, lat: it.lat, lng: it.lng,
  link: it.link, note: it.note, bookBy: it.bookBy, price: it.price === null ? '' : String(it.price), inBudget: it.inBudget,
  fly: !!it.flight,
  flight: it.flight ? { ...it.flight, mins: it.flight.mins ? `${Math.floor(it.flight.mins / 60)}:${String(it.flight.mins % 60).padStart(2, '0')}` : '' } : emptyFlight(),
});

export const newPlanDraft = (day: string | null, type: PlanType, fly = false): PlanDraft => ({
  type, status: 'idea', day, title: '', time: '', place: '', link: '', note: '', bookBy: '', price: '', inBudget: false,
  fly, flight: emptyFlight(),
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
      title={draft?.id ? (draft.fly ? 'Ret fly' : 'Ret plan') : draft?.fly ? 'Nyt fly' : 'Ny plan'}
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
  const isFly = f.type === 'transport' && f.fly;
  const fl = (patch: Partial<FlightDraft>) => setF({ ...f, flight: { ...f.flight, ...patch } });
  const canSave = !!f.title.trim() || (isFly && !!(f.flight.from || f.flight.to || f.flight.no));

  const submit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    const flight = isFly ? flightOf({ ...f.flight, mins: parseMins(f.flight.mins) }) : undefined;
    // Flights have no name field: the title always follows the airports, so it never goes stale.
    const title = flight ? autoTitle(f.flight) || f.title.trim() || (f.flight.no ? `Fly ${f.flight.no}` : 'Fly') : f.title.trim();
    if (!title) return;
    const day = f.day || null;
    const order = !old || old.day !== day ? nextOrder(state.itin.filter((x) => x.id !== old?.id), trip.id, day) : old.order;
    onSave({
      id: old?.id ?? '', tripId: trip.id, type: f.type, title, day, time: flight?.dep || f.time, place: f.place.trim(),
      ...(f.lat !== undefined && f.lng !== undefined && f.place.trim() ? { lat: f.lat, lng: f.lng } : {}),
      link: f.link.trim(), note: f.note.trim(), status: f.status, bookBy: f.status === 'booked' ? '' : f.bookBy,
      price, inBudget: f.inBudget && price !== null, moneyId: old?.moneyId ?? null, order, created: old?.created ?? 0,
      ...(flight ? { flight } : {}),
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
        {f.type === 'transport' && (
          <Segmented
            label="Slags transport"
            value={f.fly ? 'fly' : 'other'}
            onValueChange={(v) => setF({ ...f, fly: v === 'fly' })}
            options={[{ value: 'fly', label: 'Fly' }, { value: 'other', label: 'Anden transport' }]}
          />
        )}
        {isFly && <FlightFields f={f.flight} onChange={fl} autoFocus={!draft.id} />}
        {!isFly && (
          <>
            <LabeledField label="Navn">
              <Input value={f.title} maxLength={80} placeholder={info.placeholder} autoFocus={!draft.id} onChange={(e) => setF({ ...f, title: e.target.value })} />
            </LabeledField>
            <div className="grid grid-cols-2 gap-3">
              <LabeledField label="Tidspunkt"><Input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></LabeledField>
              <LabeledField label="Sted">
                <PlaceInput
                  value={f.place}
                  lat={f.lat}
                  lng={f.lng}
                  maxLength={80}
                  className="h-11 rounded-[10px] border border-input bg-card px-3 transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 md:h-[38px]"
                  onChange={(p) => setF({ ...f, place: p.base, lat: p.lat, lng: p.lng })}
                />
              </LabeledField>
            </div>
          </>
        )}
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
          <Button type="submit" className="flex-1" disabled={!canSave}>Gem</Button>
          <Button variant="outline" onClick={onClose}>Annullér</Button>
          {draft.id && (confirm
            ? <Button variant="destructive" onClick={() => onDelete(draft.id!)}>Slet{old?.moneyId ? ' (og udgift)' : ''}</Button>
            : <Button variant="ghost" size="icon" aria-label="Slet plan" onClick={() => setConfirm(true)}><Trash2Icon className="text-warn" /></Button>)}
        </div>
      </FieldGroup>
    </form>
  );
}

const autoTitle = (fl: FlightDraft) => (fl.from && fl.to ? `Fly ${fl.from.toUpperCase()}–${fl.to.toUpperCase()}` : '');

/** Airports, times, carrier and booking reference for a flight. */
function FlightFields({ f, onChange, autoFocus }: { f: FlightDraft; onChange: (p: Partial<FlightDraft>) => void; autoFocus?: boolean }) {
  const iata = (v: string) => v.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  return (
    <fieldset className="flex flex-col gap-4 rounded-card bg-cat-transport-tint/60 p-4">
      <legend className="sr-only">Flyoplysninger</legend>
      <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3">
        <LabeledField label="Fra"><Input value={f.from} placeholder="CPH" autoCapitalize="characters" autoFocus={autoFocus} className="font-semibold tracking-wide" onChange={(e) => onChange({ from: iata(e.target.value) })} /></LabeledField>
        <LabeledField label="By"><Input value={f.fromCity} maxLength={40} placeholder="København" onChange={(e) => onChange({ fromCity: e.target.value })} /></LabeledField>
        <LabeledField label="Til"><Input value={f.to} placeholder="RVN" autoCapitalize="characters" className="font-semibold tracking-wide" onChange={(e) => onChange({ to: iata(e.target.value) })} /></LabeledField>
        <LabeledField label="By"><Input value={f.toCity} maxLength={40} placeholder="Rovaniemi" onChange={(e) => onChange({ toCity: e.target.value })} /></LabeledField>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <LabeledField label="Afgang"><Input type="time" value={f.dep} onChange={(e) => onChange({ dep: e.target.value })} /></LabeledField>
        <LabeledField label="Ankomst"><Input type="time" value={f.arr} onChange={(e) => onChange({ arr: e.target.value })} /></LabeledField>
        <LabeledField label="Flyvetid"><Input value={f.mins} inputMode="numeric" placeholder="2:25" onChange={(e) => onChange({ mins: e.target.value })} /></LabeledField>
      </div>
      <Field orientation="horizontal">
        <Checkbox id="p-arrplus" checked={f.arrPlus === 1} onCheckedChange={(v) => onChange({ arrPlus: v === true ? 1 : 0 })} />
        <FieldLabel htmlFor="p-arrplus">Lander dagen efter</FieldLabel>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <LabeledField label="Selskab"><Input value={f.airline} maxLength={40} placeholder="SAS" onChange={(e) => onChange({ airline: e.target.value })} /></LabeledField>
        <LabeledField label="Flynr."><Input value={f.no} maxLength={12} placeholder="SK 1302" autoCapitalize="characters" onChange={(e) => onChange({ no: e.target.value })} /></LabeledField>
        <LabeledField label="Bookingnr."><Input value={f.ref} maxLength={12} autoCapitalize="characters" onChange={(e) => onChange({ ref: e.target.value })} /></LabeledField>
      </div>
    </fieldset>
  );
}
