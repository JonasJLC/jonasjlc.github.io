export type PersonKey = 'a' | 'b';
export type Who = 'both' | PersonKey;

export const PERSON_KEYS: PersonKey[] = ['a', 'b'];

/** Fixed days off besides the public holidays (`MM-DD`). */
export type DayOff = '05-01' | '06-05' | '12-24' | '12-31';

/**
 * One person's vacation balance, Danish rules: ferie is earned 1 Sep–31 Aug and can be
 * held until 31 Dec the year after; feriefridage are granted 1 Jan and expire 31 Dec.
 * All amounts are in days.
 */
export interface Person {
  name: string;
  /** `YYYY-MM-DD` the balances below are from, e.g. the latest payslip. */
  asOf: string;
  /** Left from the previous ferieår (expires 31 Dec of the `asOf` year or the next). */
  prev: number;
  /** Earned so far in the current ferieår. */
  curr: number;
  /** Earned at the end of every month after `asOf`. */
  rate: number;
  /** Feriefridage granted every 1 January. */
  ff: number;
  /** Feriefridage left in the `asOf` calendar year. */
  ffOpen: number;
  /** Fixed days off that do not cost vacation. */
  daysOff: DayOff[];
}

export type Unit = 'days' | 'hours';

export interface Settings {
  year: number;
  /** Hours in one vacation day (15,41 t = 2,08 dage). Balances are stored in days. */
  hoursPerDay: number;
  /** Which unit number fields are typed in. */
  unit: Unit;
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
  /** Set when the place was picked from the map suggestions. */
  lat?: number;
  lng?: number;
}

export interface CheckItem {
  id: string;
  tripId: string;
  text: string;
  done: boolean;
  order: number;
}
