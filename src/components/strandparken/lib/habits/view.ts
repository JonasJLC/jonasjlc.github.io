// What the Vaner UI needs on top of the counting in model.ts: today's metric value for an automatic habit (only when the
// viewer may see it), the metrics a person has, and the number the custom rule field shows. Pure, tested.
import type { TodayValue } from './model.ts';
import { ruleMetrics, type Rule, type RuleMetric } from './rules.ts';

/** The part of a health day (`DayView`) a rule reads. A missing key means the owner hides it; null is no data. */
export interface HealthDayLike {
  sleep_score?: number | null;
  steps?: number | null;
  activity?: { progress: number } | null;
}

/** A rule metric to the health metric the sharing switches are named after. */
export const healthMetricOf = (m: RuleMetric): 'sleep_score' | 'steps' | 'activity' => (m === 'activity_progress' ? 'activity' : m);

/** Today's value for the card. `visible` is false when the metric is hidden from the viewer, then no number and no bar is shown. */
export function todayValueFor(rule: Rule | null, day: HealthDayLike | null, hidden: readonly string[]): TodayValue | null {
  if (!rule) return null;
  const metric = healthMetricOf(rule.metric);
  if (hidden.includes(metric)) return { value: null, visible: false };
  const v = metric === 'activity' ? day?.activity?.progress : metric === 'steps' ? day?.steps : day?.sleep_score;
  return { value: typeof v === 'number' ? v : null, visible: true };
}

/** Metrics the person has: all three with a connected source, otherwise the ones that already have a value. */
export function availableMetrics(hasSource: boolean, days: readonly HealthDayLike[]): RuleMetric[] {
  if (hasSource) return [...ruleMetrics];
  return ruleMetrics.filter((m) => days.some((d) => {
    const metric = healthMetricOf(m);
    return metric === 'activity' ? d.activity != null : d[metric] != null;
  }));
}

/** The custom rule's number as the field shows it: activity is a percentage (1 is 100). */
export const thresholdToText = (rule: Pick<Rule, 'metric' | 'threshold'>): string =>
  String(rule.metric === 'activity_progress' ? Math.round(rule.threshold * 100) : rule.threshold);

/** Back from the field; null when it is not a number of zero or more. */
export function textToThreshold(metric: RuleMetric, text: string): number | null {
  const n = Number(text.trim().replace(',', '.'));
  if (text.trim() === '' || !Number.isFinite(n) || n < 0) return null;
  return metric === 'activity_progress' ? n / 100 : n;
}

/** Progress of a numeric goal (steps) as 0 to 1 for the thin bar; null when there is nothing to show. */
export function goalFraction(rule: Rule | null, v: TodayValue | null): number | null {
  if (!rule || rule.metric !== 'steps' || !v || !v.visible || v.value === null || rule.threshold <= 0) return null;
  return Math.min(1, Math.max(0, v.value / rule.threshold));
}
