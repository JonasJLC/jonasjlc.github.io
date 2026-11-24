import { handler } from '../_shared/guard.ts';
import { json } from '../_shared/http.ts';
import { runtime } from '../_shared/health/runtime.ts';
import { sameSecret } from '../_shared/health/tokens.ts';
import { AllInput, SelfInput, syncAll, syncPerson } from './logic.ts';

const log = (outcome: string, started: number, counts: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ fn: 'health-sync', outcome, ms: Date.now() - started, ...counts }));

// Signed-in members: mode `self` through the shared guard.
const self = handler({
  fn: 'health-sync',
  schema: SelfInput,
  run: async ({ caller, input }) => {
    const started = Date.now();
    const rt = runtime();
    const counts = await syncPerson({ db: rt.db, sources: rt.sources, now: Date.now }, caller, { force: input.force });
    log('self', started, counts);
    return counts;
  },
});

// pg_cron: mode `all`, with `Authorization: Bearer <SP_CRON_SECRET>` (the same value is kept in Vault for the job).
async function cron(req: Request): Promise<Response> {
  const started = Date.now();
  const parsed = AllInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'bad_request' }, 400, null);
  try {
    const rt = runtime();
    const counts = await syncAll({ db: rt.db, sources: rt.sources, now: Date.now }, { hours: parsed.data.hours });
    log('all', started, counts);
    return json(counts, 200, null);
  } catch (e) {
    console.error('health-sync failed', e instanceof Error ? e.name : typeof e);
    return json({ error: 'internal' }, 500, null);
  }
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('SP_CRON_SECRET') ?? '';
  const bearer = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (req.method === 'POST' && secret.length >= 32 && (await sameSecret(bearer, secret))) return cron(req);
  return self(req);
});
