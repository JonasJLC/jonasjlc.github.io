import type { Action } from '../lib/use-ferie';
import { PERSON_KEYS, type FerieState, type Person, type PersonKey } from '../lib/types';
import { LabeledField as Field } from '../labeled-field';
import { Input } from '../ui/input';
import { ResponsiveSheet } from '../ui/sheet';
import { Switch } from '../ui/switch';
import { personColor, personName } from './helpers';

const num = (v: string) => (v.trim() === '' ? 0 : Number(v.replace(',', '.')) || 0);

export function SettingsSheet({
  open, onOpenChange, state, dispatch,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; state: FerieState; dispatch: React.Dispatch<Action>;
}) {
  const set = (k: PersonKey, patch: Partial<Person>) => dispatch({ type: 'person', k, patch });
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title="Indstillinger" description="Startsaldo og optjening for hver person.">
      <div className="flex flex-col gap-5">
        {PERSON_KEYS.map((k) => {
          const p = state.settings.people[k];
          return (
            <fieldset key={k} className="rounded-xl border p-4">
              <legend className="flex items-center gap-2 px-1 font-display text-lg font-bold">
                <i className="size-3 rounded-full" style={{ background: personColor(k) }} />{personName(state, k)}
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Startsaldo (dage)"><Input inputMode="decimal" defaultValue={p.start} onChange={(e) => set(k, { start: num(e.target.value) })} /></Field>
                <Field label="Optjening pr. måned"><Input inputMode="decimal" defaultValue={p.rate} onChange={(e) => set(k, { rate: num(e.target.value) })} /></Field>
                <Field label="Første optjening"><Input type="month" value={p.first} onChange={(e) => e.target.value && set(k, { first: e.target.value })} /></Field>
                <Field label="Ekstra dage om året"><Input inputMode="decimal" defaultValue={p.extra} onChange={(e) => set(k, { extra: num(e.target.value) })} /></Field>
                <Field label="Ekstra dage i måned (1–12)" className="col-span-2">
                  <Input type="number" min={1} max={12} defaultValue={p.extraMonth} onChange={(e) => set(k, { extraMonth: Math.min(12, Math.max(1, Math.round(num(e.target.value)) || 5)) })} />
                </Field>
              </div>
            </fieldset>
          );
        })}
        <label className="flex items-center justify-between gap-4 rounded-xl border p-4">
          <span>
            <b className="block text-sm">Ekstra fridage</b>
            <span className="text-xs text-muted-foreground">Grundlovsdag, juleaften og nytårsaftensdag tæller ikke som feriedage.</span>
          </span>
          <Switch checked={state.settings.extraOff} onCheckedChange={(v) => dispatch({ type: 'settings', patch: { extraOff: v } })} aria-label="Ekstra fridage" />
        </label>
      </div>
    </ResponsiveSheet>
  );
}
