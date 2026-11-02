import {
  DndContext, KeyboardSensor, PointerSensor, closestCorners, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ChevronDownIcon } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { commonDaysOff, sortedTrips } from '../lib/balance';
import { fmtShort, toISO, toTime, todayTime } from '../lib/dates';
import { distanceKm } from '../lib/geo';
import { dayKey, nextStatus, sortPlan, tripDates } from '../lib/plan';
import { newId, type Action } from '../lib/use-ferie';
import type { CheckItem, FerieState, PlanItem, PlanType } from '../lib/types';
import { PageTitle, SectionTitle } from '../page';
import { DayCard } from './DayCard';
import { DestinationTips } from './DestinationTips';
import { PlanItemSheet, draftFromPlan, newPlanDraft, type PlanDraft } from './PlanItemSheet';
import { PlanRow } from './PlanRow';
import { Route } from './Route';
import { Checklist, IdeaBank, ToBook } from './Side';
import { TripHeader, TripPicker } from './TripHeader';

const KEY = 'ferie-plan-trip';
const readTrip = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const DAYS_KEY = 'ferie-plan-days-folded';
const readFolded = () => { try { return localStorage.getItem(DAYS_KEY) === '1'; } catch { return false; } };

export function Plan({ state, dispatch }: { state: FerieState; dispatch: React.Dispatch<Action> }) {
  const today = todayTime();
  const trips = sortedTrips(state.trips);
  const [picked, setPicked] = useState<string | null>(readTrip);
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [folded, setFolded] = useState(readFolded);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const trip = trips.find((t) => t.id === picked) ?? trips.find((t) => toTime(t.to) >= today) ?? trips[trips.length - 1] ?? null;
  const items = useMemo(() => (trip ? state.itin.filter((x) => x.tripId === trip.id) : []), [state.itin, trip]);

  const select = (id: string) => {
    setPicked(id);
    try { localStorage.setItem(KEY, id); } catch { /* ignore */ }
  };

  if (!trip) {
    return (
      <div>
        <PageTitle title="Rejseplan">Ingen rejser endnu.</PageTitle>
        <div className="rounded-panel bg-panel p-5 text-sm text-muted-foreground">
          Læg en rejse ind under <a href="#feriedage" className="font-medium text-foreground underline underline-offset-4">Feriedage</a>, så kan I planlægge dagene her.
        </div>
      </div>
    );
  }

  const dates = tripDates(trip);
  const daysOff = commonDaysOff(state, trip.who);
  const byDay = (ds: string | null) => items.filter((x) => (x.day ?? null) === ds);

  const toggleFolded = (v: boolean) => {
    setFolded(v);
    try { localStorage.setItem(DAYS_KEY, v ? '1' : '0'); } catch { /* ignore */ }
  };

  const goto = (ds: string) => {
    const scroll = () => {
      const el = document.getElementById(`pday-${ds}`);
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    };
    // A folded list has no day cards to scroll to: open it first.
    if (folded) { toggleFolded(false); requestAnimationFrame(scroll); } else scroll();
  };

  const nightBase = (i: number) => (state.tdays.find((d) => d.id === dayKey(trip.id, dates[i]))?.base ?? '').trim().toLowerCase();
  const saveNight = (i: number, p: { base: string; lat?: number; lng?: number }) =>
    dispatch({ type: 'saveTday', tday: { id: dayKey(trip.id, dates[i]), tripId: trip.id, date: toISO(dates[i]), ...p } });
  /**
   * For the first night at a place: nights in a row there, and the most it can stretch to
   * before it would run into a night already booked somewhere else.
   */
  const stayAt = (i: number): { nights: number; max: number } | undefined => {
    const last = dates.length - 1; // nights are 0..last-1
    const b = nightBase(i);
    if (i >= last || !b || (i > 0 && nightBase(i - 1) === b)) return undefined;
    let nights = 1;
    while (i + nights < last && nightBase(i + nights) === b) nights++;
    let max = nights;
    while (i + max < last && !nightBase(i + max)) max++;
    return { nights, max };
  };

  const save = (item: PlanItem) => {
    const existing = item.id ? state.itin.find((x) => x.id === item.id) : undefined;
    dispatch({ type: 'savePlan', item: { ...item, id: item.id || newId(), created: existing?.created ?? Date.now() } });
    setDraft(null);
    toast.success(existing ? 'Ændringerne er gemt' : item.day ? `Planen er lagt på ${fmtShort(toTime(item.day))}` : 'Lagt i idébanken');
  };

  const remove = (id: string) => {
    const item = state.itin.find((x) => x.id === id);
    dispatch({ type: 'deletePlan', id });
    setDraft(null);
    toast('Planen er slettet', item ? { action: { label: 'Fortryd', onClick: () => dispatch({ type: 'savePlan', item }) } } : undefined);
  };

  const cycle = (it: PlanItem) => {
    const status = nextStatus(it.status);
    dispatch({ type: 'savePlan', item: { ...it, status, bookBy: status === 'booked' ? '' : it.bookBy } });
  };

  /** Straight-line km from where you sleep that day (tonight's stay, else last night's) to a placed plan. */
  const distFromStay = (it: PlanItem): number | undefined => {
    if (!it.day || it.type === 'transport' || it.lat === undefined || it.lng === undefined) return undefined;
    const i = dates.findIndex((t) => toISO(t) === it.day);
    if (i < 0) return undefined;
    for (const t of [dates[i], dates[i - 1]]) {
      const td = t === undefined ? undefined : state.tdays.find((d) => d.id === dayKey(trip.id, t));
      if (td?.lat !== undefined && td.lng !== undefined) return distanceKm({ lat: it.lat, lng: it.lng }, { lat: td.lat, lng: td.lng });
    }
    return undefined;
  };

  /** Straight-line km from the previous stop on the same day, when both have a map point. */
  const legFromPrev = (it: PlanItem): number | undefined => {
    if (!it.day || it.lat === undefined || it.lng === undefined) return undefined;
    const day = items.filter((x) => x.day === it.day).sort(sortPlan);
    const prev = day[day.findIndex((x) => x.id === it.id) - 1];
    if (prev?.lat === undefined || prev.lng === undefined) return undefined;
    return distanceKm({ lat: prev.lat, lng: prev.lng }, { lat: it.lat, lng: it.lng });
  };

  const row = (it: PlanItem) => <PlanRow key={it.id} item={it} distKm={distFromStay(it)} legKm={legFromPrev(it)} onEdit={(x) => setDraft(draftFromPlan(x))} onCycle={cycle} />;

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const a = items.find((x) => x.id === activeId);
    if (!a) return;
    const container = (x: PlanItem) => x.day ?? 'ideas';
    const overItem = overId.startsWith('list:') ? undefined : items.find((x) => x.id === overId);
    const dest = overItem ? container(overItem) : overId.slice(5);
    const src = container(a);
    const list = (c: string) => items.filter((x) => container(x) === c).sort(sortPlan);
    const dayOf = (c: string) => (c === 'ideas' ? null : c);
    const moves: { id: string; day: string | null; order: number }[] = [];
    if (src === dest) {
      const full = list(src);
      const from = full.findIndex((x) => x.id === activeId);
      const to = overItem ? full.findIndex((x) => x.id === overId) : full.length - 1;
      if (from === to) return;
      arrayMove(full, from, to).forEach((x, i) => moves.push({ id: x.id, day: dayOf(src), order: i }));
    } else {
      const d = list(dest).filter((x) => x.id !== activeId);
      const at = overItem ? d.findIndex((x) => x.id === overId) : d.length;
      d.splice(at, 0, a);
      d.forEach((x, i) => moves.push({ id: x.id, day: dayOf(dest), order: i }));
      list(src).filter((x) => x.id !== activeId).forEach((x, i) => moves.push({ id: x.id, day: dayOf(src), order: i }));
      toast(dest === 'ideas' ? 'Flyttet til idébanken' : `Flyttet til ${fmtShort(toTime(dest))}`);
    }
    dispatch({ type: 'movePlan', moves });
  };

  const addChecks = (texts: string[], force = false) => {
    const ex = state.checks.filter((c) => c.tripId === trip.id);
    let order = ex.reduce((m, c) => Math.max(m, c.order), 0);
    const have = new Set(ex.map((c) => c.text.toLowerCase()));
    const add: CheckItem[] = texts
      .filter((t) => force || !have.has(t.toLowerCase()))
      .map((text) => ({ id: newId(), tripId: trip.id, text, done: false, order: ++order }));
    if (!add.length) { toast('Det står allerede på listen'); return; }
    dispatch({ type: 'addChecks', checks: add });
  };

  const openNew = (day: string | null, type: PlanType, fly = false) => setDraft(newPlanDraft(day, type, fly));

  return (
    <div>
      <TripPicker state={state} trips={trips} selectedId={trip.id} today={today} onSelect={select} />
      <TripHeader
        state={state} trip={trip} items={items} checks={state.checks} today={today}
        onNew={() => openNew(null, 'oplevelse')}
        onNewFlight={() => openNew(trip.from, 'transport', true)}
        onEdit={(x) => setDraft(draftFromPlan(x))}
      />
      <div className="mt-4">
        <Route trip={trip} items={items} tdays={state.tdays} onGoto={goto} />
      </div>
      <div className="mt-4">
        <DestinationTips key={trip.id} tripName={trip.name} />
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        <div className="mt-10 grid items-start gap-4 md:grid-cols-2">
          <ToBook items={items} today={today} onEdit={(it) => setDraft(draftFromPlan(it))} />
          <IdeaBank items={byDay(null)} onAdd={() => openNew(null, 'oplevelse')} renderRow={(it) => <Fragment key={it.id}>{row(it)}</Fragment>} />
        </div>
        <div className="mt-10 grid items-start gap-4 lg:grid-cols-12">
          <section aria-labelledby="days-h" className="min-w-0 lg:col-span-8">
            <SectionTitle>
              <button
                type="button"
                aria-expanded={!folded}
                aria-controls="days-list"
                onClick={() => toggleFolded(!folded)}
                className="-mx-2 flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-left transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span id="days-h">Dag for dag</span>
                <ChevronDownIcon className={`size-4 text-muted-foreground transition-transform ${folded ? '-rotate-90' : ''}`} aria-hidden />
                {folded && <span className="text-xs font-normal text-muted-foreground">{dates.length} {dates.length === 1 ? 'dag' : 'dage'} skjult</span>}
              </button>
            </SectionTitle>
            <ol id="days-list" className={`${folded ? 'hidden' : 'flex'} flex-col gap-3`}>
              {dates.map((t, i) => {
                const ds = toISO(t);
                const td = state.tdays.find((d) => d.id === dayKey(trip.id, t));
                const stay = stayAt(i);
                return (
                  <DayCard
                    key={ds}
                    t={t}
                    index={i}
                    total={dates.length}
                    items={byDay(ds)}
                    base={td?.base ?? ''}
                    lat={td?.lat}
                    lng={td?.lng}
                    daysOff={daysOff}
                    stay={stay ? { nights: stay.nights, max: stay.max } : undefined}
                    onBase={(p) => {
                      // The first night of a stay carries its later nights along, so the place is only typed once.
                      const span = stay && stay.nights > 1 ? stay.nights : 1;
                      for (let k = 0; k < span; k++) saveNight(i + k, p);
                    }}
                    onNights={(n) => {
                      if (!stay || !td) return;
                      const place = { base: td.base, lat: td.lat, lng: td.lng };
                      for (let k = 0; k < stay.max; k++) {
                        if (k < n) saveNight(i + k, place);
                        else if (k < stay.nights) saveNight(i + k, { base: '' });
                      }
                    }}
                    onAdd={(type, fly) => openNew(ds, type, fly)}
                    renderRow={(it) => <Fragment key={it.id}>{row(it)}</Fragment>}
                  />
                );
              })}
            </ol>
          </section>
          <aside aria-label="Huskeliste" id="huskeliste" className="flex min-w-0 scroll-mt-20 flex-col gap-4 lg:sticky lg:top-6 lg:col-span-4 lg:mt-9">
            <Checklist
              tripId={trip.id}
              checks={state.checks}
              onAdd={addChecks}
              onToggle={(c, done) => dispatch({ type: 'saveCheck', check: { ...c, done } })}
              onRemove={(id) => dispatch({ type: 'deleteCheck', id })}
            />
          </aside>
        </div>
      </DndContext>
      <PlanItemSheet state={state} trip={trip} draft={draft} onClose={() => setDraft(null)} onSave={save} onDelete={remove} />
    </div>
  );
}
