import { defaultSettings, defaultState } from './defaults';
import type { FerieState, Trip } from './types';

/** Persistence boundary. A Supabase implementation can replace the local one later. */
export interface FerieStore {
  load(): FerieState;
  save(state: FerieState): void;
}

const KEY = 'ferie-v1';

export function normalize(raw: unknown): FerieState {
  const d = defaultState();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as { settings?: Partial<FerieState['settings']>; trips?: unknown };
  const s = r.settings ?? {};
  const people = (s.people ?? {}) as Partial<FerieState['settings']['people']>;
  const base = defaultSettings();
  const trips: Trip[] = Array.isArray(r.trips)
    ? (r.trips as Partial<Trip>[])
        .filter((t) => t && typeof t.from === 'string' && typeof t.to === 'string')
        .map((t, i) => ({
          id: String(t.id ?? `t${i}`),
          name: String(t.name ?? ''),
          from: t.from as string,
          to: t.to as string,
          who: t.who === 'a' || t.who === 'b' ? t.who : 'both',
          days: t.days === null || t.days === undefined || Number.isNaN(+t.days) ? null : +t.days,
          created: Number(t.created) || 0,
        }))
    : [];
  return {
    settings: {
      year: +(s.year as number) || base.year,
      extraOff: !!s.extraOff,
      people: {
        a: { ...base.people.a, ...(people.a ?? {}) },
        b: { ...base.people.b, ...(people.b ?? {}) },
      },
    },
    trips,
  };
}

/** localStorage-backed store; falls back to memory when storage throws. */
export function createLocalStore(): FerieStore {
  let memory: FerieState | null = null;
  return {
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) return normalize(JSON.parse(raw));
      } catch {
        /* storage unavailable or corrupt: fall through */
      }
      return memory ? normalize(memory) : defaultState();
    },
    save(state) {
      memory = state;
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch {
        /* keep in-memory copy */
      }
    },
  };
}
