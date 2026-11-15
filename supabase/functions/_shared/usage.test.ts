import assert from 'node:assert/strict';
import { HttpError } from './http.ts';
import { assertWithinLimits, estimateCostDkk, limitsFromEnv } from './usage.ts';
import { fakeUsage } from './fakes.ts';

Deno.test('limits default to 50 kr. a month, 60 calls a day and 7 kr. per dollar', () => {
  assert.deepEqual(limitsFromEnv(() => undefined), { monthlyCapDkk: 50, dailyCallsPerPerson: 60, usdToDkk: 7 });
});

Deno.test('limits can be set with secrets; nonsense falls back to the defaults', () => {
  const env: Record<string, string> = { AI_MONTHLY_CAP_DKK: '80', AI_DAILY_CALLS_PER_PERSON: '10.9', AI_USD_DKK: 'abc' };
  assert.deepEqual(limitsFromEnv((k) => env[k]), { monthlyCapDkk: 80, dailyCallsPerPerson: 10, usdToDkk: 7 });
  assert.equal(limitsFromEnv((k) => ({ AI_MONTHLY_CAP_DKK: '-5' })[k]).monthlyCapDkk, 50);
  assert.equal(limitsFromEnv((k) => ({ AI_MONTHLY_CAP_DKK: '0' })[k]).monthlyCapDkk, 50);
});

Deno.test('cost: Haiku 5.5 at $0.10 in and $0.50 out per million tokens', () => {
  // 100K in ($0.01) + 100K out ($0.05) = $0.06 = 0.42 kr.
  assert.equal(estimateCostDkk('claude-haiku-5-5', 100_000, 100_000, 7), 0.42);
  assert.equal(estimateCostDkk('claude-haiku-5-5', 1000, 200, 7), 0.0014);
});

Deno.test('cost: Haiku 5.5 prompts above 100K tokens use the higher rates', () => {
  // 200K in at $0.50 + 10K out at $2.50 = $0.125 = 0.875 kr.
  assert.equal(estimateCostDkk('claude-haiku-5-5', 200_000, 10_000, 7), 0.875);
  assert.equal(estimateCostDkk('claude-haiku-5-5', 100_000, 0, 7), 0.07);
});

Deno.test('cost: other known models, and an unknown model is priced like the dearest', () => {
  assert.equal(estimateCostDkk('claude-sonnet-5-5', 1_000_000, 1_000_000, 7), 84);
  assert.equal(estimateCostDkk('claude-opus-5-5', 1_000_000, 0, 7), 28);
  assert.equal(estimateCostDkk('claude-future-9', 1_000_000, 1_000_000, 7), 420);
  assert.equal(estimateCostDkk('claude-haiku-5-5', 0, 0, 7), 0);
});

const limits = { monthlyCapDkk: 50, dailyCallsPerPerson: 60, usdToDkk: 7 };
const who = { householdId: 'h1', person: 'b' as const };
const code = async (p: Promise<unknown>) => {
  try { await p; return 'ok'; } catch (e) { return e instanceof HttpError ? `${e.status} ${e.code}` : 'other'; }
};

Deno.test('limits: under both limits passes', async () => {
  assert.equal(await code(assertWithinLimits(fakeUsage({ callsToday: 59, monthCostDkk: 49.99 }), who, limits)), 'ok');
});

Deno.test('limits: the sixtieth call of the day is the last; the next is 429', async () => {
  assert.equal(await code(assertWithinLimits(fakeUsage({ callsToday: 60, monthCostDkk: 0 }), who, limits)), '429 rate_limited');
});

Deno.test('limits: at the monthly cap it is 402', async () => {
  assert.equal(await code(assertWithinLimits(fakeUsage({ callsToday: 0, monthCostDkk: 50 }), who, limits)), '402 budget_exceeded');
  assert.equal(await code(assertWithinLimits(fakeUsage({ callsToday: 0, monthCostDkk: 80 }), who, limits)), '402 budget_exceeded');
});
