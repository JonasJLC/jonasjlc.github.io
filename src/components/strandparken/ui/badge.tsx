import type { ComponentProps } from 'react';
import { cn } from '../lib/utils';
import { people, type Person } from '../lib/people';

const shape = 'sp-caption-strong inline-flex min-h-6 items-center whitespace-nowrap rounded-sp-pill px-2.5';

const tones = {
  neutral: 'bg-sp-track text-sp-ink',
  positive: 'bg-sp-primary-tint text-sp-primary',
  danger: 'bg-sp-danger-tint text-sp-danger',
} as const;

type BadgeProps = ComponentProps<'span'> &
  ({ tone?: keyof typeof tones; person?: never } | { tone: 'person'; person: Person | 'shared' });

/** Pill label. `person` badges carry the name (`Fælles` for the shared one), so colour never carries meaning alone. */
export function Badge({ tone = 'neutral', person, className, children, ...props }: BadgeProps) {
  const look = tone === 'person' ? (person === 'shared' ? 'bg-sp-primary text-sp-on-primary' : `${people[person!].fill} text-sp-on-primary`) : tones[tone];
  return (
    <span data-slot="badge" className={cn(shape, look, className)} {...props}>
      {children}
    </span>
  );
}
