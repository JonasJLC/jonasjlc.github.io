import { tripDays } from './balance';
import { DAY, MONTHS, fmtShort, toISO, toTime } from './dates';
import type { FerieState, MoneyItem, Step } from './types';

export const kr = (v: number): string => {
  const r = Math.round(v);
  return `${(Object.is(r, -0) ? 0 : r).toLocaleString('da-DK')} kr.`;
};
export const krAxis = (v: number): string => Math.round(v).toLocaleString('da-DK');
export const krShort = (v: number): string =>
  v >= 10000
    ? `${(v / 1000).toLocaleString('da-DK', { maximumFractionDigits: 0 })}k`
    : v >= 1000
      ? `${(v / 1000).toLocaleString('da-DK', { maximumFractionDigits: 1 })}k`
      : String(Math.round(v));

const ceil50 = (v: number) => Math.ceil(v / 50 - 1e-9) * 50;

export const hasAct = (it: MoneyItem): boolean => it.act !== null && !Number.isNaN(+it.act);
export const hasEst = (it: MoneyItem): boolean => it.est !== null && !Number.isNaN(+it.est);

/** Amount an item counts for: actual if paid, else estimate (+ margin on unpaid expenses). */
export function itemAmount(it: MoneyItem, margin: number): number {
  if (hasAct(it)) return +(it.act as number);
  const e = hasEst(it) ? +(it.est as number) : 0;
  return it.kind === 'deposit' ? e : e * (1 + (margin || 0) / 100);
}

export const depTotal = (s: FerieState): number => (+s.kasse.depA || 0) + (+s.kasse.depB || 0);
export const kStart = (s: FerieState, today: number): number => {
  const t = toTime(s.kasse.startDate);
  return Number.isNaN(t) ? today : t;
};
export const hasSteps = (s: FerieState): boolean => s.kasse.steps.length > 0;
export const depShare = (s: FerieState): number => {
  const a = +s.kasse.depA || 0;
  const b = +s.kasse.depB || 0;
  return a + b > 0 ? a / (a + b) : 0.5;
};

function moneyEnd(s: FerieState, today: number): number {
  let e = Date.UTC(s.settings.year, 11, 31);
  const lk = toTime(s.kasse.look);
  if (!Number.isNaN(lk)) e = Math.max(e, lk);
  for (const it of s.money) {
    const t = toTime(it.date);
    if (!Number.isNaN(t)) e = Math.max(e, t);
  }
  return Math.max(e + 31 * DAY, kStart(s, today) + 150 * DAY);
}

/** Deposit dates strictly after `st` up to `en`. */
export function depositDays(s: FerieState, st: number, en: number): number[] {
  const out: number[] = [];
  const d0 = new Date(st);
  let y = d0.getUTCFullYear();
  let m = d0.getUTCMonth();
  const day = Math.min(31, Math.max(1, +s.kasse.depDay || 1));
  for (let i = 0; i < 600; i++) {
    const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const t = Date.UTC(y, m, Math.min(day, dim));
    if (t > en) break;
    if (t > st) out.push(t);
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return out;
}

export interface AccountEvent {
  t: number;
  amt: number;
  it: MoneyItem;
}

/** Items that move money on the account (expenses paid by a person don't). */
function accountEvents(s: FerieState, st: number): AccountEvent[] {
  const ev: AccountEvent[] = [];
  for (const it of s.money) {
    const dep = it.kind === 'deposit';
    if (!dep && it.payer && it.payer !== 'acc') continue;
    let t = toTime(it.date);
    if (Number.isNaN(t)) t = st;
    if (t < st) {
      if (hasAct(it)) continue;
      t = st;
    }
    const amt = itemAmount(it, s.kasse.margin);
    ev.push({ t, amt: dep ? amt : -amt, it });
  }
  return ev.sort((a, b) => a.t - b.t);
}

function scheduledAmount(s: FerieState, t: number): number {
  if (hasSteps(s)) {
    const ym = toISO(t).slice(0, 7);
    let v: number | null = null;
    for (const x of s.kasse.steps) if (x.from <= ym) v = +x.total || 0;
    if (v !== null) return v;
  }
  return depTotal(s);
}

export function currentRate(s: FerieState, today: number): number {
  const st = kStart(s, today);
  const nx = depositDays(s, st, st + 62 * DAY)[0];
  return scheduledAmount(s, nx ?? st);
}

export interface MoneyModel {
  st: number;
  en: number;
  n: number;
  bal: Float64Array;
  cum: Float64Array;
  depN: Int32Array;
  depCum: Float64Array;
  depMark: Uint8Array;
  depAmt: Float64Array;
  ev: AccountEvent[];
  /** The monthly total the model assumes. */
  D: number;
  min: number;
  minT: number;
}

/** Account balance per day. `D` overrides the monthly deposit (scenario). */
export function moneyModel(s: FerieState, today: number, D: number | null = null): MoneyModel {
  const st = kStart(s, today);
  const en = moneyEnd(s, today);
  const n = Math.round((en - st) / DAY) + 1;
  const fixed = new Float64Array(n);
  const depMark = new Uint8Array(n);
  const depAmt = new Float64Array(n);
  const ev = accountEvents(s, st);
  for (const e of ev) {
    const i = Math.round((e.t - st) / DAY);
    if (i >= 0 && i < n) fixed[i] += e.amt;
  }
  for (const t of depositDays(s, st, en)) {
    const i = Math.round((t - st) / DAY);
    depMark[i] = 1;
    depAmt[i] = D !== null ? D : scheduledAmount(s, t);
  }
  const bal = new Float64Array(n);
  const cum = new Float64Array(n);
  const depN = new Int32Array(n);
  const depCum = new Float64Array(n);
  let c = +s.kasse.start || 0;
  let N = 0;
  let dc = 0;
  let mn = Infinity;
  let mnI = 0;
  for (let i = 0; i < n; i++) {
    c += fixed[i];
    if (depMark[i]) {
      N++;
      dc += depAmt[i];
    }
    cum[i] = c;
    depN[i] = N;
    depCum[i] = dc;
    bal[i] = c + dc;
    if (bal[i] < mn - 1e-9) {
      mn = bal[i];
      mnI = i;
    }
  }
  return {
    st, en, n, bal, cum, depN, depCum, depMark, depAmt, ev,
    D: D !== null ? D : currentRate(s, today),
    min: mn,
    minT: st + mnI * DAY,
  };
}

export const idxOf = (m: MoneyModel, t: number): number =>
  Math.max(0, Math.min(m.n - 1, Math.round((t - m.st) / DAY)));

export interface Segment {
  rate: number;
  from: number;
  to: number;
  count: number;
  bind: number;
  k0: number;
  k1: number;
}

export interface Analysis {
  m: MoneyModel;
  /** Fixed monthly amount that would cover everything. */
  cReq: number;
  cBind: number | null;
  segs: Segment[];
  /** Shortfall before the first deposit, if any. */
  inf: { t: number; short: number } | null;
  off: number;
  oneOff: { amount: number; rate: number } | null;
}

/** Finds the fixed amount that covers everything, and a stepped plan (low as possible up to each big payment). */
export function analyze(s: FerieState, today: number): Analysis {
  const m = moneyModel(s, today, 0);
  const buf = +s.kasse.buffer || 0;
  const n = m.n;
  const depIdx: number[] = [];
  for (let i = 0; i < n; i++) if (m.depMark[i]) depIdx.push(i);
  let inf: { t: number; short: number } | null = null;
  for (let i = 0; i < n && m.depN[i] === 0; i++) {
    const need = buf - m.cum[i];
    if (need > 0.5 && (!inf || need > inf.short)) inf = { t: m.st + i * DAY, short: need };
  }
  const off = inf ? Math.ceil(inf.short / 100) * 100 : 0;
  let cReq = 0;
  let cBind: number | null = null;
  for (let i = 0; i < n; i++) {
    const N = m.depN[i];
    if (!N) continue;
    const d = (buf - m.cum[i] - off) / N;
    if (d > cReq + 1e-9) {
      cReq = d;
      cBind = m.st + i * DAY;
    }
  }
  const segs: Segment[] = [];
  let p = 0;
  let A = off;
  let s0 = 0;
  while (p < depIdx.length && segs.length < 24) {
    let best = -Infinity;
    let bi = -1;
    for (let i = s0; i < n; i++) {
      const N = m.depN[i];
      if (N <= p) continue;
      const r = (buf - m.cum[i] - A) / (N - p);
      if (r >= best - 1e-6) {
        best = r;
        bi = i;
      }
    }
    if (bi < 0 || best <= 0.5) break;
    const rate = ceil50(best);
    const k = m.depN[bi];
    segs.push({ rate, from: m.st + depIdx[p] * DAY, to: m.st + depIdx[k - 1] * DAY, count: k - p, bind: m.st + bi * DAY, k0: p, k1: k });
    A += rate * (k - p);
    p = k;
    s0 = bi + 1;
  }
  let oneOff: Analysis['oneOff'] = null;
  if (segs.length) {
    const r2 = segs.length > 1 ? segs[1].rate : segs[0].rate;
    let need1 = 0;
    for (let i = 0; i < n; i++) {
      const v = buf - m.cum[i] - r2 * m.depN[i];
      if (v > need1) need1 = v;
    }
    oneOff = { amount: Math.ceil(need1 / 100) * 100, rate: r2 };
  }
  return { m, cReq: ceil50(cReq), cBind, segs, inf, off, oneOff };
}

export function eventLabel(s: FerieState, e: AccountEvent): string {
  const tr = e.it.tripId ? s.trips.find((t) => t.id === e.it.tripId) : undefined;
  return tr ? tr.name || 'Rejse' : e.it.label || e.it.cat || 'Udgift';
}

export function bindingInfo(s: FerieState, m: MoneyModel, t: number | null) {
  if (t === null) return null;
  let best: AccountEvent | null = null;
  for (const e of m.ev) if (e.amt < 0 && e.t <= t && (!best || e.t >= best.t)) best = e;
  return best ? { name: eventLabel(s, best), t: best.t } : null;
}

export const bindingText = (s: FerieState, m: MoneyModel, t: number | null): string => {
  const b = bindingInfo(s, m, t);
  return b ? `${b.name}, der betales ${fmtShort(b.t, true)}` : '';
};

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
export { cap };

export function monthOf(s: FerieState, t: number): string {
  const d = new Date(t);
  return MONTHS[d.getUTCMonth()] + (d.getUTCFullYear() !== s.settings.year ? ` ${d.getUTCFullYear()}` : '');
}

export function planSentence(s: FerieState, segs: Segment[]): string {
  return segs
    .map((sg, i) => {
      if (i === segs.length - 1 && i > 0) return `derefter ${kr(sg.rate)} om måneden`;
      if (sg.count === 1) return `${kr(sg.rate)} i ${monthOf(s, sg.from)}`;
      return `${kr(sg.rate)} om måneden i ${monthOf(s, sg.from)}–${monthOf(s, sg.to)}`;
    })
    .join(', ');
}

export function nextChangeText(s: FerieState, today: number): string {
  if (!hasSteps(s)) return '';
  const st = kStart(s, today);
  const nd = depositDays(s, st, st + 62 * DAY)[0] ?? st;
  const ym = toISO(nd).slice(0, 7);
  const nx = s.kasse.steps.find((x) => x.from > ym);
  return nx ? `Fra ${monthOf(s, toTime(`${nx.from}-01`))} sætter I ${kr(nx.total)} ind om måneden.` : '';
}

export function stepsFromSegments(segs: Segment[]): Step[] {
  const steps: Step[] = [];
  for (const sg of segs) {
    const from = toISO(sg.from).slice(0, 7);
    if (steps.length && steps[steps.length - 1].total === sg.rate) continue;
    steps.push({ from, total: sg.rate });
  }
  return steps;
}

/** A person-to-person settlement for expenses one of you paid out of pocket. */
export interface Settlement {
  /** Positive: b owes a. Negative: a owes b. */
  net: number;
  rows: { id: string; payer: 'a' | 'b'; text: string; amount: number }[];
}

export function settlement(s: FerieState): Settlement {
  const owe = { a: 0, b: 0 };
  const rows: Settlement['rows'] = [];
  for (const it of s.money) {
    if (it.kind === 'deposit' || (it.payer !== 'a' && it.payer !== 'b') || !hasAct(it)) continue;
    const tr = it.tripId ? s.trips.find((t) => t.id === it.tripId) : undefined;
    const who = tr ? tr.who : 'both';
    const p = it.payer;
    const o = p === 'a' ? 'b' : 'a';
    const act = +(it.act as number);
    let share = 0;
    if (who === 'both') share = act / 2;
    else if (who === o) share = act;
    if (share > 0) {
      owe[o] += share;
      rows.push({ id: it.id, payer: p, text: `${it.label || it.cat || 'udgift'}${tr ? ` (${tr.name || 'Rejse'})` : ''}`, amount: act });
    }
  }
  return { net: owe.b - owe.a, rows };
}

export interface TripBudget {
  items: MoneyItem[];
  total: number;
  paid: number;
  /** Actual minus estimate for paid items. */
  over: number;
  days: number;
  lowest: { bal: number; t: number } | null;
}

export function tripBudget(s: FerieState, tripId: string, m: MoneyModel): TripBudget {
  const tr = s.trips.find((t) => t.id === tripId);
  const items = s.money
    .filter((it) => it.tripId === tripId && it.kind !== 'deposit')
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.created - b.created);
  const total = items.reduce((x, it) => x + itemAmount(it, s.kasse.margin), 0);
  const paid = items.reduce((x, it) => x + (hasAct(it) ? +(it.act as number) : 0), 0);
  const over = items.reduce((x, it) => x + (hasAct(it) && hasEst(it) ? +(it.act as number) - +(it.est as number) : 0), 0);
  let lowest: TripBudget['lowest'] = null;
  for (const e of m.ev) {
    if (e.it.tripId !== tripId || e.amt >= 0) continue;
    const b = m.bal[idxOf(m, e.t)];
    if (!lowest || b < lowest.bal) lowest = { bal: b, t: e.t };
  }
  return { items, total, paid, over, days: tr ? tripDays(tr, s.settings.extraOff) : 0, lowest };
}
