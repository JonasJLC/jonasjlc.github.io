import { DAY, toTime } from './dates';
import { isWorkDay } from './holidays';
import type { DayOff, FerieState, PersonKey, Trip, Who } from './types';

export const involves = (trip: Pick<Trip, 'who'>, k: PersonKey): boolean => trip.who === 'both' || trip.who === k;
export const whoKeys = (w: Who): PersonKey[] => (w === 'both' ? ['a', 'b'] : [w]);

export const daysOffOf = (state: FerieState, k: PersonKey): DayOff[] => state.settings.people[k].daysOff;

/** Days off shared by everyone in `who`: a day is free for the group only if it is free for all. */
export function commonDaysOff(state: FerieState, who: Who): DayOff[] {
  const [first, ...rest] = whoKeys(who).map((k) => daysOffOf(state, k));
  return first.filter((d) => rest.every((l) => l.includes(d)));
}

/** A trip-like range; `days` overrides the counted work days. */
export type Span = Pick<Trip, 'from' | 'to' | 'days'>;

/** The work days of `span` for one person (their own days off are free). */
export function tripWorkDays(state: FerieState, span: Pick<Trip, 'from' | 'to'>, k: PersonKey): number[] {
  const a = toTime(span.from);
  const b = toTime(span.to);
  const out: number[] = [];
  if (Number.isNaN(a) || Number.isNaN(b)) return out;
  const off = daysOffOf(state, k);
  for (let t = a; t <= b; t += DAY) if (isWorkDay(t, off)) out.push(t);
  return out;
}

/** Vacation days `span` costs person `k`: the manual override, else their work days in range. */
export function tripDays(state: FerieState, span: Span, k: PersonKey): number {
  if (span.days !== null && span.days !== undefined && !Number.isNaN(+span.days)) return +span.days;
  return tripWorkDays(state, span, k).length;
}

/** Largest cost among the people on a trip (for per-day budget figures). */
export const tripDaysMax = (state: FerieState, trip: Pick<Trip, 'from' | 'to' | 'days' | 'who'>): number =>
  Math.max(0, ...whoKeys(trip.who).map((k) => tripDays(state, trip, k)));

/** Last day every balance is calculated to. */
export function horizonOf(state: FerieState): number {
  let y = state.settings.year + 2;
  for (const k of ['a', 'b'] as PersonKey[]) {
    const t = toTime(state.settings.people[k].asOf);
    if (!Number.isNaN(t)) y = Math.max(y, new Date(t).getUTCFullYear() + 1);
  }
  return Date.UTC(y, 11, 31);
}

/* ---------- engine ---------- */

/** Ferieår starting 1 Sep of the returned year. */
const fyOf = (t: number): number => {
  const d = new Date(t);
  return d.getUTCMonth() >= 8 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
};

interface Pot {
  kind: 'fy' | 'ff';
  y: number;
  start: number;
  expires: number;
  bal: number;
  expired: boolean;
}

/** 0 = earn, 1 = use, 2 = expire; same-day events run in that order. */
interface Ev {
  t: number;
  ord: 0 | 1 | 2;
  amt: number;
  pot?: () => Pot;
}

export interface Ledger {
  asOf: number;
  horizon: number;
  /** Balance on `asOf`, before anything after it. */
  opening: number;
  /** Days with events (ascending) and the balance after each day's events. */
  ts: number[];
  totals: number[];
  /** Days lost when a pot expired unused. */
  lost: { t: number; amt: number }[];
}

function events(state: FerieState, k: PersonKey, excludeId: string | undefined, add: Span | undefined, asOf: number, horizon: number, pot: (kind: 'fy' | 'ff', y: number) => Pot): Ev[] {
  const p = state.settings.people[k];
  const ev: Ev[] = [];
  const asY = new Date(asOf).getUTCFullYear();
  const endY = new Date(horizon).getUTCFullYear();

  // Monthly accrual at month end, from the month after the balance date.
  const rate = +p.rate || 0;
  if (rate) {
    for (let y = asY, m = new Date(asOf).getUTCMonth() + 1; ; m++) {
      if (m > 11) { m = 0; y++; }
      const end = Date.UTC(y, m + 1, 0);
      if (end > horizon) break;
      ev.push({ t: end, ord: 0, amt: rate, pot: () => pot('fy', fyOf(end)) });
    }
  }
  const ff = +p.ff || 0;
  const ffMonth = Math.min(12, Math.max(1, Math.round(+p.ffMonth) || 1));
  for (let y = asY; y <= endY; y++) {
    const grant = Date.UTC(y, ffMonth - 1, 1);
    if (ff > 0 && grant > asOf) ev.push({ t: grant, ord: 0, amt: ff, pot: () => pot('ff', y) });
    const dec31 = Date.UTC(y, 11, 31);
    if (dec31 >= asOf) {
      ev.push({ t: dec31, ord: 2, amt: 0, pot: () => pot('ff', y) });
      ev.push({ t: dec31, ord: 2, amt: 0, pot: () => pot('fy', y - 1) });
    }
  }

  const use = (span: Span) => {
    const wd = tripWorkDays(state, span, k);
    const days = wd.length ? wd : [toTime(span.from)];
    if (Number.isNaN(days[0])) return;
    const per = tripDays(state, span, k) / days.length;
    // Days before the balance date are already in the balance.
    for (const t of days) if (t >= asOf && t <= horizon && per) ev.push({ t, ord: 1, amt: per });
  };
  for (const trip of state.trips) if (trip.id !== excludeId && involves(trip, k)) use(trip);
  if (add) use(add);

  return ev.sort((x, y) => x.t - y.t || x.ord - y.ord);
}

function build(state: FerieState, k: PersonKey, excludeId?: string, add?: Span): Ledger {
  const p = state.settings.people[k];
  const horizon = horizonOf(state);
  let asOf = toTime(p.asOf);
  if (Number.isNaN(asOf)) asOf = Date.UTC(state.settings.year, 0, 1);

  const pots = new Map<string, Pot>();
  const ffMonth = Math.min(12, Math.max(1, Math.round(+p.ffMonth) || 1));
  const pot = (kind: 'fy' | 'ff', y: number): Pot => {
    const key = kind + y;
    let x = pots.get(key);
    if (!x) {
      x = kind === 'fy'
        ? { kind, y, start: Date.UTC(y, 8, 1), expires: Date.UTC(y + 1, 11, 31), bal: 0, expired: false }
        : { kind, y, start: Date.UTC(y, ffMonth - 1, 1), expires: Date.UTC(y, 11, 31), bal: 0, expired: false };
      pots.set(key, x);
    }
    return x;
  };
  const Y = fyOf(asOf);
  pot('fy', Y - 1).bal = +p.prev || 0;
  pot('fy', Y).bal = +p.curr || 0;
  if (+p.ffOpen > 0) {
    // Already granted before the balance date, so usable from the start.
    const open = pot('ff', new Date(asOf).getUTCFullYear());
    open.bal = +p.ffOpen;
    open.start = Math.min(open.start, asOf);
  }

  let total = 0;
  for (const x of pots.values()) total += x.bal;
  const L: Ledger = { asOf, horizon, opening: total, ts: [], totals: [], lost: [] };

  for (const e of events(state, k, excludeId, add, asOf, horizon, pot)) {
    if (e.ord === 0) {
      e.pot!().bal += e.amt;
      total += e.amt;
    } else if (e.ord === 1) {
      // Use what expires first; on a tie feriefridage go before ferie.
      let need = e.amt;
      const usable = [...pots.values()]
        .filter((x) => !x.expired && x.bal > 0 && x.start <= e.t)
        .sort((a, b) => a.expires - b.expires || (a.kind === b.kind ? a.y - b.y : a.kind === 'ff' ? -1 : 1));
      for (const x of usable) {
        if (need < 1e-9) break;
        const take = Math.min(need, x.bal);
        x.bal -= take;
        need -= take;
      }
      // Not enough: forskudsferie on the ferieår being earned now.
      if (need > 1e-9) pot('fy', fyOf(e.t)).bal -= need;
      total -= e.amt;
    } else {
      const x = e.pot!();
      if (!x.expired) {
        const lost = Math.max(x.bal, 0);
        x.bal -= lost;
        x.expired = true;
        total -= lost;
        if (lost > 1e-9) L.lost.push({ t: e.t, amt: lost });
      }
    }
    if (L.ts[L.ts.length - 1] === e.t) L.totals[L.totals.length - 1] = total;
    else { L.ts.push(e.t); L.totals.push(total); }
  }
  return L;
}

const cache = new WeakMap<FerieState, Map<string, Ledger>>();

/** Day-by-day balance for one person; `add` is a trip that is not saved yet. */
export function ledger(state: FerieState, k: PersonKey, excludeId?: string, add?: Span): Ledger {
  if (add) return build(state, k, excludeId, add);
  let m = cache.get(state);
  if (!m) cache.set(state, (m = new Map()));
  const key = `${k}|${excludeId ?? ''}`;
  let L = m.get(key);
  if (!L) m.set(key, (L = build(state, k, excludeId)));
  return L;
}

/** Index of the last event day at or before `t`, or -1. */
function idx(L: Ledger, t: number): number {
  let lo = 0, hi = L.ts.length - 1, r = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (L.ts[mid] <= t) { r = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return r;
}

/** Balance at the end of day `t` (the opening balance before `asOf`). */
export function valueAt(L: Ledger, t: number): number {
  const i = idx(L, t);
  return i < 0 ? L.opening : L.totals[i];
}

/** Lowest end-of-day balance from `a` to `b` inclusive; Infinity for an empty range. */
export function minOver(L: Ledger, a: number, b: number): number {
  if (b < a) return Infinity;
  let mn = valueAt(L, a);
  for (let i = idx(L, a) + 1; i < L.ts.length && L.ts[i] <= b; i++) mn = Math.min(mn, L.totals[i]);
  return mn;
}

/** Balance at the end of day `t`. */
export const balanceAt = (state: FerieState, k: PersonKey, t: number, excludeId?: string): number =>
  valueAt(ledger(state, k, excludeId), t);

/** Daily end-of-day balance from `st` to `en` inclusive. */
export function balanceSeries(state: FerieState, k: PersonKey, st: number, en: number, excludeId?: string): Float64Array {
  const L = ledger(state, k, excludeId);
  const n = Math.round((en - st) / DAY) + 1;
  const out = new Float64Array(Math.max(0, n));
  let i = idx(L, st);
  let v = i < 0 ? L.opening : L.totals[i];
  for (let d = 0; d < n; d++) {
    const t = st + d * DAY;
    while (i + 1 < L.ts.length && L.ts[i + 1] <= t) v = L.totals[++i];
    out[d] = v;
  }
  return out;
}

/** Days lost to expiry during a calendar year. */
export function lostInYear(state: FerieState, k: PersonKey, year: number): number {
  const st = Date.UTC(year, 0, 1), en = Date.UTC(year, 11, 31);
  return ledger(state, k).lost.reduce((s, x) => (x.t >= st && x.t <= en ? s + x.amt : s), 0);
}

/** Vacation days planned on work days from `st` to `en` inclusive for one person. */
export function usedBetween(state: FerieState, k: PersonKey, st: number, en: number): number {
  let used = 0;
  for (const trip of state.trips) {
    if (!involves(trip, k)) continue;
    const wd = tripWorkDays(state, trip, k);
    const days = wd.length ? wd : [toTime(trip.from)];
    const per = tripDays(state, trip, k) / days.length;
    for (const t of days) if (t >= st && t <= en) used += per;
  }
  return used;
}

/** Vacation days planned on work days in a calendar year for one person. */
export const usedInYear = (state: FerieState, k: PersonKey, year: number): number =>
  usedBetween(state, k, Date.UTC(year, 0, 1), Date.UTC(year, 11, 31));

export const sortedTrips = (trips: Trip[]): Trip[] =>
  trips
    .slice()
    .sort((x, y) => (x.from || '').localeCompare(y.from || '') || (x.created || 0) - (y.created || 0));
