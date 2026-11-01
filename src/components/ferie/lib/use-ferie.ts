import { useEffect, useReducer, useRef } from 'react';
import { createLocalStore, type FerieStore } from './store';
import { syncBudget } from './plan';
import type { CheckItem, FerieState, Kasse, MoneyItem, Person, PersonKey, PlanItem, Settings, Trip, TripDay } from './types';

export type Action =
  | { type: 'year'; year: number }
  | { type: 'settings'; patch: Partial<Pick<Settings, 'extraOff'>> }
  | { type: 'person'; k: PersonKey; patch: Partial<Person> }
  | { type: 'saveTrip'; trip: Trip }
  | { type: 'deleteTrip'; id: string }
  | { type: 'kasse'; patch: Partial<Kasse> }
  | { type: 'saveItem'; item: MoneyItem }
  | { type: 'deleteItem'; id: string }
  | { type: 'savePlan'; item: PlanItem }
  | { type: 'deletePlan'; id: string }
  | { type: 'movePlan'; moves: { id: string; day: string | null; order: number }[] }
  | { type: 'saveTday'; tday: TripDay }
  | { type: 'addChecks'; checks: CheckItem[] }
  | { type: 'saveCheck'; check: CheckItem }
  | { type: 'deleteCheck'; id: string };

const upsert = <T extends { id: string }>(list: T[], x: T): T[] =>
  list.some((y) => y.id === x.id) ? list.map((y) => (y.id === x.id ? x : y)) : [...list, x];

/** Applies a plan item and keeps its budget expense in sync. */
function withPlan(state: FerieState, item: PlanItem): FerieState {
  const sync = syncBudget(state, item);
  let money = state.money;
  if (sync.money) money = upsert(money, sync.money);
  if (sync.removeMoneyId) money = money.filter((m) => m.id !== sync.removeMoneyId);
  return { ...state, money, itin: upsert(state.itin, sync.item) };
}

function reducer(state: FerieState, a: Action): FerieState {
  switch (a.type) {
    case 'year':
      return { ...state, settings: { ...state.settings, year: a.year } };
    case 'settings':
      return { ...state, settings: { ...state.settings, ...a.patch } };
    case 'person':
      return {
        ...state,
        settings: {
          ...state.settings,
          people: { ...state.settings.people, [a.k]: { ...state.settings.people[a.k], ...a.patch } },
        },
      };
    case 'saveTrip': {
      const exists = state.trips.some((t) => t.id === a.trip.id);
      return {
        ...state,
        trips: exists ? state.trips.map((t) => (t.id === a.trip.id ? a.trip : t)) : [...state.trips, a.trip],
      };
    }
    case 'deleteTrip':
      return { ...state, trips: state.trips.filter((t) => t.id !== a.id) };
    case 'kasse':
      return { ...state, kasse: { ...state.kasse, ...a.patch } };
    case 'saveItem': {
      const exists = state.money.some((m) => m.id === a.item.id);
      return {
        ...state,
        money: exists ? state.money.map((m) => (m.id === a.item.id ? a.item : m)) : [...state.money, a.item],
      };
    }
    case 'deleteItem':
      return { ...state, money: state.money.filter((m) => m.id !== a.id) };
    case 'savePlan':
      return withPlan(state, a.item);
    case 'deletePlan': {
      const it = state.itin.find((x) => x.id === a.id);
      return {
        ...state,
        itin: state.itin.filter((x) => x.id !== a.id),
        money: it?.moneyId ? state.money.filter((m) => m.id !== it.moneyId) : state.money,
      };
    }
    case 'movePlan': {
      let next = state;
      for (const mv of a.moves) {
        const it = next.itin.find((x) => x.id === mv.id);
        if (it && (it.day !== mv.day || it.order !== mv.order)) next = withPlan(next, { ...it, day: mv.day, order: mv.order });
      }
      return next;
    }
    case 'saveTday':
      return { ...state, tdays: upsert(state.tdays, a.tday) };
    case 'addChecks':
      return { ...state, checks: [...state.checks, ...a.checks] };
    case 'saveCheck':
      return { ...state, checks: upsert(state.checks, a.check) };
    case 'deleteCheck':
      return { ...state, checks: state.checks.filter((c) => c.id !== a.id) };
  }
}

const store: FerieStore = createLocalStore();

export function useFerie() {
  const [state, dispatch] = useReducer(reducer, undefined, () => store.load());
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    store.save(state);
  }, [state]);
  return [state, dispatch] as const;
}

export const newId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
