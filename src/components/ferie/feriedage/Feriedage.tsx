import { useState } from 'react';
import { toast } from 'sonner';
import { addWorkDays } from '../lib/holidays';
import { toISO, toTime } from '../lib/dates';
import { newId, type Action } from '../lib/use-ferie';
import type { FerieState, Trip, Who } from '../lib/types';
import { BalanceChart } from './BalanceChart';
import { Finder } from './Finder';
import { PeopleSummary } from './PeopleSummary';
import { SelectionBar } from './SelectionBar';
import { SettingsSheet } from './SettingsSheet';
import { TripList } from './TripList';
import { TripSheet, draftFromTrip, type Draft } from './TripSheet';
import { YearCalendar, type Selection } from './YearCalendar';

export function Feriedage({
  state, dispatch, settingsOpen, setSettingsOpen,
}: {
  state: FerieState; dispatch: React.Dispatch<Action>; settingsOpen: boolean; setSettingsOpen: (o: boolean) => void;
}) {
  const [sel, setSel] = useState<Selection>({ from: null, to: null });
  const [draft, setDraft] = useState<Draft | null>(null);

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
    <div className="flex flex-col gap-5">
      <PeopleSummary state={state} dispatch={dispatch} />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <BalanceChart state={state} />
          <YearCalendar state={state} selection={sel} onPick={onPick} />
        </div>
        <div className="flex min-w-0 flex-col gap-5 xl:sticky xl:top-5">
          <TripList state={state} onEdit={(t) => setDraft(draftFromTrip(t))} onNew={() => openNew(start, start)} />
          <Finder
            state={state}
            onCreate={(from, days, who) => openNew(from, Math.max(from, addWorkDays(from, days, state.settings.extraOff)), who)}
          />
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
      <TripSheet state={state} draft={draft} onClose={() => setDraft(null)} onSave={save} onDelete={remove} />
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} state={state} dispatch={dispatch} />
    </div>
  );
}
