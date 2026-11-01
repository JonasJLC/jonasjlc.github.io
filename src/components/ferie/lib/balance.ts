import { DAY, toTime } from './dates';
import { countWorkDays } from './holidays';
import type { FerieState, PersonKey, Trip, Who } from './types';

export const involves = (trip: Trip, k: PersonKey): boolean => trip.who === 'both' || trip.who === k;
export const whoKeys = (w: Who): PersonKey[] => (w === 'both' ? ['a', 'b'] : [w]);

/** Vacation days a trip costs: the manual override, else the work days in range. */
export function tripDays(trip: Pick<Trip, 'from' | 'to' | 'days'>, extraOff: boolean): number {
  if (trip.days !== null && trip.days !== undefined && !Number.isNaN(+trip.days)) return +trip.days;
  const a = toTime(trip.from);
  const b = toTime(trip.to);
  return Number.isNaN(a) || Number.isNaN(b) ? 0 : countWorkDays(a, b, extraOff);
}

export interface Credit {
  t: number;
  amt: number;
}

/** Accruals on the 1st of each month up to and including `endT`. */
export function credits(state: FerieState, k: PersonKey, endT: number): Credit[] {
  const p = state.settings.people[k];
  const out: Credit[] = [];
  const parts = String(p.first || '2026-11').split('-').map(Number);
  let y = parts[0] || 2026;
  let m = (parts[1] || 11) - 1;
  const rate = +p.rate || 0;
  const extra = +p.extra || 0;
  const extraMonth = (+p.extraMonth || 5) - 1;
  for (let i = 0; i < 600; i++) {
    const t = Date.UTC(y, m, 1);
    if (t > endT) break;
    if (rate) out.push({ t, amt: rate });
    if (extra && m === extraMonth) out.push({ t, amt: extra });
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return out;
}

/** Balance on day `t`. Vacation days are deducted on the departure day. */
export function balanceAt(state: FerieState, k: PersonKey, t: number, excludeId?: string): number {
  let b = +state.settings.people[k].start || 0;
  for (const c of credits(state, k, t)) b += c.amt;
  for (const trip of state.trips) {
    if (trip.id === excludeId || !involves(trip, k)) continue;
    if (toTime(trip.from) <= t) b -= tripDays(trip, state.settings.extraOff);
  }
  return b;
}

/** Daily balance from `st` to `en` inclusive. */
export function balanceSeries(
  state: FerieState,
  k: PersonKey,
  st: number,
  en: number,
  excludeId?: string,
): Float64Array {
  const n = Math.round((en - st) / DAY) + 1;
  const delta = new Float64Array(n);
  let base = +state.settings.people[k].start || 0;
  for (const c of credits(state, k, en)) {
    if (c.t < st) base += c.amt;
    else delta[Math.round((c.t - st) / DAY)] += c.amt;
  }
  for (const trip of state.trips) {
    if (trip.id === excludeId || !involves(trip, k)) continue;
    const t = toTime(trip.from);
    if (Number.isNaN(t)) continue;
    const d = tripDays(trip, state.settings.extraOff);
    if (t < st) base -= d;
    else if (t <= en) delta[Math.round((t - st) / DAY)] -= d;
  }
  const out = new Float64Array(n);
  let r = base;
  for (let i = 0; i < n; i++) {
    r += delta[i];
    out[i] = r;
  }
  return out;
}

/** Vacation days planned in the calendar year for one person. */
export function usedInYear(state: FerieState, k: PersonKey, year: number): number {
  const st = Date.UTC(year, 0, 1);
  const en = Date.UTC(year, 11, 31);
  let used = 0;
  for (const trip of state.trips) {
    if (!involves(trip, k)) continue;
    const t = toTime(trip.from);
    if (t >= st && t <= en) used += tripDays(trip, state.settings.extraOff);
  }
  return used;
}

export const sortedTrips = (trips: Trip[]): Trip[] =>
  trips
    .slice()
    .sort((x, y) => (x.from || '').localeCompare(y.from || '') || (x.created || 0) - (y.created || 0));
