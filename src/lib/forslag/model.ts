/** Feature requests ("Forslag") shared by /ferie/ and /strandparken/. Pure logic: no browser or Supabase imports. */

export type App = 'ferie' | 'strandparken';
export type RequestStatus = 'new' | 'approved' | 'building' | 'done' | 'declined';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** What the chat produces and the person confirms before it is saved. `area` is one of `areaOptions(app)`. */
export interface Draft {
  title: string;
  summary: string;
  why: string;
  area: string;
  acceptance: string[];
}

export interface FeatureRequest {
  id: string;
  title: string;
  summary: string;
  details: { why?: string; area?: string; acceptance?: string[] };
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

/** State of the mirrored GitHub issue, keyed by issue number. */
export type IssueStates = Record<number, 'done' | 'declined' | 'open'>;

export interface Board {
  householdId: string;
  isOwner: boolean;
  requests: FeatureRequest[];
}

export const STATUS_LABEL: Record<RequestStatus, string> = {
  new: 'Ny',
  approved: 'Godkendt',
  building: 'I gang',
  done: 'Færdig',
  declined: 'Ikke nu',
};

/** The label of the Lister tab (idea 4: Indkøb and To-do). Keep in step with create-issue's area labels. */
export const LISTER_LABEL = 'Lister';

const AREAS: Record<App, readonly (readonly [string, string])[]> = {
  ferie: [
    ['feriedage', 'Feriedage'], ['rejsekassen', 'Rejsekassen'], ['rejseplan', 'Rejseplan'],
    ['indstillinger', 'Indstillinger'], ['andet', 'Andet'],
  ],
  strandparken: [
    ['hjem', 'Hjem'], ['madplan', 'Madplan'], ['lister', LISTER_LABEL], ['sundhed', 'Sundhed'],
    ['opskrifter', 'Opskrifter'], ['indstillinger', 'Indstillinger'], ['andet', 'Andet'],
  ],
};

export const areaOptions = (app: App): readonly (readonly [string, string])[] => AREAS[app];

/** Lookup of area value to Danish label for one app. */
export const areaLabels = (app: App): Record<string, string> => Object.fromEntries(AREAS[app]);

/** An old or odd area value reads as "Andet", so a list never crashes on it. */
export function areaLabel(app: App, area: string | undefined | null): string {
  return (area && areaLabels(app)[area]) || 'Andet';
}

/** The owner's own choice wins; an untouched "Ny" follows the GitHub issue. */
export function effectiveStatus(r: FeatureRequest, issues: IssueStates): RequestStatus {
  if (r.status !== 'new' || r.github_issue_number == null) return r.status;
  const s = issues[r.github_issue_number];
  return s === 'done' || s === 'declined' ? s : r.status;
}

export const OPEN_STATUSES: readonly RequestStatus[] = ['new', 'approved', 'building'];

/** Open requests first; within each group the newest stays on top. Returns a new array. */
export function sortRequests(requests: readonly FeatureRequest[], issues: IssueStates): FeatureRequest[] {
  const open = (r: FeatureRequest) => OPEN_STATUSES.includes(effectiveStatus(r, issues));
  return [...requests].sort(
    (a, b) => Number(open(b)) - Number(open(a)) || Date.parse(b.created_at) - Date.parse(a.created_at),
  );
}
