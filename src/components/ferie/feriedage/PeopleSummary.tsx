import { balanceAt, balanceSeries, lostInYear, usedBetween, usedInYear } from '../lib/balance';
import { DAY, fmtN, todayTime } from '../lib/dates';
import { PERSON_KEYS, type FerieState, type PersonKey } from '../lib/types';
import { fmtHours } from '../lib/units';
import { cn } from '../lib/utils';
import { AnimatedNumber } from '../ui/animated-number';
import { Avatar } from '../page';
import { personName } from './helpers';

/** One panel per person: today's balance leads, then the year as one stacked bar with its legend. */
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

interface Part {
  key: string;
  label: string;
  /** Figure shown in the legend. */
  v: number;
  /** Share of the bar, in days. */
  w: number;
  /** Fill for the bar segment and the legend swatch. */
  fill: string;
  tone?: 'warn' | 'caution';
}

function PersonCard({
  k, state, Y, st, en, today,
}: {
  k: PersonKey; state: FerieState; Y: number; st: number; en: number; today: number;
}) {
  const now = balanceAt(state, k, today);
  const yearEnd = balanceAt(state, k, en);
  const used = usedInYear(state, k, Y);
  const taken = usedBetween(state, k, st, Math.min(en, today - DAY));
  const planned = used - taken;
  const lost = lostInYear(state, k, Y);
  let min = Infinity;
  for (const v of balanceSeries(state, k, st, en)) min = Math.min(min, v);

  // Planning past zero eats into the planned days first, then the taken ones.
  const over = Math.min(Math.max(-yearEnd, 0), used);
  const solid = k === 'a' ? 'bg-person-a' : 'bg-person-b';
  const parts: Part[] = [
    { key: 'taken', label: 'Holdt', v: taken, w: taken - Math.max(0, over - planned), fill: solid },
    { key: 'planned', label: 'Planlagt', v: planned, w: Math.max(0, planned - over), fill: cn(solid, 'opacity-45') },
    over > 1e-9
      ? { key: 'over', label: 'For meget', v: -yearEnd, w: over, fill: 'bg-warn', tone: 'warn' }
      : { key: 'left', label: 'Tilbage', v: yearEnd, w: yearEnd, fill: cn(solid, 'opacity-20') },
  ];
  if (lost > 1e-9) parts.push({ key: 'lost', label: 'Udløber', v: lost, w: lost, fill: 'bg-caution', tone: 'caution' });
  const total = parts.reduce((s, p) => s + Math.max(0, p.w), 0);

  const label = `${personName(state, k)} i ${Y}: ` + parts.map((p) => `${p.label.toLowerCase()} ${fmtN(p.v)} dage`).join(', ');
  const dip = over < 1e-9 && min < -1e-9;
  const h = (v: number) => fmtHours(v, state.settings);

  return (
    <article aria-labelledby={`p-${k}`} className="grid min-w-0 gap-4 rounded-panel bg-panel p-5 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-x-8">
      <header className="flex items-center gap-2 lg:col-span-2">
        <Avatar k={k} name={personName(state, k)} className="ring-0" />
        <h2 id={`p-${k}`} className="text-[15px] leading-6 font-semibold">{personName(state, k)}</h2>
      </header>
      <div>
        <p className="text-[13px] text-muted-foreground">Saldo i dag</p>
        <p className={cn('text-[32px] leading-10', now < -1e-9 && 'text-warn')}>
          <AnimatedNumber value={now} /><span className="ml-1.5 text-sm text-muted-foreground">dage</span>
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">{h(now)}</p>
      </div>
      <dl className={cn('grid gap-3 border-t border-rule pt-3 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6', parts.length > 3 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3')}>
        {parts.map((p) => (
          <div key={p.key} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <i className={cn('size-2 shrink-0 rounded-[2px]', p.fill)} aria-hidden />
              <span className="min-w-0">{p.label}</span>
            </dt>
            <dd className={cn('text-lg leading-7 tabular-nums', p.tone === 'warn' && 'text-warn', p.tone === 'caution' && 'text-caution')}>
              <AnimatedNumber value={p.v} />
            </dd>
            <dd className="text-xs text-muted-foreground tabular-nums">{h(p.v)}</dd>
          </div>
        ))}
      </dl>
      <div className="lg:col-span-2">
        <div role="img" aria-label={label} className={cn('flex h-2.5 gap-0.5 overflow-hidden rounded-full', total < 1e-9 && 'bg-muted')}>
          {total > 1e-9 && parts.map((p) => p.w > 1e-9 && (
            <div
              key={p.key}
              className={cn('h-full transition-[flex-grow] duration-500', p.fill)}
              style={{ flexGrow: p.w, flexBasis: 0 }}
            />
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {over > 1e-9 ? 'For meget planlagt' : lost > 1e-9 ? 'Tilbage og udløber' : 'Tilbage'} pr. 31. dec. {Y}, med alle planlagte rejser.
        </p>
        {dip && (
          <p className="mt-1.5 text-xs text-warn">
            Saldoen er under nul undervejs i {Y} (laveste {fmtN(min)} dage).
          </p>
        )}
      </div>
    </article>
  );
}
