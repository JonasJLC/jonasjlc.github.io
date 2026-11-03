import type { Action } from '../lib/use-ferie';
import { PERSON_KEYS, type FerieState, type Person, type PersonKey } from '../lib/types';
import { LabeledField as Field } from '../labeled-field';
import { Input } from '../ui/input';
import { ResponsiveSheet } from '../ui/sheet';
import { Checkbox } from '../ui/checkbox';
import { toTime } from '../lib/dates';
import { DAYS_OFF } from '../lib/holidays';
import { DaysHoursField, UnitToggle } from '../days-hours-field';
import { toInput } from '../lib/units';
import { Avatar } from '../page';
import { personName } from './helpers';

const fyLabel = (y: number) => `${y}/${String((y + 1) % 100).padStart(2, '0')}`;

const MONTHS = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'];

const num = (v: string) => (v.trim() === '' ? 0 : Number(v.replace(',', '.')) || 0);

export function SettingsSheet({
  open, onOpenChange, state, dispatch,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; state: FerieState; dispatch: React.Dispatch<Action>;
}) {
  const set = (k: PersonKey, patch: Partial<Person>) => dispatch({ type: 'person', k, patch });
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title="Indstillinger" description="Feriesaldo, optjening og faste fridage for hver person.">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 rounded-2xl bg-panel p-4">
          <span className="text-sm font-medium">Indtast ferie i</span>
          <UnitToggle unit={state.settings.unit} onChange={(unit) => dispatch({ type: 'settings', patch: { unit } })} />
          <Field label="Timer pr. feriedag" hint="2,08 feriedage svarer til 15,41 ferietimer.">
            <Input
              key={state.settings.unit}
              inputMode="decimal"
              defaultValue={toInput(1, 'hours', state.settings)}
              onChange={(e) => { const v = num(e.target.value); if (v > 0) dispatch({ type: 'settings', patch: { hoursPerDay: v } }); }}
            />
          </Field>
        </div>
        {PERSON_KEYS.map((k) => {
          const p = state.settings.people[k];
          const asOf = toTime(p.asOf);
          const asY = Number.isNaN(asOf) ? state.settings.year : new Date(asOf).getUTCFullYear();
          const fy = Number.isNaN(asOf) ? asY : new Date(asOf).getUTCMonth() >= 8 ? asY : asY - 1;
          return (
            <fieldset key={k} className="rounded-2xl bg-panel p-4">
              <legend className="sr-only">{personName(state, k)}</legend>
              <p aria-hidden className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
                <Avatar k={k} name={personName(state, k)} className="ring-0" />{personName(state, k)}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Navn" className="col-span-2">
                  <Input value={p.name} maxLength={30} placeholder={personName(state, k)} onChange={(e) => set(k, { name: e.target.value })} />
                </Field>
                <Field label="Saldo gælder pr." hint="Datoen på lønsedlen, tallene er fra." className="col-span-2">
                  <Input type="date" value={p.asOf} onChange={(e) => e.target.value && set(k, { asOf: e.target.value })} />
                </Field>
                <DaysHoursField label={`Rest fra ferieår ${fyLabel(fy - 1)}`} days={p.prev} settings={state.settings} onDays={(d) => set(k, { prev: d })} />
                <DaysHoursField label={`Optjent i ferieår ${fyLabel(fy)}`} days={p.curr} settings={state.settings} onDays={(d) => set(k, { curr: d })} />
                <DaysHoursField label="Optjening pr. måned" days={p.rate} settings={state.settings} onDays={(d) => set(k, { rate: d })} />
                <DaysHoursField label="Feriefridage pr. år" days={p.ff} settings={state.settings} onDays={(d) => set(k, { ff: d })} />
                <Field label="Feriefridage tildeles" hint="Den 1. i måneden, hvert år.">
                  <select
                    value={p.ffMonth}
                    onChange={(e) => set(k, { ffMonth: Number(e.target.value) })}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                  >
                    {MONTHS.map((m, i) => <option key={m} value={i + 1}>1. {m}</option>)}
                  </select>
                </Field>
                <DaysHoursField label={`Feriefridage tilbage i ${asY}`} days={p.ffOpen} settings={state.settings} onDays={(d) => set(k, { ffOpen: d })} className="col-span-2" />
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <span className="text-sm font-medium">Faste fridage ud over helligdage</span>
                <div className="grid grid-cols-2 gap-2">
                  {DAYS_OFF.map((d) => (
                    <label key={d.md} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={p.daysOff.includes(d.md)}
                        onCheckedChange={(v) => set(k, { daysOff: DAYS_OFF.map((x) => x.md).filter((md) => (md === d.md ? v === true : p.daysOff.includes(md))) })}
                      />
                      {d.name}
                    </label>
                  ))}
                </div>
              </div>
            </fieldset>
          );
        })}
        <p className="text-xs text-muted-foreground">
          Ferie optjenes 1. sep.–31. aug. og kan holdes, mens den optjenes, og frem til 31. dec. året efter.
          Feriefridage tildeles på den valgte dato og udløber 31. dec. samme år. Ferie trækkes fra det, der udløber først,
          og ved samme dato bruges feriefridagene først. Det, der ikke er holdt ved udløb, regnes som udløbet,
          også selv om op til 5 dage kan overføres til næste år (det er ikke med i beregningen).
          Næste optjening lægges til ved udgangen af måneden efter saldodatoen.
        </p>
      </div>
    </ResponsiveSheet>
  );
}
