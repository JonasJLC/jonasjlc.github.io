import { commonDaysOff, ledger, minOver, valueAt } from './balance';
import { DAY, toISO } from './dates';
import { addWorkDays, isWorkDay } from './holidays';
import type { FerieState, PersonKey, Who } from './types';

const EPS = 1e-9;

/** Shortfall verdict for one person if `span` is added (see `impact`). */
export function verdict(
  state: FerieState, k: PersonKey, from: number, to: number, add: { from: string; to: string; days: number | null }, excludeId?: string,
) {
  const base = ledger(state, k, excludeId);
  const withT = ledger(state, k, excludeId, add);
  const during = minOver(withT, from, to);
  const later = minOver(withT, to + DAY, withT.horizon);
  const laterWithout = minOver(base, to + DAY, base.horizon);
  const short = during < -EPS;
  const squeezes = !short && later < -EPS && laterWithout >= -EPS;
  return { base, withT, during, later, short, squeezes };
}

/**
 * First work day from `today` where a trip of `need` days fits for everyone in `keys`:
 * no one goes below zero during it, and no later trip that fit without it stops fitting.
 * `null` if never before the horizon.
 */
export function earliestAffordable(
  state: FerieState,
  need: number,
  keys: PersonKey[],
  today: number,
  excludeId?: string,
): number | null {
  const who: Who = keys.length > 1 ? 'both' : keys[0];
  const off = commonDaysOff(state, who);
  const bases = keys.map((k) => ledger(state, k, excludeId));
  const horizon = bases[0].horizon;
  for (let t = today; t <= horizon; t += DAY) {
    if (!isWorkDay(t, off)) continue;
    const to = Math.max(t, addWorkDays(t, need, off));
    if (to > horizon) return null;
    // Cheap reject: by the last day the trip can at most save what would have expired meanwhile.
    if (bases.some((L) => {
      const saved = L.lost.reduce((s, x) => (x.t >= t && x.t <= to ? s + x.amt : s), 0);
      return t >= L.asOf && valueAt(L, to) - need + saved < -EPS;
    })) continue;
    const add = { from: toISO(t), to: toISO(to), days: need };
    if (keys.every((k) => {
      const v = verdict(state, k, t, to, add, excludeId);
      return !v.short && !v.squeezes;
    })) return t;
  }
  return null;
}
