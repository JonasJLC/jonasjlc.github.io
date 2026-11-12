export type Limits = { min: number; max: number };

/** Persons stepper limits (reference: 1 to 8). */
export const personLimits: Limits = { min: 1, max: 8 };

const clamp = (value: number, { min, max }: Limits) => Math.min(max, Math.max(min, value));

/** Move by `delta`, always landing inside the limits. */
export const step = (value: number, delta: number, limits: Limits) => clamp(value + delta, limits);

export const canDecrement = (value: number, { min }: Limits) => value > min;
export const canIncrement = (value: number, { max }: Limits) => value < max;

/** `1 person`, `2 personer`. */
export const personsLabel = (n: number) => (n === 1 ? '1 person' : `${n} personer`);
