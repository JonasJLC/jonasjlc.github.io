import { commonDaysOff } from './balance';
import { DAY, toISO, toTime } from './dates';
import { holidayName, isWorkDay } from './holidays';
import type { FerieState } from './types';

export interface Bridge {
  /** First and last day of the whole stretch off (UTC midnight). */
  from: number;
  to: number;
  /** Vacation days it costs. */
  cost: number;
  /** Days off in a row, weekends and holidays included. */
  total: number;
  /** Names of the public holidays inside it. */
  holidays: string[];
}

const MAX_COST = 4;
const MIN_RATIO = 2.5;
/** Fewer days off in a row than this is not enough to go anywhere, or is easy to spot yourself. */
const MIN_TOTAL = 5;

/**
 * Stretches in `year` where a few vacation days link weekends and public holidays into a long
 * break, with nothing booked. Only breaks long enough to travel on. Best value first;
 * overlapping stretches keep only the best.
 */
export function findBridges(state: FerieState, today: number, year: number): Bridge[] {
  const off = commonDaysOff(state, 'both');
  const start = Math.max(today, Date.UTC(year, 0, 1));
  const end = Date.UTC(year, 11, 31);
  const booked = state.trips
    .map((t) => [toTime(t.from), toTime(t.to)] as const)
    .filter(([a, b]) => !Number.isNaN(a) && !Number.isNaN(b));
  const clash = (a: number, b: number) => booked.some(([x, y]) => x <= b && y >= a);

  // Runs of consecutive free days (weekend/holiday) that contain a public holiday or a weekend.
  const runs: { a: number; b: number }[] = [];
  for (let t = start; t <= end; t += DAY) {
    if (isWorkDay(t, off)) continue;
    const last = runs[runs.length - 1];
    if (last && last.b === t - DAY) last.b = t;
    else runs.push({ a: t, b: t });
  }

  const found: Bridge[] = [];
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      const from = runs[i].a, to = runs[j].b;
      let cost = 0;
      const names: string[] = [];
      for (let t = from; t <= to; t += DAY) {
        if (isWorkDay(t, off)) cost++;
        else {
          const n = holidayName(t, off);
          if (n) names.push(n);
        }
      }
      if (cost > MAX_COST) break;
      if (cost < 1 || !names.length) continue;
      const total = Math.round((to - from) / DAY) + 1;
      if (total < MIN_TOTAL || total / cost < MIN_RATIO || clash(from, to)) continue;
      found.push({ from, to, cost, total, holidays: names });
    }
  }

  found.sort((x, y) => y.total / y.cost - x.total / x.cost || x.from - y.from);
  const picked: Bridge[] = [];
  for (const b of found) if (!picked.some((p) => p.from <= b.to && p.to >= b.from)) picked.push(b);
  return picked.sort((x, y) => x.from - y.from);
}

export const bridgeKey = (b: Pick<Bridge, 'from' | 'to'>) => `${toISO(b.from)}_${toISO(b.to)}`;
