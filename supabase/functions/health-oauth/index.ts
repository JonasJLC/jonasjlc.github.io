import { handler } from '../_shared/guard.ts';
import { runtime } from '../_shared/health/runtime.ts';
import { derivedKey } from '../_shared/health/tokens.ts';
import { callback, Input, run, type OAuthDeps } from './logic.ts';

function deps(): OAuthDeps {
  const rt = runtime();
  return {
    db: rt.db,
    oura: rt.oura,
    garmin: rt.garmin,
    stateKey: () => derivedKey(Deno.env.get('SP_OAUTH_STATE_KEY')),
    redirectUri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/health-oauth`,
    now: Date.now,
  };
}

const actions = handler({
  fn: 'health-oauth',
  schema: Input,
  run: ({ caller, input, req }) => run(deps(), caller, input, req.headers.get('Origin')),
});

// GET is Oura's redirect back (the registered redirect URI is this function's URL); everything else is an app action.
Deno.serve(async (req) => {
  if (req.method === 'GET') {
    const started = Date.now();
    const res = await callback(deps(), new URL(req.url));
    const location = res.headers.get('Location') ?? '';
    console.log(JSON.stringify({ fn: 'health-oauth', outcome: location.includes('forbundet=') ? 'connected' : 'callback_failed', ms: Date.now() - started }));
    return res;
  }
  return actions(req);
});
