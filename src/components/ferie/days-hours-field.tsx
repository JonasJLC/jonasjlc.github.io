import { fmtN } from './lib/dates';
import type { Settings, Unit } from './lib/types';
import { fmtHours, hoursPerDay, parseDays, toInput } from './lib/units';
import { LabeledField } from './labeled-field';
import { Input } from './ui/input';
import { Segmented } from './ui/segmented';

export const unitOptions = [
  { value: 'days' as Unit, label: 'Dage' },
  { value: 'hours' as Unit, label: 'Timer' },
];

/** Toggle for which unit number fields are typed in. */
export function UnitToggle({ unit, onChange }: { unit: Unit; onChange: (u: Unit) => void }) {
  return <Segmented label="Indtast i" value={unit} onValueChange={onChange} options={unitOptions} />;
}

/** Number input holding a value in days, typed as days or hours; shows the other unit as a hint. */
export function DaysHoursField({
  label, days, onDays, settings, className,
}: {
  label: string; days: number; onDays: (d: number) => void; settings: Pick<Settings, 'unit' | 'hoursPerDay'>; className?: string;
}) {
  const { unit } = settings;
  const other = unit === 'hours' ? `= ${fmtN(days)} dage` : `= ${fmtHours(days, settings)}`;
  return (
    <LabeledField label={`${label} (${unit === 'hours' ? 'timer' : 'dage'})`} hint={other} className={className}>
      <Input
        key={`${unit}-${hoursPerDay(settings).toFixed(4)}`}
        inputMode="decimal"
        defaultValue={toInput(days, unit, settings)}
        onChange={(e) => {
          const d = parseDays(e.target.value, unit, settings);
          onDays(Number.isNaN(d) ? 0 : d);
        }}
      />
    </LabeledField>
  );
}
