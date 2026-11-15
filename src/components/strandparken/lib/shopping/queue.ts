import { canonicalName, type GroceryCategory, type ShoppingRow, type Status } from './model.ts';

/**
 * Offline changes (ADR-09). Only what a person does in the shop is queued: ticking, un-ticking, clearing (all
 * "set status") and adding an item. Everything else needs a connection and says so.
 */
export type Op =
  | { opId: string; at: string; kind: 'status'; ids: string[]; status: Status; by: string | null }
  | { opId: string; at: string; kind: 'add'; row: { id: string; household_id: string; name: string; grocery_category_id: string | null } };

/** The list as the person should see it: server rows with every queued change laid over them, in order. */
export function applyOps(rows: readonly ShoppingRow[], ops: readonly Op[]): ShoppingRow[] {
  let out = [...rows];
  for (const op of ops) {
    if (op.kind === 'status') {
      const ids = new Set(op.ids);
      out = out.map((r) => (ids.has(r.id) ? { ...r, status: op.status, checked_by: op.status === 'checked' ? op.by : null, client_updated_at: op.at } : r));
    } else if (!out.some((r) => r.id === op.row.id)) {
      out.push({
        id: op.row.id, household_id: op.row.household_id, name: op.row.name, canonical_name: canonicalName(op.row.name),
        amount: null, unit: null, grocery_category_id: op.row.grocery_category_id, status: 'active', checked_by: null,
        checked_at: null, source: 'manual', plan_entry_id: null, recipe_id: null, client_updated_at: op.at,
        created_at: op.at, updated_at: op.at, created_by: null,
      });
    }
  }
  return out;
}

/** Newer changes to the same rows make older queued ones pointless: only the last status per row is kept. */
export function compact(ops: readonly Op[]): Op[] {
  const lastFor = new Map<string, string>();
  for (const op of ops) if (op.kind === 'status') for (const id of op.ids) lastFor.set(id, op.opId);
  const out: Op[] = [];
  for (const op of ops) {
    if (op.kind === 'add') {
      out.push(op);
      continue;
    }
    const ids = op.ids.filter((id) => lastFor.get(id) === op.opId);
    if (ids.length) out.push({ ...op, ids });
  }
  return out;
}

// ---- Persistence: localStorage can be missing or full (private window), so every call is guarded and the app works without it.

const key = (householdId: string, what: 'queue' | 'cache') => `strandparken:shopping:${what}:${householdId}`;

function read<T>(k: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(k: string, value: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(value));
  } catch {
    /* no storage: the change still reaches the list, it just will not survive a reload while offline */
  }
}

export const loadQueue = (householdId: string) => read<Op[]>(key(householdId, 'queue'), []);
export const saveQueue = (householdId: string, ops: Op[]) => write(key(householdId, 'queue'), ops);

export type Cache = { rows: ShoppingRow[]; categories: GroceryCategory[] };
export const loadCache = (householdId: string) => read<Cache | null>(key(householdId, 'cache'), null);
export const saveCache = (householdId: string, cache: Cache) => write(key(householdId, 'cache'), cache);

/** An op before it is stamped with its id and time. */
export type NewOp = Op extends infer O ? (O extends Op ? Omit<O, 'opId' | 'at'> : never) : never;

export const newOpId = () => crypto.randomUUID();
