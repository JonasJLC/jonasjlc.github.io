import { balanceAt, balanceSeries, tripDays, whoKeys } from '../lib/balance';
import { DAY } from '../lib/dates';
import type { FerieState, PersonKey, Who } from '../lib/types';

export const personName = (s: FerieState, k: PersonKey): string =>
  s.settings.people[k].name.trim() || (k === 'a' ? 'Person 1' : 'Person 2');

export const personColor = (k: PersonKey): string => `var(--person-${k})`;

export const whoOptions = (s: FerieState) => [
  { value: 'both' as Who, label: 'Begge' },
  { value: 'a' as Who, label: personName(s, 'a'), color: personColor('a') },
  { value: 'b' as Who, label: personName(s, 'b'), color: personColor('b') },
];

export interface Impact {
  k: PersonKey;
  before: number;
  after: number;
  /** Lowest balance from the trip's start until the end of the horizon. */
  lowest: number;
}

/** Balance effect of taking `days` off starting `from`, ignoring trip `excludeId`. */
export function impact(
  state: FerieState,
  who: Who,
  from: number,
  days: number,
  excludeId?: string,
): Impact[] {
  const horizon = Date.UTC(state.settings.year + 2, 11, 31);
  return whoKeys(who).map((k) => {
    const before = balanceAt(state, k, from, excludeId);
    const series = balanceSeries(state, k, from, Math.max(from, horizon), excludeId);
    let lowest = Infinity;
    for (const v of series) lowest = Math.min(lowest, v);
    return { k, before, after: before - days, lowest: lowest - days };
  });
}

export { DAY, tripDays };
