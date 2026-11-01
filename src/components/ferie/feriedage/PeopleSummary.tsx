import { balanceAt, balanceSeries, lostInYear, usedInYear } from '../lib/balance';
import { fmtN, todayTime } from '../lib/dates';
import type { Action } from '../lib/use-ferie';
import { PERSON_KEYS, type FerieState, type PersonKey } from '../lib/types';
import { AnimatedNumber } from '../ui/animated-number';
import { fmtHours } from '../lib/units';
import { personColor, personName } from './helpers';

export function PeopleSummary({ state, dispatch }: { state: FerieState; dispatch: React.Dispatch<Action> }) {
  const Y = state.settings.year;
  const st = Date.UTC(Y, 0, 1);
  const en = Date.UTC(Y, 11, 31);
  const today = todayTime();

  return (
    <section aria-label="Feriedage pr. person" className="grid gap-3 sm:grid-cols-2 sm:gap-4">
      {PERSON_KEYS.map((k) => (
        <PersonCard key={k} k={k} state={state} dispatch={dispatch} Y={Y} st={st} en={en} today={today} />
      ))}
    </section>
  );
}

function PersonCard({
  k, state, dispatch, Y, st, en, today,
}: {
  k: PersonKey; state: FerieState; dispatch: React.Dispatch<Action>; Y: number; st: number; en: number; today: number;
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
    ? `${fmtN(-yearEnd)} dage (${fmtHours(-yearEnd, state.settings)}) for meget planlagt i ${Y}`
    : `${fmtN(used)} af ${fmtN(avail)} optjente dage (${fmtHours(used, state.settings)} af ${fmtHours(avail, state.settings)}) er planlagt i ${Y}`;

  const stats: { label: string; v: number; neg?: boolean }[] = [
    { label: 'Saldo i dag', v: now, neg: now < -1e-9 },
    { label: `Planlagt i ${Y}`, v: used },
    { label: 'Tilbage 31. dec.', v: yearEnd, neg: over },
  ];
  if (lost > 1e-9) stats.push({ label: 'Går tabt 31. dec.', v: lost, neg: true });
  if (min < -1e-9) stats.push({ label: `Laveste i ${Y}`, v: min, neg: true });

  return (
    <article
      className="relative overflow-hidden rounded-2xl border bg-card p-4 shadow-sm sm:p-5"
      style={{ ['--c' as string]: personColor(k) }}
    >
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: 'var(--c)' }} aria-hidden />
      <input
        aria-label={`Navn på person ${k === 'a' ? 1 : 2}`}
        value={state.settings.people[k].name}
        maxLength={30}
        placeholder={personName(state, k)}
        onChange={(e) => dispatch({ type: 'person', k, patch: { name: e.target.value } })}
        className="w-full rounded-lg bg-transparent font-display text-2xl font-bold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        style={{ color: 'var(--c)' }}
      />
      <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label}>
            <dd className={`font-display text-2xl font-bold leading-none sm:text-3xl ${s.neg ? 'text-warn' : ''}`}>
              <AnimatedNumber value={s.v} />
            </dd>
            <dd className="mt-1 text-xs tabular-nums text-muted-foreground">{fmtHours(s.v, state.settings)}</dd>
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
          </div>
        ))}
      </dl>
      <div
        role="img"
        aria-label={caption}
        className="mt-4 h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%`, background: over ? 'var(--warn)' : 'var(--c)' }}
        />
      </div>
      <p className={`mt-2 text-xs ${over ? 'text-warn' : 'text-muted-foreground'}`}>{caption}</p>
    </article>
  );
}
