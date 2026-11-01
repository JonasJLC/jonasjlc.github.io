import { toISO, todayTime } from './dates';
import { HOURS_PER_DAY } from './units';
import type { FerieState, Kasse, Person, Settings } from './types';

export const defaultPerson = (name: string): Person => ({
  name,
  asOf: '2026-10-31',
  prev: 0,
  curr: 0,
  rate: 2.08,
  ff: 5,
  ffOpen: 0,
  daysOff: [],
});

export const defaultSettings = (): Settings => ({
  year: 2027,
  hoursPerDay: HOURS_PER_DAY,
  unit: 'days',
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
