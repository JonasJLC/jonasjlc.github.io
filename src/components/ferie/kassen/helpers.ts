import { personName } from '../feriedage/helpers';
import type { FerieState, Payer } from '../lib/types';

export { personName };

export const payerOptions = (s: FerieState) => [
  { value: 'acc' as Payer, label: 'Kontoen' },
  { value: 'a' as Payer, label: personName(s, 'a'), color: 'var(--person-a)' },
  { value: 'b' as Payer, label: personName(s, 'b'), color: 'var(--person-b)' },
];

/** Parses a Danish-style number; empty string means "not set". */
export function parseNum(v: string): number | null {
  const t = v.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isNaN(n) ? null : n;
}
