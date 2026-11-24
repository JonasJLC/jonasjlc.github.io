// Test doubles shared by the Deno tests. Not imported by any function.
import type { Caller, GuardDeps } from './guard.ts';
import type { ModelClient } from './anthropic.ts';
import type { UsageDb, UsageRow } from './usage.ts';
import type { Connection, HealthDb, TokenRow, Who } from './health/db.ts';
import type { HealthDay } from './health/types.ts';

export interface FakeUsage extends UsageDb {
  rows: UsageRow[];
  state: { callsToday: number; monthCostDkk: number };
}

export function fakeUsage(state = { callsToday: 0, monthCostDkk: 0 }): FakeUsage {
  const rows: UsageRow[] = [];
  return { rows, state, totals: () => Promise.resolve({ ...state }), log: (r) => { rows.push(r); return Promise.resolve(); } };
}

export function fakeCaller(usage: UsageDb = fakeUsage()): Caller {
  return { userId: 'u1', householdId: 'h1', person: 'b', isOwner: true, usage };
}

export function fakeDeps(over: Partial<GuardDeps> = {}): GuardDeps {
  return {
    verify: () => Promise.resolve({ userId: 'u1' }),
    membership: () => Promise.resolve({ householdId: 'h1', person: 'b', isOwner: false }),
    usage: fakeUsage(),
    ...over,
  };
}

export const request = (init: { method?: string; token?: string | null; body?: unknown } = {}) =>
  new Request('https://example.test/fn', {
    method: init.method ?? 'POST',
    headers: {
      Origin: 'https://jonasjlc.github.io',
      ...(init.token === null ? {} : { Authorization: `Bearer ${init.token ?? 'good'}` }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

type Reply = { text?: string; stop?: string; usage?: { input_tokens: number; output_tokens: number }; throws?: boolean };

/** A model client that answers from a script and records every request it was sent. */
export function fakeModel(replies: Reply[]): ModelClient & { sent: Record<string, unknown>[] } {
  const sent: Record<string, unknown>[] = [];
  return {
    sent,
    messages: {
      create(params) {
        sent.push(params);
        const r = replies[Math.min(sent.length - 1, replies.length - 1)];
        if (r.throws) return Promise.reject(new Error('network'));
        return Promise.resolve({
          content: r.text === undefined ? [] : [{ type: 'text', text: r.text }],
          stop_reason: r.stop ?? 'end_turn',
          usage: r.usage ?? { input_tokens: 1000, output_tokens: 100 },
        });
      },
    },
  };
}

/**
 * An in-memory health database. Each method runs to completion before another starts, which is what the advisory lock in
 * the real RPCs guarantees. `now` drives the refresh lease.
 */
export function fakeHealthDb(now: () => number = () => Date.now()): HealthDb & {
  tokens: Map<string, TokenRow & { leaseUntil: number }>;
  conns: Connection[];
  days: (HealthDay & Who)[];
  errors: Map<string, string | null>;
} {
  const tokens = new Map<string, TokenRow & { leaseUntil: number }>();
  const conns: Connection[] = [];
  const errors = new Map<string, string | null>();
  let days: (HealthDay & Who)[] = [];
  const k = (w: Who, p: string) => `${w.householdId}/${w.person}/${p}`;
  const same = (a: Who, b: Who) => a.householdId === b.householdId && a.person === b.person;
  return {
    tokens,
    conns,
    errors,
    get days() { return days; },
    getTokens: (w, p) => {
      const t = tokens.get(k(w, p));
      return Promise.resolve(t ? { access: t.access, refresh: t.refresh, apiKey: t.apiKey, expiresAt: t.expiresAt, version: t.version } : null);
    },
    putTokens: (w, p, t) => {
      const prev = tokens.get(k(w, p));
      tokens.set(k(w, p), {
        access: t.access ?? null, refresh: t.refresh ?? null, apiKey: t.apiKey ?? null, expiresAt: t.expiresAt ?? null,
        version: (prev?.version ?? 0) + 1, leaseUntil: 0,
      });
      return Promise.resolve();
    },
    claimRefresh: (w, p, s) => {
      const t = tokens.get(k(w, p));
      if (!t) return Promise.resolve({ claimed: false, version: 0, refresh: null });
      if (t.leaseUntil > now()) return Promise.resolve({ claimed: false, version: t.version, refresh: null });
      t.leaseUntil = now() + s * 1000;
      return Promise.resolve({ claimed: true, version: t.version, refresh: t.refresh });
    },
    storeRefresh: (w, p, v, n) => {
      const t = tokens.get(k(w, p));
      if (!t || t.version !== v) return Promise.resolve(false);
      Object.assign(t, { access: n.access, refresh: n.refresh, expiresAt: n.expiresAt, version: v + 1, leaseUntil: 0 });
      return Promise.resolve(true);
    },
    deleteTokens: (w, p) => { tokens.delete(k(w, p)); return Promise.resolve(); },
    connections: (w) => Promise.resolve(conns.filter((c) => !w || same(c, w)).map((c) => ({ ...c }))),
    upsertConnection: (w, s, patch) => {
      const c = conns.find((x) => same(x, w) && x.source === s);
      if (c) { if (patch.stepGoal !== undefined) c.stepGoal = patch.stepGoal; }
      else conns.push({ ...w, source: s, lastSyncedAt: null, stepGoal: patch.stepGoal ?? null });
      errors.set(k(w, s), null);
      return Promise.resolve();
    },
    setSyncResult: (w, s, r) => {
      const c = conns.find((x) => same(x, w) && x.source === s);
      if (c && r.at) c.lastSyncedAt = r.at;
      errors.set(k(w, s), r.error);
      return Promise.resolve();
    },
    deleteConnection: (w, s) => {
      const i = conns.findIndex((x) => same(x, w) && x.source === s);
      if (i >= 0) conns.splice(i, 1);
      return Promise.resolve();
    },
    upsertDays: (w, ds) => {
      for (const d of ds) {
        days = days.filter((x) => !(same(x, w) && x.date === d.date && x.source === d.source));
        days.push({ ...d, ...w });
      }
      return Promise.resolve();
    },
    deleteDays: (w, s) => { days = days.filter((x) => !(same(x, w) && x.source === s)); return Promise.resolve(); },
  };
}
