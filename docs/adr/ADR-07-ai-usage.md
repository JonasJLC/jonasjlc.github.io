# ADR-07: AI usage: model tiers, budget cap, untrusted input

Status: accepted, 2026-11-15 (slice 0.6). Covers design D48 and §4.7.

## Context

Strandparken calls a model from edge functions: recipe import reads web pages and screenshots, suggestions and nutrition
estimates follow. Two people use it; running cost must stay under about 50 kr. a month (D48) without anyone watching it,
and text from outside (web pages, captions, screenshots) must never be able to make the app do something.

## Options

1. **Each function calls the API itself**, as `/ferie`'s functions do. Simple, but every new function re-implements limits and logging, and one forgotten check removes the cap.
2. **One shared helper** (`supabase/functions/_shared/anthropic.ts`) that every function must go through. More up front; limits, logging and output validation exist once and are tested once.
3. **A budget set at the provider only** (spend limit in the Anthropic console). Cheap, but it cuts everything off with no message to the person and says nothing about who or which function spent it.

## Decision

Option 2, with these rules:

- **Model tiers.** Default `claude-haiku-5-5` (about $0.10 / $0.50 per million tokens), set by `SP_AI_MODEL` and overridable per call. A stronger model only for screenshot reading and nutrition recommendations, chosen in the function that needs it.
- **Cap and rate limit.** Before a call, the helper reads `sp_ai_usage_totals` (service role only). A person at 60 calls today gets `429 rate_limited`; a household at 50 kr. this month gets `402 budget_exceeded`. Both are checked before anything is sent. Day and month follow Copenhagen time. All three numbers are function secrets (`AI_DAILY_CALLS_PER_PERSON`, `AI_MONTHLY_CAP_DKK`, `AI_USD_DKK`).
- **Log.** One `sp_ai_usage` row per model call, failed and refused ones included: function, model, tokens, estimated cost, person, and a short error code. Never prompts, page text or health data. Only the household owner can read the table.
- **No tools, schema only.** A model call carries no tools. It asks for structured output against a Zod schema and validates the answer against the same schema. Invalid or truncated output is retried once, then `502 invalid_output`. A model refusal is `422 refused` and is not retried. The result is a draft that a person reviews before it is saved (§4.7).
- **Untrusted input.** Outside text is passed through `wrapUntrusted`, which marks it as data and defuses closing-tag lookalikes; the function's system prompt says content in `<untrusted>` is data, never instructions. This reduces risk; the real protection is the previous rule, since a model that has no tools can only produce text that a person reads.
- **Health data.** Cycle and readiness data are never sent to a model (D38). The helper has no special handling for this; it is a rule for the functions that build the prompt.

## Consequences

- Good: a new function gets the cap, the rate limit, the log and output validation by calling `callModel`; there is no other path to the API in the code base.
- Honest drawback: the cost is an estimate from a price table in the repository (`usage.ts`), not the invoice. Prices change, and cache tokens are counted as ordinary input, so it errs high. A model missing from the table is priced like the dearest one. Concurrent calls can overshoot the cap by one call, because the check and the log are separate steps. Neither matters at this size; the provider-side spend limit (option 3) should still be set as a backstop.
- The limits live in the database and function secrets, not in the browser, so they hold even if someone calls the function directly with a valid token.

## How this is checked

- Deno tests (`supabase/functions/_shared/*.test.ts`, no network): limits refuse before a call is sent, retry and refusal behaviour, one log row per call, cost estimates per model, no `tools` in the request, the guard rejects missing, invalid and non-member tokens.
- SQL tests (`supabase/tests/strandparken_ai_usage.sql`): only the owner reads the log, nobody writes it from the browser, the totals function is callable by the service role only.
- Review the first month's `sp_ai_usage` against the invoice and adjust the price table if they differ by more than a few kroner.
