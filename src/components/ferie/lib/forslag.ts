import { getClient } from './remote';

export type RequestStatus = 'new' | 'approved' | 'building' | 'done' | 'declined';
export type RequestArea = 'feriedage' | 'rejsekassen' | 'rejseplan' | 'indstillinger' | 'andet';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** What the chat produces and the person confirms before it is saved. */
export interface Draft {
  title: string;
  summary: string;
  why: string;
  area: RequestArea;
  acceptance: string[];
}

export interface FeatureRequest {
  id: string;
  title: string;
  summary: string;
  details: { why?: string; area?: RequestArea; acceptance?: string[] };
  status: RequestStatus;
  owner_note: string | null;
  created_by_name: string;
  created_at: string;
  github_issue_number: number | null;
  github_issue_url: string | null;
}

export type ChatReply =
  | { type: 'question'; text: string }
  | { type: 'request'; message: string; request: Draft };

export const STATUS_LABEL: Record<RequestStatus, string> = {
  new: 'Ny',
  approved: 'Godkendt',
  building: 'I gang',
  done: 'Færdig',
  declined: 'Ikke nu',
};

export const AREA_LABEL: Record<RequestArea, string> = {
  feriedage: 'Feriedage',
  rejsekassen: 'Rejsekassen',
  rejseplan: 'Rejseplan',
  indstillinger: 'Indstillinger',
  andet: 'Andet',
};

/** Danish, user-facing message for a failed chat call. */
export async function askChat(messages: ChatMessage[]): Promise<ChatReply> {
  const c = await getClient();
  const { data, error } = await c.functions.invoke('feature-chat', { body: { messages } });
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

/** State of the mirrored GitHub issue, keyed by issue number. */
export type IssueStates = Record<number, 'done' | 'declined' | 'open'>;

/**
 * Reads the public issue list (one unauthenticated call) so a request whose issue has been closed
 * stops saying "Ny". Best effort: on any failure the stored statuses are shown as they are.
 */
export async function loadIssueStates(): Promise<IssueStates> {
  try {
    const res = await fetch(
      'https://api.github.com/repos/JonasJLC/jonasjlc.github.io/issues?labels=forslag&state=all&per_page=100',
      { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(8000) },
    );
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

/** The owner's own choice wins; an untouched "Ny" follows the GitHub issue. */
export function effectiveStatus(r: FeatureRequest, issues: IssueStates): RequestStatus {
  if (r.status !== 'new' || r.github_issue_number == null) return r.status;
  const s = issues[r.github_issue_number];
  return s === 'done' || s === 'declined' ? s : r.status;
}

export interface Board {
  householdId: string;
  isOwner: boolean;
  requests: FeatureRequest[];
}

const COLUMNS = 'id,title,summary,details,status,owner_note,created_by_name,created_at,github_issue_number,github_issue_url';

export async function loadBoard(): Promise<Board | null> {
  const c = await getClient();
  const m = await c.from('household_members').select('household_id,is_owner').limit(1).maybeSingle();
  if (m.error) throw m.error;
  if (!m.data) return null;
  const r = await c.from('feature_requests').select(COLUMNS).order('created_at', { ascending: false }).limit(200);
  if (r.error) throw r.error;
  return {
    householdId: m.data.household_id as string,
    isOwner: Boolean(m.data.is_owner),
    requests: (r.data ?? []) as FeatureRequest[],
  };
}

/** Saves the request, then mirrors it to a GitHub issue. The issue is best effort: the request is kept either way. */
export async function saveRequest(householdId: string, draft: Draft, transcript: ChatMessage[]): Promise<void> {
  const c = await getClient();
  const { data, error } = await c.from('feature_requests').insert({
    household_id: householdId,
    title: draft.title,
    summary: draft.summary,
    details: { why: draft.why, area: draft.area, acceptance: draft.acceptance },
    transcript,
  }).select('id').single();
  if (error) throw error;
  try {
    await c.functions.invoke('create-issue', { body: { id: data.id } });
  } catch { /* the request is saved; the issue can be created later */ }
}

export async function triage(id: string, patch: { status?: RequestStatus; owner_note?: string | null }): Promise<void> {
  const c = await getClient();
  const { data, error } = await c.from('feature_requests').update(patch).eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Kun ejeren kan ændre status.');
}

export async function subscribeRequests(householdId: string, onChange: () => void): Promise<() => void> {
  const c = await getClient();
  const channel = c
    .channel(`forslag:${householdId}`)
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
