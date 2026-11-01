import { SettingsIcon } from 'lucide-react';
import { useState } from 'react';
import { LabeledField } from '../labeled-field';
import { monthOf, kr, hasSteps } from '../lib/kasse';
import { toTime } from '../lib/dates';
import type { Action } from '../lib/use-ferie';
import type { FerieState } from '../lib/types';
import { Button } from '../ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Field, FieldGroup, FieldLabel } from '../ui/field';
import { Input } from '../ui/input';
import { ResponsiveSheet } from '../ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { parseNum, personName } from './helpers';

export function AccountCard({
  state, dispatch, onChange,
}: {
  state: FerieState; dispatch: React.Dispatch<Action>; onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const k = state.kasse;
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Kontoen</CardTitle>
          <CardDescription>
            Start: {kr(+k.start || 0)} · Margin {+k.margin || 0} % · Mindst {kr(+k.buffer || 0)}
          </CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              <SettingsIcon data-icon="inline-start" />
              Indstillinger
            </Button>
          </CardAction>
        </CardHeader>
        {hasSteps(state) && (
          <CardContent className="flex flex-col gap-2">
            <b className="text-sm">Trappeplan</b>
            <ul className="flex flex-col divide-y rounded-xl border">
              {k.steps.map((x) => (
                <li key={x.from} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>Fra {monthOf(state, toTime(`${x.from}-01`))}</span>
                  <b className="tabular-nums">{kr(x.total)}</b>
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
          </CardContent>
        )}
      </Card>
      <ResponsiveSheet open={open} onOpenChange={setOpen} title="Kontoindstillinger" description="Saldo, månedligt indskud og sikkerhedsmargin.">
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
    </>
  );
}
