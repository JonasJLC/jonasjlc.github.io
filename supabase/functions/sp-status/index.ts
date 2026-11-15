// Strandparken status: who the caller is in the household and where the AI budget stands. No model call, no input.
// It is also the smallest function that exercises the shared guard, so it doubles as the deployment smoke test.
import { handler } from '../_shared/guard.ts';
import { limitsFromEnv } from '../_shared/usage.ts';

Deno.serve(
  handler({
    fn: 'sp-status',
    async run({ caller }) {
      const limits = limitsFromEnv();
      const t = await caller.usage.totals(caller.householdId, caller.person);
      return {
        person: caller.person,
        isOwner: caller.isOwner,
        ai: {
          monthSpentDkk: Math.round(t.monthCostDkk * 100) / 100,
          monthlyCapDkk: limits.monthlyCapDkk,
          callsToday: t.callsToday,
          dailyCallsPerPerson: limits.dailyCallsPerPerson,
        },
      };
    },
  }),
);
