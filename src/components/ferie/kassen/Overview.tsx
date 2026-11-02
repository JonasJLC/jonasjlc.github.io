import { fmtShort, todayTime } from '../lib/dates';
import { depShare, hasSteps, idxOf, kr, kStart, moneyModel, nextChangeText } from '../lib/kasse';
import type { Action } from '../lib/use-ferie';
import type { FerieState } from '../lib/types';
import { toTime } from '../lib/dates';
import { Avatar, Money } from '../page';
import { Input } from '../ui/input';
import { personName } from './helpers';

export function Overview({ state, dispatch }: { state: FerieState; dispatch: React.Dispatch<Action> }) {
  const today = todayTime();
  const m = moneyModel(state, today);
  const now = today < m.st ? +state.kasse.start || 0 : m.bal[idxOf(m, today)];
  const lk = toTime(state.kasse.look);
  const lookOk = !Number.isNaN(lk) && lk >= m.st;
  let ins = 0;
  let out = 0;
  let lookBal = 0;
  if (lookOk) {
    const i = idxOf(m, lk);
    lookBal = m.bal[i];
    ins = m.depCum[i];
    for (const e of m.ev) {
      if (e.t > lk) break;
      if (e.amt > 0) ins += e.amt;
      else out -= e.amt;
    }
  }
  const a = Math.round(m.D * depShare(state));
  const day = +state.kasse.depDay === 31 ? 'sidste dag i måneden' : `d. ${+state.kasse.depDay || 1}.`;
  const nx = nextChangeText(state, today);

  const names = { a: personName(state, 'a'), b: personName(state, 'b') };
  const shares: { k: 'a' | 'b'; amt: number }[] = [{ k: 'a', amt: a }, { k: 'b', amt: m.D - a }];

  const cell = 'flex min-w-0 flex-col gap-1 rounded-card bg-panel p-5';
  return (
    <section aria-label="Overblik" className="grid gap-3 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-3 rounded-card bg-data-tint p-3 text-data-ink">
        <div className="rounded-xl border-[1.5px] border-dashed border-data/35 px-4 py-3">
          <h2 className="text-[13px]">På kontoen i dag</h2>
          <Money value={now} className={`block text-[40px] leading-[48px] font-semibold tracking-[-0.02em] ${now < -0.5 ? 'text-warn' : 'text-foreground'}`} />
        </div>
        <p className="px-1 pb-1 text-xs">
          {m.st === today ? 'Ud fra saldoen i dag' : `Ud fra saldoen d. ${fmtShort(m.st, true)} og det, der er sket siden`}
        </p>
      </div>
      <div className={cell}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[13px] text-muted-foreground"><label htmlFor="kasse-look">Saldo d.</label></h2>
          <Input
            id="kasse-look"
            type="date"
            className="h-9 w-auto px-2 text-base md:h-8 md:text-sm"
            value={state.kasse.look}
            onChange={(e) => dispatch({ type: 'kasse', patch: { look: e.target.value } })}
          />
        </div>
        {lookOk
          ? <Money value={lookBal} className={`text-2xl leading-[44px] ${lookBal < -0.5 ? 'text-warn' : ''}`} />
          : <span className="text-2xl leading-[44px] text-muted-foreground">–</span>}
        <p className="text-xs text-muted-foreground">
          {lookOk ? <>Frem til da <span className="text-foreground">{kr(ins)}</span> ind og <span className="text-foreground">{kr(out)}</span> ud</> : `Vælg en dato efter ${fmtShort(kStart(state, today), true)}`}
        </p>
      </div>
      <div className={cell}>
        <h2 className="text-[13px] text-muted-foreground">{hasSteps(state) ? 'Indskud pr. måned lige nu' : 'Fast indskud pr. måned'}</h2>
        <Money value={m.D} className="text-2xl leading-[44px]" />
        {m.D > 0 ? (
          <ul className="flex flex-col gap-1.5 text-sm">
            {shares.map((x) => (
              <li key={x.k} className="flex items-center gap-2">
                <Avatar k={x.k} name={names[x.k]} className="ring-panel" />
                <span className="min-w-0 flex-1 truncate">{names[x.k]}</span>
                <Money value={x.amt} />
              </li>
            ))}
            <li className="text-xs text-muted-foreground">Indskuddet kommer {day}{nx ? `. ${nx}` : ''}</li>
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Skriv jeres faste beløb under Kontoen</p>
        )}
      </div>
    </section>
  );
}
