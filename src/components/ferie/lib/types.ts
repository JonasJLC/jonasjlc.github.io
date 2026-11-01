export type PersonKey = 'a' | 'b';
export type Who = 'both' | PersonKey;

export const PERSON_KEYS: PersonKey[] = ['a', 'b'];

export interface Person {
  name: string;
  /** Balance (days) before the first accrual. */
  start: number;
  /** Days accrued on the 1st of every month. */
  rate: number;
  /** First accrual month, `YYYY-MM`. */
  first: string;
  /** Extra days credited once a year. */
  extra: number;
  /** Month (1-12) the extra days are credited. */
  extraMonth: number;
}

export interface Settings {
  year: number;
  /** Treat Grundlovsdag, juleaften and nytårsaftensdag as days off. */
  extraOff: boolean;
  people: Record<PersonKey, Person>;
}

export interface Trip {
  id: string;
  name: string;
  /** `YYYY-MM-DD` */
  from: string;
  /** `YYYY-MM-DD` */
  to: string;
  who: Who;
  /** Manual override of the number of vacation days; `null` = count work days. */
  days: number | null;
  created: number;
}

export interface FerieState {
  settings: Settings;
  trips: Trip[];
}
