import { balanceSeries } from './balance';
import { DAY } from './dates';
import { isWorkDay } from './holidays';
import type { FerieState, PersonKey } from './types';

/**
 * First work day from `today` on where every listed person has at least `need`
 * days and stays at or above it for all later planned trips. `null` if never.
 */
export function earliestAffordable(
  state: FerieState,
  need: number,
  keys: PersonKey[],
  today: number,
  excludeId?: string,
): number | null {
  const en = Date.UTC(state.settings.year + 2, 11, 31);
  const suffixMins = keys.map((k) => {
    const b = balanceSeries(state, k, today, en, excludeId);
    const s = new Float64Array(b.length);
    let mn = Infinity;
    for (let i = b.length - 1; i >= 0; i--) {
      mn = Math.min(mn, b[i]);
      s[i] = mn;
    }
    return s;
  });
  for (let i = 0; i < suffixMins[0].length; i++) {
    const t = today + i * DAY;
    if (!isWorkDay(t, state.settings.extraOff)) continue;
    if (suffixMins.every((s) => s[i] >= need - 1e-9)) return t;
  }
  return null;
}
