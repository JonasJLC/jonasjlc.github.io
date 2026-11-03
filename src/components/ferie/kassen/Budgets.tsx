import { FoldButton, useFold } from '../fold';
import { CheckIcon, ChevronDownIcon, PlusIcon } from 'lucide-react';
import { sortedTrips, whoKeys } from '../lib/balance';
import { fmtRange, fmtShort, toTime, todayTime } from '../lib/dates';
import { hasAct, hasEst, itemAmount, kr, tripBudget, type MoneyModel } from '../lib/kasse';
import { CATEGORIES, type FerieState, type MoneyItem } from '../lib/types';
import { Money, PersonDots, SectionTitle } from '../page';
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle } from '../ui/card';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../ui/menu';
import { Progress } from '../ui/progress';
import { personName } from './helpers';

interface Props {
  state: FerieState;
  m: MoneyModel;
  onAdd: (o: { tripId?: string | null; cat?: string; kind?: 'expense' | 'deposit' }) => void;
  onEdit: (it: MoneyItem) => void;
}

/** One expense or extra deposit. Estimates have a dashed figure until they are paid. */
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
    if (Math.abs(df) >= 1) sub = <span className="text-muted-foreground">{df > 0 ? '+' : '−'}{kr(Math.abs(df))} ift. estimat</span>;
  } else if (!paid && !dep && state.kasse.margin > 0 && hasEst(it)) {
    sub = <span className="text-muted-foreground">{kr(itemAmount(it, state.kasse.margin))} med margin</span>;
  }
  const amount = paid ? +(it.act as number) : hasEst(it) ? +(it.est as number) : 0;
  return (
    <li className="border-t border-rule first:border-t-0">
      <button
        type="button"
        onClick={() => onEdit(it)}
        className="-mx-2 flex min-h-14 w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{!dep && it.label && it.cat ? `${it.cat} · ${meta.charAt(0).toLowerCase()}${meta.slice(1)}` : meta}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end text-sm">
          <span className={`inline-flex items-center gap-1 ${paid ? '' : 'border-b border-dashed border-muted-foreground text-muted-foreground'} ${dep && paid ? 'text-ok' : ''}`}>
            {paid && !dep && <CheckIcon className="size-3.5 text-ok" aria-label="Betalt" />}
            <Money value={amount} sign={dep} />
          </span>
          {sub && <span className="text-xs">{sub}</span>}
        </span>
      </button>
    </li>
  );
}

function AddExpense({ onPick }: { onPick: (cat: string) => void }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" size="sm" className="-ml-2 mt-auto self-start"><PlusIcon aria-hidden />Tilføj udgift<ChevronDownIcon className="text-muted-foreground" aria-hidden /></Button>
      </MenuTrigger>
      <MenuContent>
        {CATEGORIES.map((c) => <MenuItem key={c} onSelect={() => onPick(c)}>{c}</MenuItem>)}
      </MenuContent>
    </Menu>
  );
}

export function Budgets({ state, m, onAdd, onEdit }: Props) {
  const today = todayTime();
  const trips = sortedTrips(state.trips).filter((tr) => toTime(tr.to) >= today || state.money.some((it) => it.tripId === tr.id));
  const others = state.money
    .filter((it) => !it.tripId || !state.trips.some((t) => t.id === it.tripId))
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.created - b.created);
  const fold = useFold('budgets');
  const buf = +state.kasse.buffer || 0;

  return (
    <section aria-labelledby="budget-h" className="mt-10">
      <SectionTitle>
        <FoldButton folded={fold.folded} onToggle={fold.toggle} controls="budget-body" hint={`${trips.length + 1} skjult`}>
          <span id="budget-h">Budget for hver rejse</span>
        </FoldButton>
      </SectionTitle>
      <div id="budget-body" className={`${fold.folded ? 'hidden' : 'grid'} gap-4 md:grid-cols-2`}>
        {trips.length === 0 && (
          <Card className="md:col-span-2">
            <p className="text-sm text-muted-foreground">Ingen rejser endnu. Læg rejser ind under Feriedage, så kan I give dem et budget her.</p>
          </Card>
        )}
        {trips.map((tr) => {
          const b = tripBudget(state, tr.id, m);
          const pct = b.total > 0 ? Math.min(100, (b.paid / b.total) * 100) : 0;
          const short = b.lowest !== null && b.lowest.bal < buf - 0.5;
          const per = [
            b.days > 0 ? `${kr(b.total / b.days)} pr. feriedag` : '',
            whoKeys(tr.who).length > 1 ? `${kr(b.total / 2)} pr. person` : '',
          ].filter(Boolean).join(' · ');
          return (
            <Card key={tr.id} className="gap-3">
              <CardHeader className="grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2"><PersonDots who={tr.who} /><span className="truncate">{tr.name || 'Rejse'}</span></CardTitle>
                  <p className="text-xs text-muted-foreground">{fmtRange(toTime(tr.from), toTime(tr.to), state.settings.year)} · {tr.who === 'both' ? 'Begge' : personName(state, tr.who)}</p>
                </div>
                <div className="text-right">
                  <Money value={b.total} className="block text-2xl leading-8" />
                  <span className="text-xs text-muted-foreground">{b.items.length ? 'forventet pris' : 'intet budget endnu'}</span>
                </div>
              </CardHeader>
              {b.items.length > 0 && (
                <>
                  <div>
                    <Progress value={pct} aria-label={`Betalt ${kr(b.paid)} af ${kr(b.total)}`} />
                    <div className="mt-1.5 flex justify-between gap-3 text-xs text-muted-foreground">
                      <span>Betalt <span className="text-foreground">{kr(b.paid)}</span></span>
                      <span className="text-right">{per}</span>
                    </div>
                    {Math.abs(b.over) >= 1 && (
                      <p className={`mt-1 text-xs ${b.over > 0 ? 'text-warn' : 'text-muted-foreground'}`}>
                        {kr(Math.abs(b.over))} {b.over > 0 ? 'over' : 'under'} estimatet på det betalte
                      </p>
                    )}
                  </div>
                  <ul className="flex flex-col">{b.items.map((it) => <ItemRow key={it.id} state={state} it={it} onEdit={onEdit} />)}</ul>
                  {b.lowest && (
                    <p className={`text-sm ${short ? 'font-medium text-warn' : 'text-muted-foreground'}`}>
                      {short
                        ? `Kontoen kommer ned på ${kr(b.lowest.bal)} d. ${fmtShort(b.lowest.t, true)}. Der mangler ${kr(buf - b.lowest.bal)}`
                        : `Kontoen har ${kr(b.lowest.bal)} tilbage efter betalingerne.`}
                    </p>
                  )}
                </>
              )}
              <AddExpense onPick={(cat) => onAdd({ tripId: tr.id, cat })} />
            </Card>
          );
        })}
        <Card className="gap-3">
          <CardHeader>
            <CardTitle>Andre udgifter og ekstra indskud</CardTitle>
            <p className="text-xs text-muted-foreground">Fx feriepenge, skat tilbage eller en bonus, eller udgifter der ikke hører til en rejse.</p>
          </CardHeader>
          {others.length
            ? <ul className="flex flex-col">{others.map((it) => <ItemRow key={it.id} state={state} it={it} onEdit={onEdit} />)}</ul>
            : <p className="text-sm text-muted-foreground">Ingen endnu.</p>}
          <div className="-ml-2 mt-auto flex flex-wrap gap-1">
            <Button variant="ghost" size="sm" onClick={() => onAdd({ kind: 'expense' })}><PlusIcon aria-hidden />Udgift</Button>
            <Button variant="ghost" size="sm" onClick={() => onAdd({ kind: 'deposit' })}><PlusIcon aria-hidden />Ekstra indskud</Button>
          </div>
        </Card>
      </div>
    </section>
  );
}
