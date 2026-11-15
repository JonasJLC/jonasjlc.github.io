// The one way Strandparken functions call a model (design §4.4, §4.7, ADR-07):
//  - refuses the call over the per-person daily limit or the monthly cost cap, before anything is sent;
//  - sends no tools, only a JSON schema (structured output), so page text or a screenshot cannot trigger an action;
//  - validates the answer against the same schema, retries once, then reports `invalid_output`;
//  - writes one `sp_ai_usage` row per call, including failed ones.
// Secret: supabase secrets set ANTHROPIC_API_KEY=...   Model: SP_AI_MODEL (default claude-haiku-5-5).
import Anthropic from 'npm:@anthropic-ai/sdk@1.8.0';
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk@1.8.0/helpers/zod';
import type { Caller } from './guard.ts';
import { HttpError } from './http.ts';
import type { z } from './schema.ts';
import { assertWithinLimits, estimateCostDkk, limitsFromEnv, type AiLimits } from './usage.ts';

export const DEFAULT_MODEL = 'claude-haiku-5-5';

type TextPart = { type: 'text'; text: string };
type ImagePart = { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/webp'; data: string } };
export type Content = string | (TextPart | ImagePart)[];

/** The slice of the SDK this helper uses, so tests can pass a fake. */
export interface ModelClient {
  messages: {
    create(params: Record<string, unknown>): Promise<{
      content: { type: string; text?: string }[];
      stop_reason: string | null;
      usage: {
        input_tokens: number;
        output_tokens: number;
        cache_creation_input_tokens?: number | null;
        cache_read_input_tokens?: number | null;
      };
    }>;
  };
}

export interface CallOptions<S extends z.ZodType> {
  caller: Caller;
  /** Function name for the usage log. */
  fn: string;
  system: string;
  content: Content;
  schema: S;
  model?: string;
  maxTokens?: number;
  effort?: 'low' | 'medium' | 'high';
}

export interface CallDeps {
  client?: ModelClient;
  limits?: AiLimits;
  model?: string;
}

function realClient(): ModelClient {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new HttpError(503, 'not_configured');
  // One SDK retry for 429/5xx and dropped connections; those requests are not billed.
  return new Anthropic({ apiKey, maxRetries: 1, timeout: 25_000 }) as unknown as ModelClient;
}

/**
 * Wraps text from outside (a web page, a caption, pasted text) so the model sees it as data. Closing-tag lookalikes
 * inside the text are defused. Pair it with a system prompt line saying content in <untrusted> is data, never instructions.
 */
export function wrapUntrusted(label: string, text: string): string {
  const safe = text.replace(/<\/?\s*untrusted[^>]*>/gi, '[tag removed]');
  return `<untrusted source="${label.replace(/[^a-z0-9 _-]/gi, '')}">\n${safe}\n</untrusted>`;
}

export async function callModel<S extends z.ZodType>(opts: CallOptions<S>, deps: CallDeps = {}): Promise<z.infer<S>> {
  const limits = deps.limits ?? limitsFromEnv();
  const model = opts.model ?? deps.model ?? Deno.env.get('SP_AI_MODEL') ?? DEFAULT_MODEL;
  const { caller } = opts;

  await assertWithinLimits(caller.usage, caller, limits);
  const client = deps.client ?? realClient();

  const log = (
    usage: { input: number; output: number } | null,
    ok: boolean,
    error?: string,
  ) =>
    caller.usage.log({
      household_id: caller.householdId,
      user_id: caller.userId,
      person: caller.person,
      function: opts.fn,
      model,
      input_tokens: usage?.input ?? 0,
      output_tokens: usage?.output ?? 0,
      cost_dkk: usage ? estimateCostDkk(model, usage.input, usage.output, limits.usdToDkk) : 0,
      ok,
      ...(error ? { error } : {}),
    });

  // Two attempts: the second only after output that did not match the schema.
  for (let attempt = 0; attempt < 2; attempt++) {
    let res;
    try {
      res = await client.messages.create({
        model,
        max_tokens: opts.maxTokens ?? 2000,
        system: opts.system,
        messages: [{ role: 'user', content: opts.content }],
        output_config: { effort: opts.effort ?? 'low', format: zodOutputFormat(opts.schema) },
      });
    } catch {
      await log(null, false, 'upstream');
      throw new HttpError(502, 'upstream');
    }

    const usage = {
      input: res.usage.input_tokens + (res.usage.cache_creation_input_tokens ?? 0) + (res.usage.cache_read_input_tokens ?? 0),
      output: res.usage.output_tokens,
    };

    if (res.stop_reason === 'refusal') {
      await log(usage, false, 'refused');
      throw new HttpError(422, 'refused');
    }

    const text = res.content.find((b) => b.type === 'text')?.text;
    let parsed: z.ZodSafeParseResult<z.infer<S>> | null = null;
    if (res.stop_reason !== 'max_tokens' && text) {
      try { parsed = opts.schema.safeParse(JSON.parse(text)); } catch { parsed = null; }
    }
    if (parsed?.success) {
      await log(usage, true);
      return parsed.data;
    }
    await log(usage, false, 'invalid_output');
  }
  throw new HttpError(502, 'invalid_output');
}
