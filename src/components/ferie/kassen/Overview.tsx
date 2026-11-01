import { fmtShort, todayTime } from '../lib/dates';
import { depShare, hasSteps, idxOf, kr, kStart, moneyModel, nextChangeText } from '../lib/kasse';
import type { Action } from '../lib/use-ferie';
import type { FerieState } from '../lib/types';
import { toTime } from '../lib/dates';
import { AnimatedNumber } from '../ui/animated-number';
import { Card, CardContent, CardDescription, CardHeader } from '../ui/card';
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
  let depSub = m.D > 0 ? `${personName(state, 'a')} ${kr(a)}, ${personName(state, 'b')} ${kr(m.D - a)}, ${day}` : 'Skriv jeres faste beløb under Kontoen';
  const nx = nextChangeText(state, today);
  if (nx) depSub += `. ${nx}`;

  return (
    <section aria-label="Overblik" className="grid gap-3 md:grid-cols-3 md:gap-4">
      <Card className="gap-2 py-5">
        <CardHeader><CardDescription>På kontoen i dag</CardDescription></CardHeader>
        <CardContent>
          <AnimatedNumber value={now} format={kr} className={`font-display text-4xl font-bold ${now < -0.5 ? 'text-warn' : ''}`} />
          <p className="mt-1 text-xs text-muted-foreground">
            {m.st === today ? 'Ud fra saldoen i dag' : `Ud fra saldoen d. ${fmtShort(m.st, true)} og det, der er sket siden`}
          </p>
        </CardContent>
      </Card>
      <Card className="gap-2 py-5">
        <CardHeader>
          <CardDescription>Saldo på en dato</CardDescription>
        </CardHeader>
        <CardContent>
          <AnimatedNumber value={lookOk ? lookBal : 0} format={(v) => (lookOk ? kr(v) : '–')} className={`font-display text-4xl font-bold ${lookOk && lookBal < -0.5 ? 'text-warn' : ''}`} />
          <p className="mt-1 text-xs text-muted-foreground">
            {lookOk ? `Frem til da: ${kr(ins)} ind og ${kr(out)} ud` : `Vælg en dato efter ${fmtShort(kStart(state, today), true)}`}
          </p>
          <Input
            type="date"
            aria-label="Vælg dato for saldo"
            className="mt-3"
            value={state.kasse.look}
            onChange={(e) => dispatch({ type: 'kasse', patch: { look: e.target.value } })}
          />
        </CardContent>
      </Card>
      <Card className="gap-2 py-5">
        <CardHeader>
          <CardDescription>{hasSteps(state) ? 'Indskud pr. måned lige nu' : 'Fast indskud pr. måned'}</CardDescription>
        </CardHeader>
        <CardContent>
          <AnimatedNumber value={m.D} format={kr} className="font-display text-4xl font-bold" />
          <p className="mt-1 text-xs text-muted-foreground">{depSub}</p>
        </CardContent>
      </Card>
    </section>
  );
}

