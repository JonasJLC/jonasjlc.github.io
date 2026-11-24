import { Switch as SwitchPrimitive } from 'radix-ui';
import { useId, type ComponentProps, type ReactNode } from 'react';
import { cn } from '../lib/utils';

type SwitchProps = Omit<ComponentProps<typeof SwitchPrimitive.Root>, 'children' | 'id'> & {
  /** The visible label. The whole row is the 44 px touch target. */
  label: ReactNode;
  /** An optional line under the label. */
  hint?: ReactNode;
};

/** A labelled on/off row (Radix Switch): track `sp-track`, on `sp-primary`, thumb `sp-surface`. Space toggles it. */
export function Switch({ label, hint, className, ...props }: SwitchProps) {
  const id = useId();
  return (
    <div data-slot="switch" className={cn('flex min-h-sp-target items-center justify-between gap-3', className)}>
      <label htmlFor={id} className="flex min-w-0 flex-1 flex-col">
        <span className="sp-body">{label}</span>
        {hint && <span className="sp-small text-sp-muted">{hint}</span>}
      </label>
      <SwitchPrimitive.Root
        id={id}
        className={cn(
          'relative inline-flex h-7.5 w-12.5 shrink-0 items-center rounded-sp-pill bg-sp-track p-0.5',
          'data-[state=checked]:bg-sp-primary disabled:pointer-events-none disabled:opacity-45',
        )}
        {...props}
      >
        <SwitchPrimitive.Thumb className="block size-6.5 rounded-full bg-sp-surface shadow-sp-seg transition-transform motion-reduce:transition-none data-[state=checked]:translate-x-5" />
      </SwitchPrimitive.Root>
    </div>
  );
}
