import { DAY, fmtShort, toISO, toTime } from './dates';
import type { CheckItem, FerieState, MoneyItem, PlanItem, PlanStatus, PlanType, Trip } from './types';

export const PLAN_TYPES: { value: PlanType; label: string; placeholder: string; category: string }[] = [
  { value: 'transport', label: 'Transport', placeholder: 'Fx fly København–Rovaniemi', category: 'Transport' },
  { value: 'oplevelse', label: 'Oplevelse', placeholder: 'Fx husky-safari', category: 'Oplevelser' },
  { value: 'mad', label: 'Mad', placeholder: 'Fx middag på restaurant Nili', category: 'Mad og drikke' },
  { value: 'overnatning', label: 'Overnatning', placeholder: 'Fx hotel i Levi', category: 'Overnatning' },
  { value: 'andet', label: 'Andet', placeholder: 'Fx køb SIM-kort', category: 'Andet' },
];
export const typeInfo = (t: PlanType) => PLAN_TYPES.find((x) => x.value === t) ?? PLAN_TYPES[4];

export const PLAN_STATUS: { value: PlanStatus; label: string }[] = [
  { value: 'idea', label: 'Idé' },
  { value: 'tobook', label: 'Skal bookes' },
  { value: 'booked', label: 'Booket' },
];
export const nextStatus = (s: PlanStatus): PlanStatus => PLAN_STATUS[(PLAN_STATUS.findIndex((x) => x.value === s) + 1) % 3].value;

export const CHECK_TEMPLATES: Record<string, string[]> = {
  Basis: ['Pas', 'Rejseforsikring', 'Det blå sygesikringskort', 'Opladere og stik', 'Medicin', 'Bookinger gemt på telefonen', 'Betalingskort'],
  Vinter: ['Skiundertøj', 'Hue, halstørklæde og vanter', 'Uldsokker', 'Varme støvler', 'Læbepomade'],
  Strand: ['Solcreme', 'Badetøj', 'Solbriller', 'Sandaler', 'Strandhåndklæde'],
  Storby: ['Gode gåsko', 'Powerbank', 'Lille dagtaske', 'Offline kort på telefonen'],
};

/** The days of a trip (capped so a typo can't create thousands of cards). */
export function tripDates(tr: Pick<Trip, 'from' | 'to'>): number[] {
  const a = toTime(tr.from);
  const b = toTime(tr.to);
  const out: number[] = [];
  if (Number.isNaN(a) || Number.isNaN(b)) return out;
  for (let t = a; t <= b && out.length < 60; t += DAY) out.push(t);
  return out;
}

export const dayKey = (tripId: string, t: number) => `${tripId}_${toISO(t)}`;

export const sortPlan = (a: PlanItem, b: PlanItem): number =>
  (a.time || '~').localeCompare(b.time || '~') || a.order - b.order;

export function countdown(tr: Trip, today: number): string {
  const a = toTime(tr.from);
  const b = toTime(tr.to);
  const d = Math.round((a - today) / DAY);
  if (d > 1) return `Om ${d} dage`;
  if (d === 1) return 'I morgen';
  if (d === 0) return 'I dag';
  return b >= today ? 'I gang nu' : 'Overstået';
}

export function bookStats(items: PlanItem[]) {
  const need = items.filter((x) => x.status === 'tobook' || x.status === 'booked').length;
  const booked = items.filter((x) => x.status === 'booked').length;
  return { need, booked };
}

export function dayLoad(items: PlanItem[]): { key: 'free' | 'calm' | 'mid' | 'busy'; label: string } {
  const n = items.filter((x) => x.type !== 'overnatning').length;
  if (n === 0) return { key: 'free', label: 'Fri dag' };
  if (n <= 2) return { key: 'calm', label: 'Rolig dag' };
  if (n <= 4) return { key: 'mid', label: 'Godt fyldt' };
  return { key: 'busy', label: 'Travl dag' };
}

export const safeUrl = (u: string): string => (/^https?:\/\//i.test(u) ? u : `https://${u.replace(/^\/+/, '')}`);

export interface BudgetSync {
  item: PlanItem;
  /** Expense to create or update in the trip budget. */
  money?: MoneyItem;
  /** Linked expense to remove. */
  removeMoneyId?: string;
}

/** Keeps the linked budget expense in step with a plan item's price. */
export function syncBudget(state: FerieState, item: PlanItem): BudgetSync {
  const tr = state.trips.find((t) => t.id === item.tripId);
  const want = item.inBudget && (item.price ?? 0) > 0 && !!tr;
  const existing = item.moneyId ? state.money.find((m) => m.id === item.moneyId) : undefined;
  if (want && tr) {
    const id = item.moneyId ?? `m${item.id}`;
    const money: MoneyItem = {
      kind: 'expense', payer: 'acc', act: null, created: Date.now(), ...existing,
      id, tripId: tr.id, cat: typeInfo(item.type).category,
      label: item.title || typeInfo(item.type).label,
      est: item.price, date: item.bookBy || item.day || tr.from, fromPlan: true,
    };
    return { item: { ...item, moneyId: id }, money };
  }
  if (item.moneyId) return { item: { ...item, moneyId: null }, removeMoneyId: item.moneyId };
  return { item };
}

export function nextOrder(items: PlanItem[], tripId: string, day: string | null): number {
  return items
    .filter((x) => x.tripId === tripId && (x.day ?? null) === day)
    .reduce((m, x) => Math.max(m, x.order + 1), 0);
}

export const bookByLabel = (it: PlanItem, today: number) => {
  const bb = toTime(it.bookBy);
  const over = !Number.isNaN(bb) && bb < today;
  const soon = !Number.isNaN(bb) && !over && bb - today <= 14 * DAY;
  const when = !Number.isNaN(bb)
    ? over ? `Skulle være booket ${fmtShort(bb)}` : `Senest ${fmtShort(bb)}`
    : it.day ? `Til ${fmtShort(toTime(it.day))}` : 'Ingen frist';
  return { over, soon, when };
};

export const checkOrder = (list: CheckItem[]) => list.reduce((m, c) => Math.max(m, c.order), 0);
