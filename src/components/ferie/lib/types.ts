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
  kasse: Kasse;
  money: MoneyItem[];
  itin: PlanItem[];
  tdays: TripDay[];
  checks: CheckItem[];
}

export type Payer = 'acc' | PersonKey;

export const CATEGORIES = [
  'Fly',
  'Overnatning',
  'Transport',
  'Mad og drikke',
  'Oplevelser',
  'Forsikring',
  'Andet',
] as const;

export interface Step {
  /** `YYYY-MM` the amount starts. */
  from: string;
  total: number;
}

/** Travel-fund account settings. Amounts are DKK. */
export interface Kasse {
  start: number;
  /** `YYYY-MM-DD` the starting balance is from. */
  startDate: string;
  depA: number;
  depB: number;
  /** 1-28, or 31 for the last day of the month. */
  depDay: number;
  /** Safety margin (%) on estimates that are not yet paid. */
  margin: number;
  /** The account must never go below this. */
  buffer: number;
  /** Date to show the balance for, `YYYY-MM-DD`. */
  look: string;
  steps: Step[];
}

export interface MoneyItem {
  id: string;
  kind: 'expense' | 'deposit';
  tripId: string | null;
  cat: string;
  label: string;
  est: number | null;
  act: number | null;
  /** `YYYY-MM-DD` */
  date: string;
  payer: Payer;
  created: number;
  fromPlan?: boolean;
}

export type PlanType = 'transport' | 'oplevelse' | 'mad' | 'overnatning' | 'andet';
export type PlanStatus = 'idea' | 'tobook' | 'booked';

/** One thing on a trip's itinerary. `day === null` means it sits in the idea bank. */
export interface PlanItem {
  id: string;
  tripId: string;
  type: PlanType;
  title: string;
  /** `YYYY-MM-DD` or null (idea bank). */
  day: string | null;
  /** `HH:MM` or empty. */
  time: string;
  place: string;
  link: string;
  note: string;
  status: PlanStatus;
  /** Book-by deadline, `YYYY-MM-DD` or empty. */
  bookBy: string;
  price: number | null;
  /** Mirror the price as an expense in the trip budget. */
  inBudget: boolean;
  moneyId: string | null;
  order: number;
  created: number;
}

/** Where you sleep on a given night of a trip. */
export interface TripDay {
  id: string;
  tripId: string;
  date: string;
  base: string;
}

export interface CheckItem {
  id: string;
  tripId: string;
  text: string;
  done: boolean;
  order: number;
}
