// Forslag chat for Ferieplan and Strandparken. A household member describes a wish; the model either asks one
// short follow-up question or returns a structured request. Nothing is saved here: the browser
// saves the structured request (row-level security applies) after the person confirms it.
//
// Secrets (never commit): supabase secrets set ANTHROPIC_API_KEY=...
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { MAX_FOLLOWUPS, parseApp, shapeReply, systemFor, toolsFor, validMessages } from './logic.ts';

const MODEL = Deno.env.get('FEATURE_CHAT_MODEL') ?? 'claude-haiku-5-5';
const ALLOWED_ORIGINS = new Set(['https://jonasjlc.github.io', 'http://localhost:4321']);
const LIMIT_PER_HOUR = 40;
const LIMIT_PER_DAY = 150;

function cors(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://jonasjlc.github.io';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== 'POST') return json({ error: 'method' }, 405, origin);

  // JWT is verified here (verify_jwt is off in config.toml, see the note there).
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401, origin);

  const url = Deno.env.get('SUPABASE_URL')!;
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: u, error: uerr } = await asUser.auth.getUser(token);
  if (uerr || !u.user) return json({ error: 'unauthorized' }, 401, origin);

  // Members only: this read goes through row-level security as the caller.
  const { data: member } = await asUser.from('household_members').select('household_id').limit(1).maybeSingle();
  if (!member) return json({ error: 'forbidden' }, 403, origin);

  let body: { messages?: unknown; app?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'bad_request' }, 400, origin); }
  if (!validMessages(body.messages)) return json({ error: 'bad_request' }, 400, origin);
  const messages = body.messages;
  // Missing means ferie (a cached /ferie/ page); an unknown value is rejected.
  const app = parseApp(body.app);
  if (!app) return json({ error: 'bad_request' }, 400, origin);

  // Rate limit per user, counted in a table only the service role can reach.
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const since = (ms: number) => new Date(Date.now() - ms).toISOString();
  const [hour, day] = await Promise.all([
    admin.from('feature_chat_calls').select('id', { count: 'exact', head: true }).eq('user_id', u.user.id).gte('called_at', since(3_600_000)),
    admin.from('feature_chat_calls').select('id', { count: 'exact', head: true }).eq('user_id', u.user.id).gte('called_at', since(86_400_000)),
  ]);
  if ((hour.count ?? 0) >= LIMIT_PER_HOUR || (day.count ?? 0) >= LIMIT_PER_DAY) {
    return json({ error: 'rate_limited' }, 429, origin);
  }
  await admin.from('feature_chat_calls').insert({ user_id: u.user.id });

  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) return json({ error: 'not_configured' }, 503, origin);

  const followups = messages.filter((m) => m.role === 'assistant').length;
  const mustSubmit = followups >= MAX_FOLLOWUPS;

  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        system: systemFor(app),
        tools: toolsFor(app),
        tool_choice: mustSubmit ? { type: 'tool', name: 'submit_request' } : { type: 'any' },
        messages,
      }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    return json({ error: 'upstream' }, 502, origin);
  }
  if (!res.ok) return json({ error: 'upstream' }, 502, origin);

  const out = await res.json();
  const call = (out.content ?? []).find((b: { type: string }) => b.type === 'tool_use');
  if (!call) return json({ error: 'upstream' }, 502, origin);

  const reply = shapeReply(app, call);
  if (!reply) return json({ error: 'upstream' }, 502, origin);
  return json(reply, 200, origin);
});
