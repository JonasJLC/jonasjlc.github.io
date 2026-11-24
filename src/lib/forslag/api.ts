import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '../supabase/database.types';
import type { App, Board, ChatMessage, ChatReply, Draft, FeatureRequest, IssueStates, RequestStatus } from './model';

const COLUMNS = 'id,title,summary,details,status,owner_note,created_by_name,created_at,github_issue_number,github_issue_url';
const ISSUES_URL = 'https://api.github.com/repos/JonasJLC/jonasjlc.github.io/issues';

/** `/ferie/` keeps its original filter (`forslag`); Strandparken asks for both labels (GitHub treats a comma list as AND). */
const issueLabels = (app: App) => (app === 'ferie' ? 'forslag' : 'forslag,strandparken');

/** The Forslag backend calls for one app. The client getter is passed in so each app keeps its own sign-in wiring. */
export function createForslagApi(getClient: () => Promise<SupabaseClient<Database>>, app: App) {
  /** Danish, user-facing message for a failed chat call. */
  async function askChat(messages: ChatMessage[]): Promise<ChatReply> {
    const c = await getClient();
    const { data, error } = await c.functions.invoke('feature-chat', { body: { messages, app } });
    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status;
      if (status === 429) throw new Error('Du har spurgt mange gange på kort tid. Prøv igen om lidt.');
      if (status === 503) throw new Error('Chatten er ikke sat op endnu.');
      throw new Error('Chatten svarer ikke lige nu. Prøv igen om lidt.');
    }
    if (!data || (data.type !== 'question' && data.type !== 'request')) {
      throw new Error('Chatten gav et svar, jeg ikke kunne bruge. Prøv igen.');
    }
    return data as ChatReply;
  }

  /**
   * Reads the public issue list (one unauthenticated call) so a request whose issue has been closed
   * stops saying "Ny". Best effort: on any failure the stored statuses are shown as they are.
   */
  async function loadIssueStates(): Promise<IssueStates> {
    try {
      const res = await fetch(`${ISSUES_URL}?labels=${issueLabels(app)}&state=all&per_page=100`, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return {};
      const issues = (await res.json()) as { number: number; state: string; state_reason?: string | null; pull_request?: unknown }[];
      const out: IssueStates = {};
      for (const i of issues) {
        if (i.pull_request) continue;
        out[i.number] = i.state === 'closed' ? (i.state_reason === 'not_planned' ? 'declined' : 'done') : 'open';
      }
      return out;
    } catch {
      return {};
    }
  }

  async function loadBoard(): Promise<Board | null> {
    const c = await getClient();
    const m = await c.from('household_members').select('household_id,is_owner').limit(1).maybeSingle();
    if (m.error) throw m.error;
    if (!m.data) return null;
    const r = await c.from('feature_requests').select(COLUMNS).eq('app', app).order('created_at', { ascending: false }).limit(200);
    if (r.error) throw r.error;
    return {
      householdId: m.data.household_id as string,
      isOwner: Boolean(m.data.is_owner),
      requests: (r.data ?? []) as unknown as FeatureRequest[],
    };
  }

  /** Saves the request, then mirrors it to a GitHub issue. The issue is best effort: the request is kept either way. */
  async function saveRequest(householdId: string, draft: Draft, transcript: ChatMessage[]): Promise<void> {
    const c = await getClient();
    const { data, error } = await c.from('feature_requests').insert({
      household_id: householdId,
      app,
      title: draft.title,
      summary: draft.summary,
      details: { why: draft.why, area: draft.area, acceptance: draft.acceptance },
      transcript: transcript as unknown as Json,
    }).select('id').single();
    if (error) throw error;
    try {
      await c.functions.invoke('create-issue', { body: { id: data.id } });
    } catch { /* the request is saved; the issue can be created later */ }
  }

  async function triage(id: string, patch: { status?: RequestStatus; owner_note?: string | null }): Promise<void> {
    const c = await getClient();
    const { data, error } = await c.from('feature_requests').update(patch).eq('id', id).select('id');
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Kun ejeren kan ændre status.');
  }

  /** Realtime allows one filter (the household), so every change reloads the list. */
  async function subscribeRequests(householdId: string, onChange: () => void): Promise<() => void> {
    const c = await getClient();
    const channel = c
      .channel(`forslag:${app}:${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'feature_requests', filter: `household_id=eq.${householdId}` },
        onChange,
      )
      .subscribe();
    return () => {
      void c.removeChannel(channel);
    };
  }

  return { askChat, loadIssueStates, loadBoard, saveRequest, triage, subscribeRequests };
}
