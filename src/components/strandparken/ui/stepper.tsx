import { Minus, Plus } from 'lucide-react';
import { canDecrement, canIncrement, personLimits, personsLabel, step, type Limits } from '../lib/stepper';
import { cn } from '../lib/utils';
import { Icon } from './icon';

type StepperProps = {
  value: number;
  onChange: (value: number) => void;
  limits?: Limits;
  className?: string;
};

/** Identical everywhere: the label on the left, a primary pill with 44 px minus and plus on the right (UI spec §5.9). */
const stepButton =
  'inline-flex size-sp-target items-center justify-center rounded-full text-sp-on-primary active:bg-sp-primary-pressed ' +
  'aria-disabled:pointer-events-none aria-disabled:opacity-45 focus-visible:outline-sp-on-primary focus-visible:outline-offset-0';

export function Stepper({ value, onChange, limits = personLimits, className }: StepperProps) {
  const lower = canDecrement(value, limits);
  const higher = canIncrement(value, limits);
  return (
    <div data-slot="stepper" className={cn('flex items-center justify-between', className)}>
      {/* The live region announces the new count ("3 personer") each time it changes. */}
      <span aria-live="polite" className="sp-body-strong">{personsLabel(value)}</span>
      <div className="flex items-center gap-1 rounded-sp-pill bg-sp-primary p-0.75 text-sp-on-primary">
        {/* aria-disabled instead of disabled, so a keyboard user pressing up to the limit keeps focus. */}
        <button type="button" aria-label="Færre personer" aria-disabled={!lower} className={stepButton} onClick={() => lower && onChange(step(value, -1, limits))}>
          <Icon icon={Minus} />
        </button>
        <span aria-hidden="true" className="sp-stepper-value min-w-5.5 text-center">{value}</span>
        <button type="button" aria-label="Flere personer" aria-disabled={!higher} className={stepButton} onClick={() => higher && onChange(step(value, 1, limits))}>
          <Icon icon={Plus} />
        </button>
      </div>
    </div>
  );
}
