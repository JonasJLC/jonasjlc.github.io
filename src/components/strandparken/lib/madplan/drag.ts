import { addDays, weekdayLong, type IsoDate } from './dates.ts';
import { entryOn, type PlanEntry } from './model.ts';

// What moving a planned dinner means (design §5.3.3). Drag and drop and the sheet's "Flyt til…" share these rules, so
// both ways behave the same.

export type DropOutcome = { kind: 'none' } | { kind: 'move'; to: IsoDate } | { kind: 'swap'; with: PlanEntry };

/** Dropping on its own day or outside a day does nothing, an empty day is a move, a planned day is a swap. */
export function dropOutcome(from: IsoDate, to: IsoDate | null, entriesOfTargetWeek: readonly PlanEntry[]): DropOutcome {
  if (!to || to === from) return { kind: 'none' };
  const other = entryOn(entriesOfTargetWeek, to);
  return other ? { kind: 'swap', with: other } : { kind: 'move', to };
}

/** The toast after a move: "Flyttet til fredag", or "Byttet med Tacos". */
export const moveMessage = (kind: 'move' | 'swap', to: IsoDate, otherTitle = ''): string =>
  kind === 'move' ? `Flyttet til ${weekdayLong(to)}` : `Byttet med ${otherTitle}`;

/** Droppable ids: `day:<date>` for each day row, `week:prev` and `week:next` for the week arrows. */
export const dayDroppable = (date: IsoDate) => `day:${date}`;

export const dayOfDroppable = (id: string | number | null | undefined): IsoDate | null =>
  typeof id === 'string' && id.startsWith('day:') ? id.slice(4) : null;

/** The Monday a week arrow leads to while dragging over it, or null when `id` is not an arrow. */
export function edgeWeek(id: string | number | null | undefined, monday: IsoDate): IsoDate | null {
  if (id === 'week:next') return addDays(monday, 7);
  if (id === 'week:prev') return addDays(monday, -7);
  return null;
}

/** The shown list after the move, before the server confirms it. Entries outside the shown week are left to the reload. */
export function applyOutcome(entries: readonly PlanEntry[], entry: PlanEntry, outcome: DropOutcome): PlanEntry[] {
  if (outcome.kind === 'none') return [...entries];
  const other = outcome.kind === 'swap' ? outcome.with : null;
  const rest = entries.filter((e) => e.id !== entry.id && e.id !== other?.id);
  const moved = [{ ...entry, date: other ? other.date : (outcome as { to: IsoDate }).to }];
  if (other) moved.push({ ...other, date: entry.date });
  return [...rest, ...moved].sort((a, b) => a.date.localeCompare(b.date));
}
