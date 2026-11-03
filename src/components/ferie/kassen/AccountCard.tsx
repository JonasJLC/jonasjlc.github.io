import { FoldBody, FoldButton, useFold } from '../fold';
import { LabeledField } from '../labeled-field';
import { monthOf, hasSteps } from '../lib/kasse';
import { fmtShort, toTime } from '../lib/dates';
import type { Action } from '../lib/use-ferie';
import type { FerieState } from '../lib/types';
import { Button } from '../ui/button';
import { Card, CardAction, CardHeader, CardTitle } from '../ui/card';
import { Money } from '../page';
import { Field, FieldGroup, FieldLabel } from '../ui/field';
import { Input } from '../ui/input';
import { ResponsiveSheet } from '../ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { parseNum, personName } from './helpers';

/** The account's settings at a glance, and the saved staircase plan. */
export function AccountCard({
  state, dispatch, onChange, onEdit,
}: {
  state: FerieState; dispatch: React.Dispatch<Action>; onChange: () => void; onEdit: () => void;
}) {
  const fold = useFold('account');
  const k = state.kasse;
  const day = +k.depDay === 31 ? 'Sidste dag i måneden' : `D. ${+k.depDay || 1}. i måneden`;
  const rows: [string, React.ReactNode][] = [
    [`Saldo d. ${fmtShort(toTime(k.startDate), true)}`, <Money value={+k.start || 0} />],
    [`${personName(state, 'a')} pr. md.`, <Money value={+k.depA || 0} />],
    [`${personName(state, 'b')} pr. md.`, <Money value={+k.depB || 0} />],
    ['Indskuddet kommer', day],
    ['Margin på estimater', `${+k.margin || 0} %`],
    ['Mindstebeløb', <Money value={+k.buffer || 0} />],
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle><FoldButton folded={fold.folded} onToggle={fold.toggle} controls="account-body">Kontoen</FoldButton></CardTitle>
        {!fold.folded && <CardAction className="row-span-1 self-center"><Button variant="ghost" size="sm" className="-my-1 -mr-2" onClick={onEdit}>Ret</Button></CardAction>}
      </CardHeader>
      <FoldBody id="account-body" folded={fold.folded}>
      <dl className="flex flex-col text-sm">
        {rows.map(([l, v]) => (
          <div key={l} className="flex min-h-8 items-center justify-between gap-3">
            <dt className="text-muted-foreground">{l}</dt>
            <dd className="text-right tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {hasSteps(state) && (
        <div className="flex flex-col gap-2 border-t border-rule pt-4">
          <h3 className="text-sm font-semibold">Trappeplan</h3>
          <ul className="flex flex-col text-sm">
            {k.steps.map((x) => (
              <li key={x.from} className="flex min-h-8 items-center justify-between">
                <span className="text-muted-foreground">Fra {monthOf(state, toTime(`${x.from}-01`))}</span>
                <Money value={x.total} />
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Planen bestemmer det samlede beløb. Indstillingerne bestemmer, hvordan det fordeles mellem jer.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => { dispatch({ type: 'kasse', patch: { steps: [] } }); onChange(); }}
          >
            Fjern trappeplanen
          </Button>
        </div>
      )}
      </FoldBody>
    </Card>
  );
}

/** Balance, monthly deposits, deposit day, margin and minimum. */
export function AccountSheet({
  state, dispatch, onChange, open, onOpenChange,
}: {
  state: FerieState; dispatch: React.Dispatch<Action>; onChange: () => void; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const k = state.kasse;
  return (
      <ResponsiveSheet open={open} onOpenChange={onOpenChange} title="Kontoindstillinger" description="Saldo, månedligt indskud og sikkerhedsmargin.">
        <FieldGroup>
          <div className="grid grid-cols-2 gap-3">
            <LabeledField label="Saldo (kr.)">
              <Input inputMode="decimal" defaultValue={k.start} onChange={(e) => { dispatch({ type: 'kasse', patch: { start: parseNum(e.target.value) ?? 0 } }); onChange(); }} />
            </LabeledField>
            <LabeledField label="Saldoen er fra">
              <Input type="date" value={k.startDate} onChange={(e) => e.target.value && dispatch({ type: 'kasse', patch: { startDate: e.target.value } })} />
            </LabeledField>
            <LabeledField label={`${personName(state, 'a')} pr. md.`}>
              <Input inputMode="decimal" defaultValue={k.depA} onChange={(e) => { dispatch({ type: 'kasse', patch: { depA: parseNum(e.target.value) ?? 0, steps: [] } }); onChange(); }} />
            </LabeledField>
            <LabeledField label={`${personName(state, 'b')} pr. md.`}>
              <Input inputMode="decimal" defaultValue={k.depB} onChange={(e) => { dispatch({ type: 'kasse', patch: { depB: parseNum(e.target.value) ?? 0, steps: [] } }); onChange(); }} />
            </LabeledField>
          </div>
          <Field>
            <FieldLabel htmlFor="depDay">Indskuddet kommer</FieldLabel>
            <Select value={String(k.depDay)} onValueChange={(v) => dispatch({ type: 'kasse', patch: { depDay: +v } })}>
              <SelectTrigger id="depDay" className="h-11 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <SelectItem key={d} value={String(d)}>{d}.</SelectItem>
                ))}
                <SelectItem value="31">Sidste dag i måneden</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <LabeledField label="Margin på estimater (%)" hint="Lægges kun på det, der ikke er betalt endnu.">
              <Input inputMode="decimal" defaultValue={k.margin} onChange={(e) => dispatch({ type: 'kasse', patch: { margin: parseNum(e.target.value) ?? 0 } })} />
            </LabeledField>
            <LabeledField label="Mindstebeløb (kr.)" hint="Kontoen må ikke komme under.">
              <Input inputMode="decimal" defaultValue={k.buffer} onChange={(e) => dispatch({ type: 'kasse', patch: { buffer: parseNum(e.target.value) ?? 0 } })} />
            </LabeledField>
          </div>
        </FieldGroup>
      </ResponsiveSheet>
  );
}
