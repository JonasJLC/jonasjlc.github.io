// Calendar on Hjem (Idé 7). The sealed addresses live in private.sp_calendar_feeds, which only the service-role
// functions in the 20261124 calendar migration can reach. Secret (never committed):
//   supabase secrets set SP_FEED_KEY=$(openssl rand -base64 32)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { feedKey } from '../_shared/crypto.ts';
import { handler } from '../_shared/guard.ts';
import { HttpError } from '../_shared/http.ts';
import { addCalendar, calendarEvents, Input, type CalendarDb, type FeedRow, type SourceRow } from './logic.ts';

function db(): CalendarDb {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  return {
    async add(r) {
      const { data, error } = await admin.rpc('sp_calendar_add', {
        p_household: r.householdId, p_person: r.person, p_user: r.userId, p_label: r.label, p_color: r.color, p_shared: r.shared, p_cipher: r.cipher,
      });
      if (error) throw new HttpError(error.message.includes('too_many') ? 422 : 500, error.message.includes('too_many') ? 'too_many' : 'save_failed');
      return (Array.isArray(data) ? data[0] : data) as SourceRow;
    },
    async feeds(householdId, person) {
      const { data, error } = await admin.rpc('sp_calendar_feeds_for', { p_household: householdId, p_person: person });
      if (error) throw new HttpError(500, 'load_failed');
      return (data ?? []) as FeedRow[];
    },
    async saveCache(sourceId, write) {
      const { error } = await admin.rpc('sp_calendar_save_cache', 'events' in write
        ? { p_source: sourceId, p_events: write.events, p_for: write.forDate, p_error: null }
        : { p_source: sourceId, p_events: null, p_for: null, p_error: write.error });
      if (error) console.error('calendar cache write failed', error.code);
    },
  };
}

Deno.serve(handler({
  fn: 'calendar',
  schema: Input,
  async run({ caller, input }) {
    const started = Date.now();
    let outcome = 'ok';
    try {
      const deps = { db: db(), key: feedKey };
      if (input.action === 'add') return await addCalendar(caller, input, deps);
      const result = await calendarEvents(caller, deps);
      outcome = `ok sources=${result.sources.length} stale=${result.sources.filter((s) => s.stale).length}`;
      return result;
    } catch (e) {
      outcome = e instanceof HttpError ? e.code : 'error';
      throw e;
    } finally {
      console.log(`calendar ${input.action} ${outcome} ${Date.now() - started}ms`);
    }
  },
}));
