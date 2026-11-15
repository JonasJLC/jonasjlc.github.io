// The auth check every Strandparken function starts with (design §4.4): verify the JWT, find the caller's
// household membership and person key, validate the input, and call the function body. verify_jwt is off in
// config.toml, so this is the only gate: nothing past `authenticate` runs for an unknown or non-member caller.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { HttpError, cors, json } from './http.ts';
import { z } from './schema.ts';
import type { PersonKey, UsageDb, UsageRow } from './usage.ts';

export interface Caller {
  userId: string;
  householdId: string;
  person: PersonKey;
  isOwner: boolean;
  usage: UsageDb;
}

export interface GuardDeps {
  /** The user id the token belongs to, or null if it is not valid. */
  verify(token: string): Promise<{ userId: string } | null>;
  /** The caller's own `household_members` row, read as the caller so row-level security applies. */
  membership(token: string): Promise<{ householdId: string; person: string | null; isOwner: boolean } | null>;
  usage: UsageDb;
}

/** The real dependencies, built from the variables the platform injects. */
export function defaultDeps(): GuardDeps {
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const asUser = (token: string) =>
    createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const admin = () => createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  return {
    async verify(token) {
      const { data, error } = await asUser(token).auth.getUser(token);
      return error || !data.user ? null : { userId: data.user.id };
    },
    async membership(token) {
      const { data } = await asUser(token).from('household_members').select('household_id, person, is_owner').limit(1).maybeSingle();
      return data ? { householdId: data.household_id, person: data.person, isOwner: data.is_owner } : null;
    },
    usage: {
      async totals(householdId, person) {
        const { data, error } = await admin().rpc('sp_ai_usage_totals', { p_household: householdId, p_person: person });
        if (error) throw new HttpError(500, 'usage_unavailable');
        const row = Array.isArray(data) ? data[0] : data;
        return { callsToday: Number(row?.calls_today ?? 0), monthCostDkk: Number(row?.month_cost_dkk ?? 0) };
      },
      async log(row: UsageRow) {
        const { error } = await admin().from('sp_ai_usage').insert(row);
        // Logging must never hide the result of the call, but the miss must be visible in the function logs.
        if (error) console.error('sp_ai_usage insert failed', error.code);
      },
    },
  };
}

export async function authenticate(req: Request, deps: GuardDeps): Promise<Caller> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'unauthorized');
  const user = await deps.verify(token);
  if (!user) throw new HttpError(401, 'unauthorized');
  const m = await deps.membership(token);
  if (!m) throw new HttpError(403, 'forbidden');
  if (m.person !== 'a' && m.person !== 'b') throw new HttpError(403, 'forbidden');
  return { userId: user.userId, householdId: m.householdId, person: m.person, isOwner: m.isOwner, usage: deps.usage };
}

export interface HandlerOptions<S extends z.ZodType | undefined> {
  /** Function name, used in logs and in `sp_ai_usage`. */
  fn: string;
  /** Request body schema. Omit for functions that take no input. */
  schema?: S;
  run(ctx: { caller: Caller; input: S extends z.ZodType ? z.infer<S> : undefined; req: Request }): Promise<unknown>;
}

/** Method, auth, input validation and error mapping around a function body. `Deno.serve(handler(...))` in index.ts. */
export function handler<S extends z.ZodType | undefined = undefined>(
  opts: HandlerOptions<S>,
  deps?: GuardDeps,
): (req: Request) => Promise<Response> {
  return async (req) => {
    const origin = req.headers.get('Origin');
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'method');
      const caller = await authenticate(req, deps ?? defaultDeps());

      let input: unknown = undefined;
      if (opts.schema) {
        let body: unknown;
        try { body = await req.json(); } catch { throw new HttpError(400, 'bad_request'); }
        const parsed = opts.schema.safeParse(body);
        // Report where the input is wrong, never what it contained.
        if (!parsed.success) {
          throw new HttpError(400, 'bad_request', parsed.error.issues.map((i) => ({ path: i.path.join('.'), code: i.code })));
        }
        input = parsed.data;
      }

      const result = await opts.run({ caller, input: input as never, req });
      return json(result, 200, origin);
    } catch (e) {
      if (e instanceof HttpError) {
        return json(e.detail === undefined ? { error: e.code } : { error: e.code, issues: e.detail }, e.status, origin);
      }
      // Only the error's class goes to the logs: messages can carry page text, prompts or health data.
      console.error(`${opts.fn} failed`, e instanceof Error ? e.name : typeof e);
      return json({ error: 'internal' }, 500, origin);
    }
  };
}
