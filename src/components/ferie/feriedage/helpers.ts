import { balanceAt, balanceSeries, tripDays, whoKeys } from '../lib/balance';
import { DAY } from '../lib/dates';
import type { FerieState, PersonKey, Who } from '../lib/types';

export const personName = (s: FerieState, k: PersonKey): string =>
  s.settings.people[k].name.trim() || (k === 'a' ? 'Camilla' : 'Jonas');

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
  /** The trip itself leaves the balance negative. */
  short: boolean;
  /** The trip fits, but pushes a later trip into the red that fit without it. */
  squeezes: boolean;
}

const EPS = 1e-9;

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
    let without = Infinity;
    for (const v of series) without = Math.min(without, v);
    const after = before - days;
    const lowest = without - days;
    const short = after < -EPS;
    const squeezes = !short && lowest < -EPS && without >= -EPS;
    return { k, before, after, lowest, short, squeezes };
  });
}

export { DAY, tripDays };
