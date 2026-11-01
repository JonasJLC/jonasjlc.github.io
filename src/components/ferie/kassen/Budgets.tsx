import { PlusIcon } from 'lucide-react';
import { sortedTrips, whoKeys } from '../lib/balance';
import { fmtRange, fmtShort, toTime, todayTime } from '../lib/dates';
import { hasAct, hasEst, itemAmount, kr, tripBudget, type MoneyModel } from '../lib/kasse';
import type { FerieState, MoneyItem } from '../lib/types';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../ui/empty';
import { Progress } from '../ui/progress';
import { Separator } from '../ui/separator';
import { personName } from './helpers';

interface Props {
  state: FerieState;
  m: MoneyModel;
  onAdd: (o: { tripId?: string | null; cat?: string; kind?: 'expense' | 'deposit' }) => void;
  onEdit: (it: MoneyItem) => void;
}

function ItemRow({ state, it, onEdit }: { state: FerieState; it: MoneyItem; onEdit: (it: MoneyItem) => void }) {
  const dep = it.kind === 'deposit';
  const t = toTime(it.date);
  const paid = hasAct(it);
  const who = it.payer === 'a' || it.payer === 'b' ? personName(state, it.payer) : 'kontoen';
  const ds = Number.isNaN(t) ? '' : ` ${fmtShort(t, true)}`;
  let meta: string;
  if (dep) meta = `${paid ? 'Sat ind' : 'Forventes'}${ds}`;
  else if (paid) meta = `Betalt${ds} af ${who}`;
  else meta = `Estimat, betales${ds || ' snart'}${it.payer !== 'acc' ? ` af ${who}` : ''}`;
  const tr = it.tripId ? state.trips.find((x) => x.id === it.tripId) : undefined;
  if (it.tripId && !tr) meta += ', rejsen er slettet';
  if (it.fromPlan) meta += ', fra rejseplanen';
  const title = it.label || (dep ? 'Ekstra indskud' : it.cat) || 'Udgift';
  let sub: React.ReactNode = null;
  if (paid && hasEst(it)) {
    const df = +(it.act as number) - +(it.est as number);
    if (Math.abs(df) >= 1) sub = <small className={df > 0 ? 'text-warn' : 'text-ok'}>{df > 0 ? '+' : '−'}{kr(Math.abs(df))} ift. estimat</small>;
  } else if (!paid && !dep && state.kasse.margin > 0 && hasEst(it)) {
    sub = <small className="text-muted-foreground">{kr(itemAmount(it, state.kasse.margin))} med margin</small>;
  }
  const amount = paid ? +(it.act as number) : hasEst(it) ? +(it.est as number) : 0;
  return (
    <li>
      <button
        type="button"
        onClick={() => onEdit(it)}
        className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-muted ${paid ? '' : 'border border-dashed'} ${dep ? 'text-ok' : ''}`}
      >
        <span className="min-w-0">
          <b className="block truncate text-foreground">{title}</b>
          <span className="block truncate text-xs text-muted-foreground">{!dep && it.label && it.cat ? `${it.cat}, ${meta.charAt(0).toLowerCase()}${meta.slice(1)}` : meta}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end text-sm font-bold tabular-nums">
          <span>{paid && '✓ '}{dep ? '+' : ''}{kr(amount)}</span>
          {sub}
        </span>
      </button>
    </li>
  );
}

export function Budgets({ state, m, onAdd, onEdit }: Props) {
  const today = todayTime();
  const trips = sortedTrips(state.trips).filter((tr) => toTime(tr.to) >= today || state.money.some((it) => it.tripId === tr.id));
  const others = state.money
    .filter((it) => !it.tripId || !state.trips.some((t) => t.id === it.tripId))
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.created - b.created);
  const buf = +state.kasse.buffer || 0;

  return (
    <section aria-label="Budget for hver rejse" className="flex flex-col gap-4">
      <h2 className="font-display text-xl font-bold tracking-tight">Budget for hver rejse</h2>
      {trips.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Ingen rejser endnu</EmptyTitle>
            <EmptyDescription>Læg rejser ind under Feriedage, så kan I give dem et budget her.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        trips.map((tr) => {
          const b = tripBudget(state, tr.id, m);
          const stripe = tr.who === 'both' ? 'linear-gradient(var(--person-a) 50%, var(--person-b) 50%)' : `var(--person-${tr.who})`;
          const pct = b.total > 0 ? Math.min(100, (b.paid / b.total) * 100) : 0;
          return (
            <Card key={tr.id}>
              <CardHeader className="grid-cols-[auto_1fr_auto] items-center gap-3">
                <span className="h-10 w-1.5 rounded-full" style={{ background: stripe }} aria-hidden />
                <div className="min-w-0">
                  <CardTitle className="truncate font-display text-lg">{tr.name || 'Rejse'}</CardTitle>
                  <CardDescription>{fmtRange(toTime(tr.from), toTime(tr.to), state.settings.year)}, {tr.who === 'both' ? 'Begge' : personName(state, tr.who)}</CardDescription>
                </div>
                <div className="text-right">
                  <b className="block font-display text-2xl tabular-nums">{kr(b.total)}</b>
                  <small className="text-xs text-muted-foreground">{b.items.length ? 'forventet pris' : 'intet budget endnu'}</small>
                </div>
              </CardHeader>
              {b.items.length > 0 && (
                <CardContent className="flex flex-col gap-3">
                  <Progress value={pct} aria-label="Betalt af forventet pris" />
                  <ul className="flex flex-wrap gap-2 text-xs">
                    <li><Badge variant="secondary">Betalt {kr(b.paid)}</Badge></li>
                    {b.days > 0 && <li><Badge variant="secondary">Pr. feriedag {kr(b.total / b.days)}</Badge></li>}
                    {whoKeys(tr.who).length > 1 && <li><Badge variant="secondary">Pr. person {kr(b.total / 2)}</Badge></li>}
                    {Math.abs(b.over) >= 1 && <li><Badge variant={b.over > 0 ? 'destructive' : 'secondary'}>{b.over > 0 ? 'Over' : 'Under'} estimatet {kr(Math.abs(b.over))}</Badge></li>}
                  </ul>
                  <ul className="-mx-1 flex flex-col gap-1">{b.items.map((it) => <ItemRow key={it.id} state={state} it={it} onEdit={onEdit} />)}</ul>
                  {b.lowest && (
                    <p className={`rounded-xl px-3 py-2 text-sm ${b.lowest.bal < buf - 0.5 ? 'bg-warn/10 font-semibold text-warn' : 'bg-muted text-muted-foreground'}`}>
                      {b.lowest.bal < buf - 0.5
                        ? `Kontoen kommer ned på ${kr(b.lowest.bal)} d. ${fmtShort(b.lowest.t, true)}. Der mangler ${kr(buf - b.lowest.bal)}`
                        : `Kontoen har ${kr(b.lowest.bal)} tilbage efter betalingerne.`}
                    </p>
                  )}
                </CardContent>
              )}
              <CardFooter className="flex-wrap gap-2">
                {['Fly', 'Overnatning', 'Transport'].map((c) => (
                  <Button key={c} variant="outline" size="sm" onClick={() => onAdd({ tripId: tr.id, cat: c })}><PlusIcon data-icon="inline-start" />{c}</Button>
                ))}
                <Button variant="outline" size="sm" onClick={() => onAdd({ tripId: tr.id, cat: 'Andet' })}><PlusIcon data-icon="inline-start" />Anden udgift</Button>
              </CardFooter>
            </Card>
          );
        })
      )}
      <Separator />
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Andre udgifter og ekstra indskud</CardTitle>
          <CardDescription>Fx feriepenge, skat tilbage eller en bonus, eller udgifter der ikke hører til en rejse.</CardDescription>
        </CardHeader>
        <CardContent>
          {others.length ? <ul className="-mx-1 flex flex-col gap-1">{others.map((it) => <ItemRow key={it.id} state={state} it={it} onEdit={onEdit} />)}</ul> : <p className="text-sm text-muted-foreground">Ingen endnu.</p>}
        </CardContent>
        <CardFooter className="flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => onAdd({ kind: 'expense' })}><PlusIcon data-icon="inline-start" />Udgift</Button>
          <Button variant="outline" size="sm" onClick={() => onAdd({ kind: 'deposit' })}><PlusIcon data-icon="inline-start" />Ekstra indskud</Button>
        </CardFooter>
      </Card>
    </section>
  );
}
