import { Check } from 'lucide-react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../lib/utils';
import { Icon } from './icon';

type CheckboxProps = Omit<ComponentProps<typeof CheckboxPrimitive.Root>, 'children' | 'aria-label' | 'aria-labelledby'> & {
  /** Round for tasks and shopping rows, square for habits: told apart by shape alone (UI spec §5.7). */
  shape?: 'round' | 'square';
} & ({ 'aria-label': string; 'aria-labelledby'?: never } | { 'aria-labelledby': string; 'aria-label'?: never });

/** The root is the 44 px touch target; the visible box inside is 26 px. */
export function Checkbox({ shape = 'round', className, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      data-shape={shape}
      className={cn('group inline-flex size-sp-target shrink-0 items-center justify-center rounded-full disabled:pointer-events-none disabled:opacity-45', className)}
      {...props}
    >
      <span
        className={cn(
          'sp-border-strong flex size-6.5 items-center justify-center border-sp-dash bg-sp-surface',
          shape === 'round' ? 'rounded-full' : 'rounded-sp-check',
          'group-data-[state=checked]:border-sp-primary group-data-[state=checked]:bg-sp-primary',
        )}
      >
        <CheckboxPrimitive.Indicator asChild>
          <Icon icon={Check} size={16} strokeWidth={2.6} className="animate-sp-tick text-sp-on-primary" />
        </CheckboxPrimitive.Indicator>
      </span>
    </CheckboxPrimitive.Root>
  );
}
