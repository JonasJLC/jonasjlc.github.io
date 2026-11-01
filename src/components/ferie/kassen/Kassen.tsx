import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { toISO, todayTime } from '../lib/dates';
import { analyze, depShare, moneyModel, stepsFromSegments, kr } from '../lib/kasse';
import { newId, type Action } from '../lib/use-ferie';
import type { FerieState, MoneyItem } from '../lib/types';
import { AccountCard } from './AccountCard';
import { AccountChart } from './AccountChart';
import { Budgets } from './Budgets';
import { ItemSheet, draftFromItem, type ItemDraft } from './ItemSheet';
import { MonthlyChart } from './MonthlyChart';
import { Overview } from './Overview';
import { Settle } from './Settle';
import { VerdictCard } from './Verdict';
import { buildVerdict, type VerdictAction } from './verdict';

export function Kassen({ state, dispatch }: { state: FerieState; dispatch: React.Dispatch<Action> }) {
  const today = todayTime();
  const [scen, setScen] = useState<number | null>(null);
  const [draft, setDraft] = useState<ItemDraft | null>(null);

  const analysis = useMemo(() => analyze(state, today), [state, today]);
  const m = useMemo(() => moneyModel(state, today), [state, today]);
  const verdict = useMemo(() => buildVerdict(state, analysis, m, today), [state, analysis, m, today]);

  const splitDeposit = (total: number) => {
    const share = depShare(state);
    const a = Math.round(total * share);
    return { depA: a, depB: Math.max(0, Math.round(total) - a) };
  };

  const addDeposit = (amount: number, label: string): MoneyItem => ({
    id: newId(), kind: 'deposit', tripId: null, cat: 'Indskud', label, est: amount, act: null,
    date: toISO(Math.max(today, new Date(state.kasse.startDate).getTime() || today)), payer: 'acc', created: Date.now(),
  });

  const apply = (a: VerdictAction) => {
    if (a.kind === 'usedep') {
      dispatch({ type: 'kasse', patch: { ...splitDeposit(a.total), steps: [] } });
      toast.success(`Det månedlige indskud er nu ${kr(a.total)}`);
    } else if (a.kind === 'plan') {
      if (a.plus) dispatch({ type: 'saveItem', item: addDeposit(a.plus, 'Engangsindskud') });
      dispatch({ type: 'kasse', patch: { steps: stepsFromSegments(analysis.segs) } });
      toast.success('Trappeplanen er gemt');
    } else {
      dispatch({ type: 'saveItem', item: addDeposit(a.amount, 'Engangsindskud') });
      dispatch({ type: 'kasse', patch: { ...splitDeposit(a.rate), steps: [] } });
      toast.success(`Engangsindskud på ${kr(a.amount)} er lagt ind, og det faste beløb er nu ${kr(a.rate)}`);
    }
    setScen(null);
  };

  const openNew = (o: { tripId?: string | null; cat?: string; kind?: 'expense' | 'deposit' }) => {
    let date = toISO(today);
    const tr = o.tripId ? state.trips.find((t) => t.id === o.tripId) : undefined;
    if (tr && new Date(tr.from).getTime() > today) date = tr.from;
    setDraft({ kind: o.kind ?? 'expense', tripId: o.tripId ?? null, cat: o.cat ?? 'Andet', label: '', est: '', act: '', date, payer: 'acc' });
  };

  const save = (item: Omit<MoneyItem, 'created'> & { created?: number }) => {
    const existing = item.id ? state.money.find((x) => x.id === item.id) : undefined;
    dispatch({ type: 'saveItem', item: { ...item, id: item.id || newId(), created: existing?.created ?? Date.now() } });
    setDraft(null);
    toast.success(existing ? 'Rettet' : 'Gemt');
  };

  const remove = (id: string) => {
    const item = state.money.find((x) => x.id === id);
    dispatch({ type: 'deleteItem', id });
    setDraft(null);
    toast('Slettet', item ? { action: { label: 'Fortryd', onClick: () => dispatch({ type: 'saveItem', item }) } } : undefined);
  };

  return (
    <div className="flex flex-col gap-5">
      <Overview state={state} dispatch={dispatch} />
      <VerdictCard verdict={verdict} onApply={apply} />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <MonthlyChart state={state} m={m} rec={verdict.rec} />
          <AccountChart state={state} today={today} scen={scen} setScen={setScen} onUse={(total) => apply({ kind: 'usedep', total, label: '' })} />
          <Budgets state={state} m={m} onAdd={openNew} onEdit={(it) => setDraft(draftFromItem(it))} />
          <Settle state={state} />
        </div>
        <div className="order-first flex min-w-0 flex-col gap-5 xl:sticky xl:top-5 xl:order-none">
          <AccountCard state={state} dispatch={dispatch} onChange={() => setScen(null)} />
        </div>
      </div>
      <ItemSheet state={state} draft={draft} onClose={() => setDraft(null)} onSave={save} onDelete={remove} />
    </div>
  );
}
