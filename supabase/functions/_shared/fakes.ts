// Test doubles shared by the Deno tests. Not imported by any function.
import type { Caller, GuardDeps } from './guard.ts';
import type { ModelClient } from './anthropic.ts';
import type { UsageDb, UsageRow } from './usage.ts';

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
