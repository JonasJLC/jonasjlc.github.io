import { Avatar as AvatarPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../lib/utils';
import { people, type Person } from '../lib/people';

/** 44 header, 34 card header, 30 rows (UI spec §5.15). */
const sizes = {
  44: { box: 'size-sp-target', text: 'sp-button' },
  34: { box: 'size-8.5', text: 'sp-button-sm' },
  30: { box: 'size-7.5', text: 'sp-caption-strong' },
} as const;

type AvatarProps = Omit<ComponentProps<'span'>, 'children'> & {
  person: Person;
  size?: keyof typeof sizes;
  /** Hide from assistive tech when a visible name or a labelled button already says who this is. */
  decorative?: boolean;
};

/** The person's photo, or their initial in white on their colour when the photo is missing or fails to load. */
export function Avatar({ person, size = 44, decorative = false, className, ...props }: AvatarProps) {
  const p = people[person];
  const s = sizes[size];
  const a11y = decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': p.name };
  return (
    <AvatarPrimitive.Root data-slot="avatar" className={cn('relative inline-flex shrink-0 overflow-hidden rounded-full', s.box, p.fill, className)} {...a11y} {...props}>
      <AvatarPrimitive.Image src={p.photo} alt="" className="size-full object-cover" />
      <AvatarPrimitive.Fallback className={cn('flex size-full items-center justify-center text-sp-on-primary', s.text)}>{p.initial}</AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

/** The header avatar: a real button (44 px target) that says what it opens. */
export function AvatarButton({ person, label, className, ...props }: Omit<ComponentProps<'button'>, 'children' | 'aria-label'> & { person: Person; label: string }) {
  return (
    <button type="button" aria-label={label} data-slot="avatar-button" className={cn('inline-flex size-sp-target shrink-0 rounded-full', className)} {...props}>
      <Avatar person={person} decorative />
    </button>
  );
}
