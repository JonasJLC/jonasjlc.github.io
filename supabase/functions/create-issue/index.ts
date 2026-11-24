// Mirrors a saved feature request (Ferieplan or Strandparken) to a GitHub issue so it can be triaged and built from
// GitHub. The repo is public: only the structured request is published (title, summary, why, area,
// acceptance). The chat transcript, email addresses and surnames never leave the database.
//
// Secret (never commit): supabase secrets set GITHUB_ISSUES_TOKEN=...
//   A fine-grained personal access token limited to this repository with "Issues: read and write".
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { LABEL_DEFS, issueBody, labelsFor, plain, type Row } from './logic.ts';

const REPO = 'JonasJLC/jonasjlc.github.io';
const ALLOWED_ORIGINS = new Set(['https://jonasjlc.github.io', 'http://localhost:4321']);
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

const gh = (path: string, token: string, init: RequestInit = {}) =>
  fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ferieplan-create-issue',
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
  });

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

  let body: { id?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'bad_request' }, 400, origin); }
  if (typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.id)) return json({ error: 'bad_request' }, 400, origin);

  // Read through row-level security as the caller: only a household member can reach the row.
  const { data: row } = await asUser
    .from('feature_requests')
    .select('id,app,title,summary,details,created_by_name,github_issue_number')
    .eq('id', body.id)
    .maybeSingle();
  if (!row) return json({ error: 'not_found' }, 404, origin);
  const r = row as Row;
  // Idempotent: a retry never creates a second issue.
  if (r.github_issue_number) return json({ ok: true, existing: true }, 200, origin);

  const ghToken = Deno.env.get('GITHUB_ISSUES_TOKEN');
  if (!ghToken) return json({ error: 'not_configured' }, 503, origin);

  try {
    // Make sure the issue's labels exist (422 means one already does).
    const labels = labelsFor(r.app);
    for (const label of LABEL_DEFS.filter((d) => labels.includes(d.name))) {
      await gh('/labels', ghToken, { method: 'POST', body: JSON.stringify(label) });
    }
    const res = await gh('/issues', ghToken, {
      method: 'POST',
      body: JSON.stringify({ title: plain(r.title).slice(0, 120), body: issueBody(r), labels }),
    });
    if (!res.ok) return json({ error: 'upstream' }, 502, origin);
    const issue = await res.json();
    if (typeof issue.number !== 'number' || typeof issue.html_url !== 'string') return json({ error: 'upstream' }, 502, origin);

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    // Only fills an empty link, so two racing calls cannot overwrite each other.
    await admin
      .from('feature_requests')
      .update({ github_issue_number: issue.number, github_issue_url: issue.html_url })
      .eq('id', r.id)
      .is('github_issue_number', null);
    return json({ ok: true, number: issue.number }, 200, origin);
  } catch {
    return json({ error: 'upstream' }, 502, origin);
  }
});
