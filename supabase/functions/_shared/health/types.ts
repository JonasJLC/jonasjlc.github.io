// The provider-agnostic health shape (idea 10, ADR-06). Every adapter maps its provider's data to `HealthDay`; the edge
// functions store it in `sp_health_daily`. A missing value is `null`, never 0, so the app can say "Ingen data i nat".

export type Metric = 'sleep_score' | 'activity' | 'steps' | 'cycle_day';
export const METRICS: readonly Metric[] = ['sleep_score', 'activity', 'steps', 'cycle_day'];

/** Sources that store rows in `sp_health_daily`. Cycle day comes from the in-app period log (`manual`), computed in SQL. */
export type ProviderId = 'oura' | 'garmin';
export type SourceId = ProviderId | 'manual';
export type PersonKey = 'a' | 'b';

export interface HealthDay {
  date: string; // ISO date in Europe/Copenhagen
  sleep_score: number | null;
  activity_progress: number | null; // 0–1, may exceed 1
  activity_goal: number | null;
  activity_goal_unit: 'steps' | 'kcal' | 'score' | null;
  steps: number | null;
  cycle_day: number | null;
  source: SourceId;
  last_synced_at: string;
}

export interface FetchContext {
  householdId: string;
  person: PersonKey;
  from: string;
  to: string;
}

export interface HealthSource {
  id: ProviderId;
  /** Days in [from, to] for one person. Throws HttpError(…, 'reconnect') when the grant is gone. */
  fetchDays(ctx: FetchContext): Promise<HealthDay[]>;
}
