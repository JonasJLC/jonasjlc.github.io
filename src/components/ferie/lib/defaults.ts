import type { FerieState, Person, Settings } from './types';

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
  people: { a: defaultPerson('Person 1'), b: defaultPerson('Person 2') },
});

export const defaultState = (): FerieState => ({ settings: defaultSettings(), trips: [] });
