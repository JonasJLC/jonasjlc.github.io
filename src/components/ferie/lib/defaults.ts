import { toISO, todayTime } from './dates';
import type { FerieState, Kasse, Person, Settings } from './types';

export const defaultPerson = (name: string): Person => ({
  name,
  start: 0,
  rate: 2.08,
  first: '2026-11',
  extra: 5,
  extraMonth: 5,
});

export const defaultSettings = (): Settings => ({
  year: 2027,
  extraOff: false,
  people: { a: defaultPerson('Camilla'), b: defaultPerson('Jonas') },
});

export const defaultKasse = (): Kasse => ({
  start: 0,
  startDate: toISO(todayTime()),
  depA: 0,
  depB: 0,
  depDay: 1,
  margin: 10,
  buffer: 0,
  look: `${new Date().getFullYear() + 1}-10-01`,
  steps: [],
});

export const defaultState = (): FerieState => ({
  settings: defaultSettings(),
  trips: [],
  kasse: defaultKasse(),
  money: [],
  itin: [],
  tdays: [],
  checks: [],
});
