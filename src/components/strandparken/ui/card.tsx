import type { ComponentProps } from 'react';
import { cn } from '../lib/utils';

/** White card on the ground: no border, no shadow (UI spec §5.3). Only the hero card gets a shadow, and that is added where it is used. */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card" className={cn('rounded-sp-card bg-sp-surface p-sp-pad-card', className)} {...props} />;
}

/** A row inside a card or list group. Rows are separated by a 1 px soft rule, never by boxes inside boxes. */
export function CardRow({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-row" className={cn('border-t border-sp-line-soft first:border-t-0', className)} {...props} />;
}
