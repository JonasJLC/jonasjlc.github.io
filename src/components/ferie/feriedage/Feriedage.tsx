import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { addWorkDays } from '../lib/holidays';
import { PlaneIcon, PlusIcon } from 'lucide-react';
import { commonDaysOff, lostInYear, sortedTrips, whoKeys } from '../lib/balance';
import { DAY, fmtN, fmtShort, toISO, toTime, todayTime } from '../lib/dates';
import { earliestAffordable } from '../lib/finder';
import { PERSON_KEYS } from '../lib/types';
import { PageTitle, PersonDots } from '../page';
import { Button } from '../ui/button';
import { newId, type Action } from '../lib/use-ferie';
import type { FerieState, Trip, Who } from '../lib/types';
import { findBridges } from '../lib/bridges';
import { BridgeList } from './BridgeList';
import { BridgeTip } from './BridgeTip';
import { Finder } from './Finder';
import { PeopleSummary } from './PeopleSummary';
import { SelectionBar } from './SelectionBar';
import { TripList } from './TripList';
import { fmtDaysRange, impact, personName, tripDays } from './helpers';
import { TripSheet, draftFromTrip, type Draft } from './TripSheet';
import { YearCalendar, type Selection } from './YearCalendar';

export function Feriedage({
  state, dispatch, onEditBalance,
}: {
  state: FerieState; dispatch: React.Dispatch<Action>; onEditBalance: () => void;
}) {
  const [sel, setSel] = useState<Selection>({ from: null, to: null });
  const [draft, setDraft] = useState<Draft | null>(null);
  const bridges = useMemo(() => {
    // Only stretches that lie inside the year on screen: list, calendar marks and pop-up share this.
    const Y = state.settings.year;
    return findBridges(state, todayTime()).filter((b) => new Date(b.from).getUTCFullYear() === Y && new Date(b.to).getUTCFullYear() === Y);
  }, [state]);

  const tripAt = (t: number) => state.trips.find((tr) => toTime(tr.from) <= t && toTime(tr.to) >= t);

  const onPick = (t: number) => {
    if (sel.from !== null && sel.to === null) {
      setSel({ from: Math.min(sel.from, t), to: Math.max(sel.from, t) });
      return;
    }
    const trip = tripAt(t);
    if (trip) {
      setSel({ from: null, to: null });
      setDraft(draftFromTrip(trip));
      return;
    }
    setSel({ from: t, to: null });
  };

  const openNew = (from: number, to: number, who: Who = 'both') =>
    setDraft({ name: '', from: toISO(from), to: toISO(to), who, days: null });

  const save = (d: Draft) => {
    const existing = d.id ? state.trips.find((t) => t.id === d.id) : undefined;
    const trip: Trip = {
      id: d.id ?? newId(), name: d.name, from: d.from, to: d.to, who: d.who, days: d.days,
      created: existing?.created ?? Date.now(),
    };
    dispatch({ type: 'saveTrip', trip });
    setDraft(null);
    setSel({ from: null, to: null });
    toast.success(existing ? 'Rejsen er rettet' : 'Rejsen er gemt');
  };

  const remove = (id: string) => {
    const trip = state.trips.find((t) => t.id === id);
    dispatch({ type: 'deleteTrip', id });
    setDraft(null);
    toast('Rejsen er slettet', trip ? { action: { label: 'Fortryd', onClick: () => dispatch({ type: 'saveTrip', trip }) } } : undefined);
  };

  const today = new Date();
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div>
      <PageTitle
        title={`Feriedage ${state.settings.year}`}
        actions={
          <>
            <NextTrip state={state} onOpen={(t) => setDraft(draftFromTrip(t))} />
            <Button onClick={() => openNew(start, start)}><PlusIcon aria-hidden />Ny rejse</Button>
          </>
        }
      >
        <Finding state={state} />
      </PageTitle>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <PeopleSummary state={state} onEditBalance={onEditBalance} />
        </div>
        <div className="grid items-start gap-4 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-8">
            <YearCalendar state={state} selection={sel} bridges={bridges} onPick={onPick} />
            <BridgeList bridges={bridges} year={state.settings.year} onUse={openNew} />
          </div>
          <div className="order-first flex min-w-0 flex-col gap-4 lg:sticky lg:top-6 lg:order-none lg:col-span-4">
            <TripList state={state} onEdit={(t) => setDraft(draftFromTrip(t))} />
            <Finder
              state={state}
              dispatch={dispatch}
              onCreate={(from, days, who) => openNew(from, Math.max(from, addWorkDays(from, days, commonDaysOff(state, who))), who)}
            />
          </div>
        </div>
      </div>
      <SelectionBar
        state={state}
        selection={sel}
        onClear={() => setSel({ from: null, to: null })}
        onContinue={() => {
          if (sel.from !== null && sel.to !== null) openNew(sel.from, sel.to);
        }}
      />
      <BridgeTip state={state} bridges={bridges} year={state.settings.year} onUse={openNew} />
      <TripSheet state={state} dispatch={dispatch} draft={draft} onClose={() => setDraft(null)} onSave={save} onDelete={remove} />
    </div>
  );
}

/** The one thing to know about this year's days: a trip you can't afford yet, days about to be lost, or all clear. */
function Finding({ state }: { state: FerieState }) {
  const today = todayTime();
  const Y = state.settings.year;
  const upcoming = sortedTrips(state.trips).filter((t) => toTime(t.to) >= today);
  for (const t of upcoming) {
    const short = impact(state, t.who, t, t.id).find((s) => s.short);
    if (!short) continue;
    const when = earliestAffordable(state, short.days, [short.k], today, t.id);
    // "16. nov." already ends the sentence; "16. maj" needs its full stop.
    const date = fmtShort(toTime(t.from)).replace(/\.$/, '');
    return (
      <span className="font-medium text-warn">
        {personName(state, short.k)} har ikke dage nok til {t.name || 'rejsen'} {date}.
        {when ? ` Der er nok fra ${fmtShort(when, true)}.` : ''}
      </span>
    );
  }
  const lost = PERSON_KEYS.map((k) => ({ k, v: lostInYear(state, k, Y) })).filter((x) => x.v > 1e-9);
  if (lost.length) {
    return (
      <span className="text-caution">
        {lost.map((x) => `${personName(state, x.k)} har ${fmtN(x.v)} ${x.v === 1 ? 'dag' : 'dage'}, der udløber 31. dec. ${Y}`).join(' og ')}, hvis de ikke bliver holdt eller overført.
      </span>
    );
  }
  if (!upcoming.length) return <>Ingen rejser planlagt endnu. Vælg datoer i kalenderen for at lægge den første ind.</>;
  return <span className="text-foreground">I har dage nok til {upcoming.length === 1 ? 'rejsen' : `alle ${upcoming.length} rejser`}.</span>;
}

/** The next trip (or the one under way) and how long until it, as a shortcut to open it. */
function NextTrip({ state, onOpen }: { state: FerieState; onOpen: (t: Trip) => void }) {
  const today = todayTime();
  const trip = sortedTrips(state.trips).find((t) => !Number.isNaN(toTime(t.from)) && toTime(t.to) >= today);
  if (!trip) return null;
  const from = toTime(trip.from), to = toTime(trip.to);
  const name = trip.name || 'Rejsen';
  const days = (a: number, b: number) => Math.round((b - a) / DAY);
  const n = days(today, from);
  const left = days(today, to);
  const when = from <= today
    ? left === 0 ? 'slutter i dag' : `i gang, ${left === 1 ? '1 dag' : `${left} dage`} tilbage`
    : n === 1 ? 'i morgen' : `om ${n} dage`;
  const cost = fmtDaysRange(whoKeys(trip.who).map((k) => tripDays(state, trip, k)));
  return (
    <Button
      variant="outline"
      className="h-auto max-w-full py-1.5 md:h-auto"
      onClick={() => onOpen(trip)}
      aria-label={`Næste rejse: ${name} ${when}, ${fmtShort(from, true)}, ${cost} feriedage. Åbn rejsen.`}
    >
      <PlaneIcon aria-hidden className="text-data" />
      <span className="flex min-w-0 flex-col items-start text-left leading-5">
        <span className="truncate">
          <span className="font-semibold">{name}</span> {when}
        </span>
        <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
          <PersonDots who={trip.who} />
          {fmtShort(from)} · {cost} {cost === '1' ? 'feriedag' : 'feriedage'}
        </span>
      </span>
    </Button>
  );
}
