// Pure logic for create-issue: the issue text and labels per app. No network or Deno APIs (see logic.test.ts).
// The repo is public: only the structured request is published (title, summary, why, area, acceptance).

export type App = 'ferie' | 'strandparken';

export interface Row {
  id: string;
  app?: string | null;
  title: string;
  summary: string;
  details: { why?: string; area?: string; acceptance?: string[] } | null;
  created_by_name: string;
  github_issue_number: number | null;
}

const AREA_LABEL: Record<App, Record<string, string>> = {
  ferie: {
    feriedage: 'Feriedage',
    rejsekassen: 'Rejsekassen',
    rejseplan: 'Rejseplan',
    indstillinger: 'Indstillinger',
    andet: 'Andet',
  },
  strandparken: {
    hjem: 'Hjem',
    madplan: 'Madplan',
    lister: 'Lister', // keep in step with LISTER_LABEL in src/lib/forslag/model.ts
    sundhed: 'Sundhed',
    opskrifter: 'Opskrifter',
    indstillinger: 'Indstillinger',
    andet: 'Andet',
  },
};

/** The row's app comes from the database, not the request body. Missing or unknown means ferie. */
const appOf = (v: unknown): App => (v === 'strandparken' ? 'strandparken' : 'ferie');

/** Labels the issue carries. `forslag` alone for Ferieplan, exactly as before. */
export function labelsFor(app: unknown): string[] {
  return appOf(app) === 'strandparken' ? ['forslag', 'strandparken'] : ['forslag'];
}

/** Labels to create before the first issue (a 422 from GitHub means one already exists). */
export const LABEL_DEFS = [
  { name: 'forslag', color: 'c2410c', description: 'Wish from the Ferieplan Forslag chat' },
  { name: 'strandparken', color: '2f6f73', description: 'Wish from the Strandparken Forslag chat' },
];

/** Text is typed by a person and published on a public repo: stop @mentions from pinging anyone. */
export const plain = (s: string) => s.replace(/@/g, '@​').replace(/\r/g, '').trim();

/** First name only, and never an email address. */
export function firstName(name: string): string {
  if (!name || name.includes('@')) return '';
  return name.trim().split(/\s+/)[0] ?? '';
}

export function issueBody(r: Row): string {
  const app = appOf(r.app);
  const d = r.details ?? {};
  const who = firstName(r.created_by_name);
  const intro = app === 'strandparken'
    ? `Forslag til Strandparken${who ? ` fra ${plain(who)}` : ''}, indsamlet via Forslag i appen.`
    : `Forslag til Ferieplan${who ? ` fra ${plain(who)}` : ''}, indsamlet via Forslag-chatten i appen.`;
  const lines = [intro, '', '## Ønske', plain(r.summary)];
  if (d.why) lines.push('', '## Hvorfor', plain(d.why));
  const area = d.area ? AREA_LABEL[app][d.area] : undefined;
  if (area) lines.push('', '## Område', area);
  const acceptance = (d.acceptance ?? []).filter((a) => typeof a === 'string' && a.trim());
  if (acceptance.length) lines.push('', '## Sådan ser man, at det virker', ...acceptance.map((a) => `- ${plain(a)}`));
  lines.push('', '---', '_Oprettet automatisk. Bygges fra GitHub efter triage; appens Forslag-liste linker hertil._');
  return lines.join('\n');
}
