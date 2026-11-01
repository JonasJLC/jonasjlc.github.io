import { defaultKasse, defaultSettings, defaultState } from './defaults';
import { toISO } from './dates';
import { DAYS_OFF, LEGACY_DAYS_OFF } from './holidays';
import type { CheckItem, Person, FerieState, Kasse, MoneyItem, PlanItem, PlanStatus, PlanType, Trip, TripDay } from './types';

/** Persistence boundary. A Supabase implementation can replace the local one later. */
export interface FerieStore {
  load(): FerieState;
  save(state: FerieState): void;
}

const KEY = 'ferie-v1';

export function normalize(raw: unknown): FerieState {
  const d = defaultState();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as { settings?: Partial<FerieState['settings']>; trips?: unknown; kasse?: Partial<Kasse>; money?: unknown; itin?: unknown; tdays?: unknown; checks?: unknown };
  const s = r.settings ?? {};
  const people = (s.people ?? {}) as Partial<FerieState['settings']['people']>;
  const base = defaultSettings();
  const trips: Trip[] = Array.isArray(r.trips)
    ? (r.trips as Partial<Trip>[])
        .filter((t) => t && typeof t.from === 'string' && typeof t.to === 'string')
        .map((t, i) => ({
          id: String(t.id ?? `t${i}`),
          name: String(t.name ?? ''),
          from: t.from as string,
          to: t.to as string,
          who: t.who === 'a' || t.who === 'b' ? t.who : 'both',
          days: t.days === null || t.days === undefined || Number.isNaN(+t.days) ? null : +t.days,
          created: Number(t.created) || 0,
        }))
    : [];
  const numOrNull = (v: unknown): number | null =>
    v === null || v === undefined || v === '' || Number.isNaN(+(v as number)) ? null : +(v as number);
  const kb = defaultKasse();
  const k = (r.kasse ?? {}) as Partial<Kasse>;
  const kasse: Kasse = {
    ...kb,
    ...k,
    steps: Array.isArray(k.steps)
      ? k.steps.filter((x) => x && typeof x.from === 'string').map((x) => ({ from: x.from, total: +x.total || 0 }))
      : [],
  };
  const money: MoneyItem[] = Array.isArray(r.money)
    ? (r.money as Partial<MoneyItem>[])
        .filter((it) => it && typeof it === 'object')
        .map((it, i) => ({
          id: String(it.id ?? `m${i}`),
          kind: it.kind === 'deposit' ? 'deposit' : 'expense',
          tripId: it.tripId ? String(it.tripId) : null,
          cat: String(it.cat ?? 'Andet'),
          label: String(it.label ?? ''),
          est: numOrNull(it.est),
          act: numOrNull(it.act),
          date: String(it.date ?? ''),
          payer: it.payer === 'a' || it.payer === 'b' ? it.payer : 'acc',
          created: Number(it.created) || 0,
          fromPlan: it.fromPlan ? true : undefined,
        }))
    : [];
  const TYPES: PlanType[] = ['transport', 'oplevelse', 'mad', 'overnatning', 'andet'];
  const STATUSES: PlanStatus[] = ['idea', 'tobook', 'booked'];
  const list = <T,>(v: unknown): Partial<T>[] =>
    Array.isArray(v) ? (v as Partial<T>[]).filter((x) => x && typeof x === 'object') : [];
  const itin: PlanItem[] = list<PlanItem>(r.itin)
    .filter((x) => typeof x.tripId === 'string')
    .map((x, i) => ({
      id: String(x.id ?? `p${i}`),
      tripId: x.tripId as string,
      type: TYPES.includes(x.type as PlanType) ? (x.type as PlanType) : 'andet',
      title: String(x.title ?? ''),
      day: x.day ? String(x.day) : null,
      time: String(x.time ?? ''),
      place: String(x.place ?? ''),
      link: String(x.link ?? ''),
      note: String(x.note ?? ''),
      status: STATUSES.includes(x.status as PlanStatus) ? (x.status as PlanStatus) : 'idea',
      bookBy: String(x.bookBy ?? ''),
      price: numOrNull(x.price),
      inBudget: !!x.inBudget,
      moneyId: x.moneyId ? String(x.moneyId) : null,
      order: Number(x.order) || 0,
      created: Number(x.created) || 0,
    }));
  const tdays: TripDay[] = list<TripDay>(r.tdays)
    .filter((x) => typeof x.tripId === 'string' && typeof x.date === 'string')
    .map((x) => ({ id: String(x.id), tripId: x.tripId as string, date: x.date as string, base: String(x.base ?? '') }));
  const checks: CheckItem[] = list<CheckItem>(r.checks)
    .filter((x) => typeof x.tripId === 'string' && typeof x.text === 'string')
    .map((x, i) => ({ id: String(x.id ?? `c${i}`), tripId: x.tripId as string, text: x.text as string, done: !!x.done, order: Number(x.order) || 0 }));
  return {
    kasse,
    money,
    itin,
    tdays,
    checks,
    settings: {
      year: +(s.year as number) || base.year,
      extraOff: !!s.extraOff,
      hoursPerDay: +(s.hoursPerDay as number) > 0 ? +(s.hoursPerDay as number) : base.hoursPerDay,
      unit: s.unit === 'hours' ? 'hours' : 'days',
      people: {
        a: person(people.a, base.people.a, !!s.extraOff),
        b: person(people.b, base.people.b, !!s.extraOff),
      },
    },
    trips,
  };
}

/**
 * One person's settings. Older saves had `start` (balance before the first accrual on the 1st of
 * `first`), `extra` days in `extraMonth` and a shared `extraOff` switch; they map onto a balance
 * date just before the first accrual, the current ferieår, feriefridage and per-person days off.
 */
function person(raw: unknown, base: Person, legacyOff: boolean): Person {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const n = (v: unknown, d: number) => (v === null || v === undefined || v === '' || Number.isNaN(+(v as number)) ? d : +(v as number));
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const legacy = !(typeof r.asOf === 'string' && iso.test(r.asOf));
  let asOf = base.asOf;
  if (!legacy) asOf = r.asOf as string;
  else if (typeof r.first === 'string' && /^\d{4}-\d{2}$/.test(r.first)) {
    const [y, m] = r.first.split('-').map(Number);
    // Accrual now lands at month end, so put the balance date two months back:
    // first = 2026-11 (1 Nov) becomes 30 Sep, with the first accrual on 31 Oct.
    asOf = toISO(Date.UTC(y, m - 2, 0));
  }
  const valid = DAYS_OFF.map((d) => d.md);
  return {
    name: typeof r.name === 'string' ? r.name : base.name,
    asOf,
    prev: n(r.prev, 0),
    curr: legacy ? n(r.start, base.curr) : n(r.curr, 0),
    rate: n(r.rate, base.rate),
    ff: legacy ? n(r.extra, base.ff) : n(r.ff, 0),
    ffOpen: n(r.ffOpen, 0),
    daysOff: Array.isArray(r.daysOff)
      ? valid.filter((d) => (r.daysOff as unknown[]).includes(d))
      : legacyOff ? [...LEGACY_DAYS_OFF] : [...base.daysOff],
  };
}

/** localStorage-backed store; falls back to memory when storage throws. */
export function createLocalStore(): FerieStore {
  let memory: FerieState | null = null;
  return {
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) return normalize(JSON.parse(raw));
      } catch {
        /* storage unavailable or corrupt: fall through */
      }
      return memory ? normalize(memory) : defaultState();
    },
    save(state) {
      memory = state;
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch {
        /* keep in-memory copy */
      }
    },
  };
}
