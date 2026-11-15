import type { ComponentProps } from 'react';
import { cn } from '../lib/utils';

type ChipProps = Omit<ComponentProps<'button'>, 'aria-pressed'> & { selected: boolean };

/** Toggle pill for filters (UI spec §5.9). A real button; `aria-pressed` carries the state so colour is never the only signal. */
export function Chip({ selected, className, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      data-slot="chip"
      className={cn(
        'sp-button-sm inline-flex min-h-sp-target items-center justify-center whitespace-nowrap rounded-sp-pill px-4',
        selected ? 'bg-sp-primary text-sp-on-primary active:bg-sp-primary-pressed' : 'bg-sp-surface text-sp-ink active:bg-sp-track',
        className,
      )}
      {...props}
    />
  );
}
