import {
  DndContext, KeyboardSensor, PointerSensor, closestCorners, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Fragment, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { commonDaysOff, sortedTrips } from '../lib/balance';
import { fmtShort, toISO, toTime, todayTime } from '../lib/dates';
import { dayKey, nextStatus, sortPlan, tripDates } from '../lib/plan';
import { newId, type Action } from '../lib/use-ferie';
import type { CheckItem, FerieState, PlanItem, PlanType } from '../lib/types';
import { PageTitle, SectionTitle } from '../page';
import { DayCard } from './DayCard';
import { PlanItemSheet, draftFromPlan, newPlanDraft, type PlanDraft } from './PlanItemSheet';
import { PlanRow } from './PlanRow';
import { Route } from './Route';
import { Checklist, IdeaBank, ToBook } from './Side';
import { TripHeader, TripPicker } from './TripHeader';

const KEY = 'ferie-plan-trip';
const readTrip = () => { try { return localStorage.getItem(KEY); } catch { return null; } };

export function Plan({ state, dispatch }: { state: FerieState; dispatch: React.Dispatch<Action> }) {
  const today = todayTime();
  const trips = sortedTrips(state.trips);
  const [picked, setPicked] = useState<string | null>(readTrip);
  const [draft, setDraft] = useState<PlanDraft | null>(null);
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

  const goto = (ds: string) => {
    const el = document.getElementById(`pday-${ds}`);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
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

  const row = (it: PlanItem) => <PlanRow key={it.id} item={it} onEdit={(x) => setDraft(draftFromPlan(x))} onCycle={cycle} />;

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

  const openNew = (day: string | null, type: PlanType) => setDraft(newPlanDraft(day, type));

  return (
    <div>
      <TripPicker trips={trips} selectedId={trip.id} today={today} onSelect={select} />
      <TripHeader state={state} trip={trip} items={items} checks={state.checks} today={today} onNew={() => openNew(null, 'oplevelse')} />
      <div className="mt-4">
        <Route trip={trip} items={items} tdays={state.tdays} onGoto={goto} />
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        <div className="mt-10 grid items-start gap-4 lg:grid-cols-12">
          <section aria-labelledby="days-h" className="min-w-0 lg:col-span-8">
            <SectionTitle><span id="days-h">Dag for dag</span></SectionTitle>
            <ol className="rounded-panel bg-panel px-5 py-4">
              {dates.map((t, i) => {
                const ds = toISO(t);
                return (
                  <DayCard
                    key={ds}
                    t={t}
                    index={i}
                    total={dates.length}
                    items={byDay(ds)}
                    base={state.tdays.find((d) => d.id === dayKey(trip.id, t))?.base ?? ''}
                    daysOff={daysOff}
                    onBase={(base) => dispatch({ type: 'saveTday', tday: { id: dayKey(trip.id, t), tripId: trip.id, date: ds, base } })}
                    onAdd={(type) => openNew(ds, type)}
                    renderRow={(it) => <Fragment key={it.id}>{row(it)}</Fragment>}
                  />
                );
              })}
            </ol>
          </section>
          <aside aria-label="Bookinger, idéer og huskeliste" className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6 lg:col-span-4 lg:mt-9">
            <ToBook items={items} today={today} onEdit={(it) => setDraft(draftFromPlan(it))} />
            <IdeaBank items={byDay(null)} onAdd={() => openNew(null, 'oplevelse')} renderRow={(it) => <Fragment key={it.id}>{row(it)}</Fragment>} />
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
