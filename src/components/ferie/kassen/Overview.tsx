import { fmtShort, todayTime } from '../lib/dates';
import { depShare, hasSteps, idxOf, kr, kStart, moneyModel, nextChangeText } from '../lib/kasse';
import type { Action } from '../lib/use-ferie';
import type { FerieState } from '../lib/types';
import { toTime } from '../lib/dates';
import { Money } from '../page';
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

  const cell = 'flex min-w-0 flex-col gap-1 px-5 py-4 md:py-0 first:md:pl-0 last:md:pr-0';
  return (
    <section aria-label="Overblik" className="rounded-panel bg-panel p-1 md:px-5 md:py-5">
      <div className="grid divide-y divide-rule md:grid-cols-3 md:divide-x md:divide-y-0">
        <div className={cell}>
          <h2 className="text-[13px] text-muted-foreground">På kontoen i dag</h2>
          <Money value={now} className={`text-[36px] leading-[44px] ${now < -0.5 ? 'text-warn' : ''}`} />
          <p className="text-xs text-muted-foreground">
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
          <p className="text-xs text-muted-foreground">
            {m.D > 0
              ? <>{personName(state, 'a')} <span className="text-foreground">{kr(a)}</span> · {personName(state, 'b')} <span className="text-foreground">{kr(m.D - a)}</span> · {day}{nx ? `. ${nx}` : ''}</>
              : 'Skriv jeres faste beløb under Kontoen'}
          </p>
        </div>
      </div>
    </section>
  );
}
