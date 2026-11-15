/**
 * Scaling of ingredient amounts with the number of persons (design §5.3.1): linear, then rounded to what a person can
 * measure in a kitchen. Pure functions, no dependencies.
 */

export type Scalable = { amount: number | null; unit: string | null; name: string; scales: boolean };

const norm = (s: string | null) => (s ?? '').trim().toLocaleLowerCase('da').replace(/\.$/, '');

const spoons = new Set(['tsk', 'spsk', 'knsp', 'krm', 'tsk.', 'spsk.']);
const smallMass = new Set(['g', 'gr', 'ml']);
const deci = new Set(['dl', 'cl']);
const large = new Set(['kg', 'l']);

const roundTo = (value: number, step: number) => Math.round(value / step) * step;

/** Round an already-scaled amount to a kitchen-friendly value for its unit. Never returns less than one step above zero. */
export function kitchenRound(value: number, unit: string | null, name: string): number {
  if (!(value > 0)) return 0;
  const u = norm(unit);
  const n = norm(name);
  let out: number;
  if (smallMass.has(u)) {
    if (value >= 20) out = roundTo(value, 5);
    else if (value >= 5) out = roundTo(value, 1);
    else out = roundTo(value, 0.5);
  } else if (deci.has(u)) {
    out = roundTo(value, 0.25);
  } else if (large.has(u)) {
    out = roundTo(value, 0.05);
  } else if (spoons.has(u)) {
    out = roundTo(value, 0.25);
  } else if (!u && /^æg(\s|$)/.test(n)) {
    out = Math.max(1, Math.round(value)); // whole eggs
  } else if (u === 'stk') {
    out = /^æg(\s|$)/.test(n) ? Math.max(1, Math.round(value)) : roundTo(value, 0.5);
  } else {
    out = value >= 5 ? Math.round(value) : roundTo(value, 0.5);
  }
  const smallest = smallMass.has(u) ? 0.5 : large.has(u) ? 0.05 : 0.25;
  return Math.max(out, smallest);
}

/** The amount for `persons` when the recipe is written for `base`. `null` stays `null`; ingredients that do not scale stay as written. */
export function scaleIngredient(i: Scalable, base: number, persons: number): number | null {
  if (i.amount === null) return null;
  if (!i.scales || base <= 0 || persons === base) return i.amount;
  return kitchenRound((i.amount * persons) / base, i.unit, i.name);
}

const fractions: Record<number, string> = { 0.25: '¼', 0.5: '½', 0.75: '¾' };

/** `1500` → `1500`, `1.5` → `1½`, `0.25` → `¼`, `2.3` → `2,3` (Danish decimal comma, no trailing zeros). */
export function formatAmount(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '';
  const whole = Math.floor(value + 1e-9);
  const frac = Math.round((value - whole) * 100) / 100;
  if (frac === 0) return String(whole);
  const glyph = fractions[frac];
  if (glyph) return whole === 0 ? glyph : `${whole}${glyph}`;
  return String(Math.round(value * 100) / 100).replace('.', ',');
}

/** `250 g`, `1½ tsk`, `3` (no unit), `` (no amount). */
export function formatQuantity(amount: number | null, unit: string | null): string {
  const a = formatAmount(amount);
  if (!a) return '';
  return unit?.trim() ? `${a} ${unit.trim()}` : a;
}
