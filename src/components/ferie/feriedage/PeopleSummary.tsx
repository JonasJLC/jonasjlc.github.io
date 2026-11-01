import { balanceAt, balanceSeries, lostInYear, usedInYear } from '../lib/balance';
import { fmtN, todayTime } from '../lib/dates';
import { PERSON_KEYS, type FerieState, type PersonKey } from '../lib/types';
import { fmtHours } from '../lib/units';
import { cn } from '../lib/utils';
import { AnimatedNumber } from '../ui/animated-number';
import { personName } from './helpers';

/** One panel per person: today's balance leads, then the year in three figures and a plan track. */
export function PeopleSummary({ state }: { state: FerieState }) {
  const Y = state.settings.year;
  const st = Date.UTC(Y, 0, 1);
  const en = Date.UTC(Y, 11, 31);
  const today = todayTime();
  return (
    <>
      {PERSON_KEYS.map((k) => (
        <PersonCard key={k} k={k} state={state} Y={Y} st={st} en={en} today={today} />
      ))}
    </>
  );
}

function PersonCard({
  k, state, Y, st, en, today,
}: {
  k: PersonKey; state: FerieState; Y: number; st: number; en: number; today: number;
}) {
  const now = balanceAt(state, k, today);
  const yearEnd = balanceAt(state, k, en);
  const used = usedInYear(state, k, Y);
  const lost = lostInYear(state, k, Y);
  let min = Infinity;
  for (const v of balanceSeries(state, k, st, en)) min = Math.min(min, v);
  const over = yearEnd < -1e-9;
  const avail = used + yearEnd + lost;
  const pct = over ? 100 : avail > 0 ? Math.min(100, (used / avail) * 100) : 0;
  const caption = over
    ? `${fmtN(-yearEnd)} dage for meget planlagt i ${Y}`
    : `${fmtN(used)} af ${fmtN(avail)} dage planlagt i ${Y}`;
  const h = (v: number) => fmtHours(v, state.settings);

  const stats: { label: string; v: number; neg?: boolean; warn?: boolean }[] = [
    { label: `Planlagt i ${Y}`, v: used },
    { label: 'Tilbage 31. dec.', v: yearEnd, neg: over },
    lost > 1e-9
      ? { label: 'Går tabt 31. dec.', v: lost, warn: true }
      : { label: `Laveste i ${Y}`, v: min, neg: min < -1e-9 },
  ];

  return (
    <article aria-labelledby={`p-${k}`} className="grid min-w-0 gap-4 rounded-panel bg-panel p-5 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-x-8">
      <header className="flex items-center gap-2 lg:col-span-2">
        <span className={cn('flex size-6 items-center justify-center rounded-full text-xs font-semibold', k === 'a' ? 'bg-person-a-tint text-person-a' : 'bg-person-b-tint text-person-b')} aria-hidden>
          {personName(state, k).charAt(0)}
        </span>
        <h2 id={`p-${k}`} className="text-[15px] leading-6 font-semibold">{personName(state, k)}</h2>
      </header>
      <div>
        <p className="text-[13px] text-muted-foreground">Saldo i dag</p>
        <p className={cn('text-[32px] leading-10', now < -1e-9 && 'text-warn')}>
          <AnimatedNumber value={now} /><span className="ml-1.5 text-sm text-muted-foreground">dage</span>
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">{h(now)}</p>
      </div>
      <dl className="grid grid-cols-3 gap-3 border-t border-rule pt-3 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className={cn('text-lg leading-7 tabular-nums', s.neg && 'text-warn', s.warn && 'text-caution')}><AnimatedNumber value={s.v} /></dd>
            <dd className="text-xs text-muted-foreground tabular-nums">{h(s.v)}</dd>
          </div>
        ))}
      </dl>
      <div className="lg:col-span-2">
        <div role="img" aria-label={caption} className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full transition-[width] duration-500', k === 'a' ? 'bg-person-a' : 'bg-person-b', over && 'bg-warn')}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className={cn('mt-1.5 text-xs', over ? 'text-warn' : 'text-muted-foreground')}>{caption}</p>
      </div>
    </article>
  );
}
