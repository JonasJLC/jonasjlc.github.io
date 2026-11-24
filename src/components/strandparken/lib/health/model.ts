// Health data in the app (idea 10). The database decides what may be seen (`sp_health_for`): a metric the owner has not
// shared arrives as null and is listed in `hidden`. Here hidden metrics are dropped from the view model (the key is absent),
// while null stays null and means "no data", so the UI can say "Ingen data i nat" instead of hiding the tile.
import type { Database } from '../../../../lib/supabase/database.types.ts';
import { personFromKey, type Person } from '../people.ts';

export type Metric = 'sleep_score' | 'activity' | 'steps' | 'cycle_day';
export const METRICS: readonly Metric[] = ['sleep_score', 'activity', 'steps', 'cycle_day'];
export type SourceId = 'oura' | 'garmin' | 'manual';
export type ProviderId = Exclude<SourceId, 'manual'>;
export const PROVIDERS: readonly ProviderId[] = ['oura', 'garmin'];

export type HealthRow = Database['public']['Functions']['sp_health_for']['Returns'][number];
export type SourceRow = Database['public']['Functions']['sp_health_sources']['Returns'][number];

export const sourceNames: Record<SourceId, string> = { oura: 'Oura', garmin: 'Garmin', manual: 'Strandparken' };

/** The Danish label of each metric, for switches and cards. */
export const metricLabels: Record<Metric, string> = { sleep_score: 'Søvn', activity: 'Aktivitet', steps: 'Skridt', cycle_day: 'Min cyklus' };

/** Which source wins when two have a value for the same metric: vendor APIs first, the period log last. */
export const DEFAULT_PRIORITY: readonly SourceId[] = ['oura', 'garmin', 'manual'];

export type ActivityValue = { progress: number; goal: number | null; unit: 'steps' | 'kcal' | 'score' | null };

/** One day. A missing key is hidden by the owner; null is no data. */
export interface DayView {
  date: string;
  sleep_score?: number | null;
  activity?: ActivityValue | null;
  steps?: number | null;
  cycle_day?: number | null;
  /** Where each shown value came from. */
  sources: Partial<Record<Metric, SourceId>>;
}

export interface HealthView {
  days: DayView[];
  hidden: Metric[];
}

const isSource = (s: unknown): s is SourceId => s === 'oura' || s === 'garmin' || s === 'manual';
const isMetric = (m: unknown): m is Metric => (METRICS as readonly unknown[]).includes(m);
const unit = (u: string | null): ActivityValue['unit'] => (u === 'steps' || u === 'kcal' || u === 'score' ? u : null);

/** Rows from `sp_health_for` (one per day and source) → one view per day, each metric from the first source with a value. */
export function toHealthView(rows: readonly HealthRow[], priority: readonly SourceId[] = DEFAULT_PRIORITY): HealthView {
  const hidden = METRICS.filter((m) => rows.some((r) => (r.hidden ?? []).includes(m)));
  const rank = (s: SourceId) => { const i = priority.indexOf(s); return i < 0 ? priority.length : i; };
  const byDate = new Map<string, HealthRow[]>();
  for (const r of rows) {
    if (!isSource(r.source)) continue;
    byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);
  }
  const days = [...byDate.keys()].sort().map((date) => {
    const rs = byDate.get(date)!.slice().sort((a, b) => rank(a.source as SourceId) - rank(b.source as SourceId));
    const view: DayView = { date, sources: {} };
    const first = <T>(metric: Metric, get: (r: HealthRow) => T | null): T | null => {
      for (const r of rs) {
        const v = get(r);
        if (v !== null && v !== undefined) {
          view.sources[metric] = r.source as SourceId;
          return v;
        }
      }
      return null;
    };
    if (!hidden.includes('sleep_score')) view.sleep_score = first('sleep_score', (r) => r.sleep_score);
    if (!hidden.includes('activity')) {
      view.activity = first('activity', (r) =>
        r.activity_progress === null ? null : { progress: Number(r.activity_progress), goal: r.activity_goal, unit: unit(r.activity_goal_unit) });
    }
    if (!hidden.includes('steps')) view.steps = first('steps', (r) => r.steps);
    if (!hidden.includes('cycle_day')) view.cycle_day = first('cycle_day', (r) => r.cycle_day);
    return view;
  });
  return { days, hidden };
}

const hasValue = (d: DayView) => [d.sleep_score, d.activity, d.steps, d.cycle_day].some((v) => v !== null && v !== undefined);

/** True when the newest day with any value is not `today`: the cards then show the last sync time instead of numbers. */
export function isStale(days: readonly DayView[], today: string): boolean {
  const newest = days.filter(hasValue).at(-1);
  return !newest || newest.date !== today;
}

const tz = { timeZone: 'Europe/Copenhagen' } as const;

export const copenhagenToday = (now: Date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { ...tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

/** "Oura · synk. 19.45" today, "Garmin · synk. 18. nov. 08.05" on an earlier day. */
export function formatSync(source: SourceId, at: string | null, now: Date = new Date()): string {
  const name = sourceNames[source];
  if (!at) return `${name} · ikke synkroniseret endnu`;
  const when = new Date(at);
  const time = new Intl.DateTimeFormat('da-DK', { ...tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(when).replace(':', '.');
  if (copenhagenToday(when) === copenhagenToday(now)) return `${name} · synk. ${time}`;
  const date = new Intl.DateTimeFormat('da-DK', { ...tz, day: 'numeric', month: 'short' }).format(when);
  return `${name} · synk. ${date} ${time}`;
}

export interface SourceStatus {
  person: Person;
  source: ProviderId;
  connectedAt: string;
  lastSyncedAt: string | null;
  /** Only for the signed-in person's own sources; the database leaves it null for the other person's. */
  lastError: string | null;
  stepGoal: number | null;
}

export function sourcesFrom(rows: readonly SourceRow[]): SourceStatus[] {
  return rows.flatMap((r) => {
    const person = personFromKey(r.person);
    if (!person || (r.source !== 'oura' && r.source !== 'garmin')) return [];
    return [{ person, source: r.source, connectedAt: r.connected_at, lastSyncedAt: r.last_synced_at, lastError: r.last_error, stepGoal: r.step_goal }];
  });
}

/** Q6: when a person connects, the confirmation step starts from these. */
export const defaultSharing: Record<Metric, boolean> = { sleep_score: true, activity: true, steps: true, cycle_day: false };

/** A person's sharing rows. `confirmed` is false until the confirmation step has saved them; until then nothing is shared. */
export function sharingFor(rows: readonly { person: string; metric: string; shared: boolean }[], person: Person) {
  const mine = rows.filter((r) => personFromKey(r.person) === person && isMetric(r.metric));
  const values = Object.fromEntries(METRICS.map((m) => [m, mine.some((r) => r.metric === m && r.shared)])) as Record<Metric, boolean>;
  return { confirmed: mine.length > 0, values };
}

/** A short error code from the functions or `last_error`, as Danish text. Null for no error. */
export function errorText(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case 'reconnect': return 'Forbindelsen er udløbet — forbind igen';
    case 'no_access': return 'Oura giver ikke adgang. Tjek at medlemskabet er aktivt.';
    case 'not_configured': return 'Forbindelsen er ikke sat op endnu.';
    case 'garmin_endpoint': return 'Garmin svarer ikke som forventet. Data kommer, når det er rettet.';
    case 'bad_key': return 'Nøglen ser ikke rigtig ud. Kopiér den igen fra Garmin Connect.';
    case 'rate_limited': return 'For mange forsøg lige nu. Prøv igen senere.';
    case 'expired': return 'Det tog for lang tid. Prøv igen.';
    default: return 'Seneste synkronisering fejlede.';
  }
}

export function missingDataHint(source: ProviderId): string {
  return source === 'oura'
    ? 'Ingen data i nat — tjek at ringen har synkroniseret i Oura-appen.'
    : 'Ingen data i nat — tjek at uret har synkroniseret i Garmin Connect-appen.';
}

export type ConnectResult = { kind: 'connected'; source: ProviderId } | { kind: 'cancelled' } | { kind: 'error'; code: string };

/** What the Oura redirect put in the hash (`#hjem?forbundet=oura`, `?forbind=afbrudt`, `?forbind=fejl&kode=…`). */
export function connectResult(hash: string): ConnectResult | null {
  const q = hash.indexOf('?');
  if (q < 0) return null;
  const p = new URLSearchParams(hash.slice(q + 1));
  const connected = p.get('forbundet');
  if (connected === 'oura' || connected === 'garmin') return { kind: 'connected', source: connected };
  if (p.get('forbind') === 'afbrudt') return { kind: 'cancelled' };
  if (p.get('forbind') === 'fejl') return { kind: 'error', code: (p.get('kode') ?? 'internal').slice(0, 40) };
  return null;
}
