import { useEffect, useReducer, useRef } from 'react';
import { createLocalStore, type FerieStore } from './store';
import type { FerieState, Kasse, MoneyItem, Person, PersonKey, Settings, Trip } from './types';

export type Action =
  | { type: 'year'; year: number }
  | { type: 'settings'; patch: Partial<Pick<Settings, 'extraOff'>> }
  | { type: 'person'; k: PersonKey; patch: Partial<Person> }
  | { type: 'saveTrip'; trip: Trip }
  | { type: 'deleteTrip'; id: string }
  | { type: 'kasse'; patch: Partial<Kasse> }
  | { type: 'saveItem'; item: MoneyItem }
  | { type: 'deleteItem'; id: string };

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
