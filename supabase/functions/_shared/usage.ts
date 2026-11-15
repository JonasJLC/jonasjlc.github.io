// AI usage: the price table, the per-person daily rate limit and the monthly cost cap (design D48, §4.5, ADR-07).
// Every model call writes one `sp_ai_usage` row; the same rows are what the limits count.
import { HttpError } from './http.ts';

export type PersonKey = 'a' | 'b';

export interface UsageRow {
  household_id: string;
  user_id: string;
  person: PersonKey;
  function: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_dkk: number;
  ok: boolean;
  /** A short code such as `invalid_output`. Never prompts, page text or health data. */
  error?: string;
}

/** What the helper needs from the database. The real one is in guard.ts; tests pass a fake. */
export interface UsageDb {
  totals(householdId: string, person: PersonKey): Promise<{ callsToday: number; monthCostDkk: number }>;
  log(row: UsageRow): Promise<void>;
}

export interface AiLimits {
  monthlyCapDkk: number;
  dailyCallsPerPerson: number;
  usdToDkk: number;
}

const num = (raw: string | undefined, fallback: number) => {
  const n = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Defaults: 50 kr. a month (D48), 60 model calls per person per day, 7 kr. per dollar. Override with function secrets. */
export function limitsFromEnv(get: (key: string) => string | undefined = (k) => Deno.env.get(k)): AiLimits {
  return {
    monthlyCapDkk: num(get('AI_MONTHLY_CAP_DKK'), 50),
    dailyCallsPerPerson: Math.floor(num(get('AI_DAILY_CALLS_PER_PERSON'), 60)),
    usdToDkk: num(get('AI_USD_DKK'), 7),
  };
}

interface Price {
  /** US dollars per million tokens. */
  input: number;
  output: number;
  /** Haiku 5.5 charges more for prompts above 100K tokens. */
  long?: { above: number; input: number; output: number };
}

// First-party API prices (cached 2026-11-03 in the claude-api skill). Estimates only: check the live pricing page.
const PRICES: Record<string, Price> = {
  'claude-haiku-5-5': { input: 0.1, output: 0.5, long: { above: 100_000, input: 0.5, output: 2.5 } },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-fable-5-2': { input: 8, output: 40 },
};
/** A model missing from the table is priced like the dearest one, so the cap errs on the safe side. */
const FALLBACK: Price = { input: 10, output: 50 };

/** An upper bound: cache reads and writes are counted as ordinary input tokens by the caller. */
export function estimateCostDkk(model: string, inputTokens: number, outputTokens: number, usdToDkk: number): number {
  const p = PRICES[model] ?? FALLBACK;
  const tier = p.long && inputTokens > p.long.above ? p.long : p;
  const usd = (inputTokens * tier.input + outputTokens * tier.output) / 1_000_000;
  return Math.round(usd * usdToDkk * 10_000) / 10_000;
}

/** Refuses a model call over the daily limit (429) or after the month's cap is reached (402), before anything is sent. */
export async function assertWithinLimits(
  usage: UsageDb,
  caller: { householdId: string; person: PersonKey },
  limits: AiLimits,
): Promise<void> {
  const t = await usage.totals(caller.householdId, caller.person);
  if (t.callsToday >= limits.dailyCallsPerPerson) throw new HttpError(429, 'rate_limited');
  if (t.monthCostDkk >= limits.monthlyCapDkk) throw new HttpError(402, 'budget_exceeded');
}
