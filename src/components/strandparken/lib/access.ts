import { personFromKey, type Person } from './people.ts';

export type Access =
  | { status: 'no-access' }
  | { status: 'ready'; householdId: string; person: Person };

/**
 * What the signed-in user's `household_members` row means. No row, or a row without a person key we know, is
 * `no-access`: the app needs to know who is using it. (The data itself is protected by row-level security.)
 */
export function resolveAccess(row: { household_id?: unknown; person?: unknown } | null | undefined): Access {
  const person = personFromKey(row?.person);
  if (!row || typeof row.household_id !== 'string' || !person) return { status: 'no-access' };
  return { status: 'ready', householdId: row.household_id, person };
}
