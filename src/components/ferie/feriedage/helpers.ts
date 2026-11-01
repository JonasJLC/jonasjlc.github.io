import { tripDays, valueAt, whoKeys, type Span } from '../lib/balance';
import { DAY, fmtN, toTime } from '../lib/dates';
import { verdict } from '../lib/finder';
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
  /** Vacation days the trip costs this person. */
  days: number;
  /** Balance the day before the trip. */
  before: number;
  /** Balance at the end of the trip's last day. */
  after: number;
  /** Lowest balance from the trip's start until the horizon, trip included. */
  lowest: number;
  /** The balance goes negative during the trip itself. */
  short: boolean;
  /** The trip fits, but pushes a later trip into the red that fit without it. */
  squeezes: boolean;
}

/** Balance effect of `span` for each person in `who`, ignoring saved trip `excludeId`. */
export function impact(state: FerieState, who: Who, span: Span, excludeId?: string): Impact[] {
  const from = toTime(span.from), to = toTime(span.to);
  return whoKeys(who).map((k) => {
    const v = verdict(state, k, from, to, span, excludeId);
    return {
      k,
      days: tripDays(state, span, k),
      before: valueAt(v.base, from - DAY),
      after: valueAt(v.withT, to),
      lowest: Math.min(v.during, v.later),
      short: v.short,
      squeezes: v.squeezes,
    };
  });
}

/** "5" when everyone pays the same, else "4–5". */
export function fmtDaysRange(list: number[]): string {
  const lo = Math.min(...list), hi = Math.max(...list);
  return Math.abs(hi - lo) < 1e-9 ? fmtN(lo) : `${fmtN(lo)}–${fmtN(hi)}`;
}

export { DAY, tripDays };
