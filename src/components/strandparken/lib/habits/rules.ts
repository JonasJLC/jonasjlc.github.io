// Automatic habit rules (idea 15). Pure and dependency-free: `supabase/functions/health-sync/habits.ts` keeps a copy of
// `meets` (Deno cannot bundle files from `src/`), and a test keeps the two in step.

export type RuleMetric = 'steps' | 'sleep_score' | 'activity_progress';
export const ruleMetrics: readonly RuleMetric[] = ['steps', 'sleep_score', 'activity_progress'];
export type RuleOp = '>=' | '>';
export type Rule = { metric: RuleMetric; op: RuleOp; threshold: number };

/** One day of the three metrics a rule can read. A missing key or null is "no data". */
export type RuleDay = Partial<Record<RuleMetric, number | null>>;

/** True when the day meets the rule. Missing data (null, absent, NaN) is never complete; zero is data. */
export function meets(rule: Rule, day: RuleDay): boolean {
  const v = day[rule.metric];
  if (typeof v !== 'number' || !Number.isFinite(v)) return false;
  return rule.op === '>=' ? v >= rule.threshold : v > rule.threshold;
}

export const isRule = (r: unknown): r is Rule => {
  if (typeof r !== 'object' || r === null) return false;
  const x = r as Record<string, unknown>;
  return ruleMetrics.includes(x.metric as RuleMetric) && (x.op === '>=' || x.op === '>') && typeof x.threshold === 'number' && Number.isFinite(x.threshold);
};

const presets: { title: string; rule: Rule }[] = [
  { title: '8.000 skridt', rule: { metric: 'steps', op: '>=', threshold: 8000 } },
  { title: 'Søvnscore over 75', rule: { metric: 'sleep_score', op: '>', threshold: 75 } },
  { title: 'Aktivitetsmål nået', rule: { metric: 'activity_progress', op: '>=', threshold: 1 } },
];

/** Suggested automatic habits, limited to the metrics the current person has data or a connected source for. */
export const suggestions = (available: readonly RuleMetric[]): { title: string; rule: Rule }[] =>
  presets.filter((p) => available.includes(p.rule.metric)).map((p) => ({ title: p.title, rule: { ...p.rule } }));
