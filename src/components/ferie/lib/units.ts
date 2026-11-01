import { fmtN } from './dates';
import type { Settings, Unit } from './types';

/** 2,08 feriedage = 15,41 ferietimer. Balances are stored in days; hours are derived. */
export const HOURS_PER_DAY = 15.41 / 2.08;

export const hoursPerDay = (s: Pick<Settings, 'hoursPerDay'>): number =>
  s.hoursPerDay > 0 ? s.hoursPerDay : HOURS_PER_DAY;

export const toHours = (days: number, s: Pick<Settings, 'hoursPerDay'>): number => days * hoursPerDay(s);

/** "15,41 t" for a number of days. */
export const fmtHours = (days: number, s: Pick<Settings, 'hoursPerDay'>): string => `${fmtN(toHours(days, s))} t`;

/** Value as typed in the given unit, trimmed of float noise. */
export const toInput = (days: number, unit: Unit, s: Pick<Settings, 'hoursPerDay'>): number =>
  Math.round((unit === 'hours' ? toHours(days, s) : days) * 100) / 100;

/** Parse a typed number in `unit` back to days; NaN when not a number. */
export const parseDays = (raw: string, unit: Unit, s: Pick<Settings, 'hoursPerDay'>): number => {
  if (raw.trim() === '') return 0;
  const v = Number(raw.replace(',', '.'));
  return unit === 'hours' ? v / hoursPerDay(s) : v;
};
