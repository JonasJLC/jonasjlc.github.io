import { useState, type ReactNode } from 'react';
import { kr } from './lib/kasse';
import type { Who } from './lib/types';
import { cn } from './lib/utils';

/** Each screen's title row: the serif h1, one sentence with the screen's finding, and its real actions. */
export function PageTitle({ title, children, actions }: { title: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 lg:mb-8">
      <div className="min-w-0 max-w-[68ch]">
        <h1 className="title-serif text-[32px] sm:text-[40px]">{title}</h1>
        {children && <p className="mt-2 text-[15px] leading-6 text-muted-foreground">{children}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** A heading for a group of panels, sitting on the sheet above them. */
export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn('mb-3 text-[15px] leading-6 font-semibold', className)}>{children}</h2>;
}

/** A krone amount with the unit as a smaller grey suffix. */
export function Money({ value, className, sign = false }: { value: number; className?: string; sign?: boolean }) {
  const s = kr(Math.abs(value));
  const num = s.slice(0, s.lastIndexOf(' '));
  const neg = Math.round(value) < 0;
  return (
    <span className={cn('whitespace-nowrap tabular-nums', className)}>
      {neg ? '−' : sign && Math.round(value) > 0 ? '+' : ''}{num}
      <span className="ml-[0.18em] text-[max(11px,0.62em)] font-normal text-muted-foreground">kr.</span>
    </span>
  );
}

/** Who a trip is for, as the people's own dots. */
export function PersonDots({ who, className }: { who: Who; className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 gap-0.5', className)} aria-hidden>
      {(who === 'both' || who === 'a') && <i className="size-1.5 rounded-full bg-person-a" />}
      {(who === 'both' || who === 'b') && <i className="size-1.5 rounded-full bg-person-b" />}
    </span>
  );
}

const PERSON_TONE = {
  a: 'bg-person-a-tint text-person-a',
  b: 'bg-person-b-tint text-person-b',
} as const;

const PERSON_PHOTO = {
  a: '/ferie/avatars/camilla.jpg',
  b: '/ferie/avatars/jonas.jpg',
} as const;

/** One person's photo, cropped round; their initial in a pale tint stands in if the photo is missing. */
export function Avatar({ k, name, className }: { k: 'a' | 'b'; name: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  const base = 'flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px] font-semibold ring-2 ring-card';
  if (!broken) {
    return (
      <span className={cn(base, 'bg-muted', className)} aria-hidden>
        <img src={PERSON_PHOTO[k]} alt="" className="size-full object-cover" loading="lazy" decoding="async" onError={() => setBroken(true)} />
      </span>
    );
  }
  return (
    <span className={cn(base, PERSON_TONE[k], className)} aria-hidden>
      {name.trim().charAt(0).toUpperCase() || (k === 'a' ? 'A' : 'B')}
    </span>
  );
}

/** Who a trip is for, as overlapping initials. `names` is looked up by the caller (personName). */
export function Avatars({ who, names, className, size }: { who: Who; names: { a: string; b: string }; className?: string; size?: string }) {
  return (
    <span className={cn('flex shrink-0', className)} aria-hidden>
      {(who === 'both' || who === 'a') && <Avatar k="a" name={names.a} className={size} />}
      {(who === 'both' || who === 'b') && <Avatar k="b" name={names.b} className={cn(who === 'both' && '-ml-1.5', size)} />}
    </span>
  );
}

/** A small tinted square holding an icon; `tone` is a pair of bg/text classes. */
export function IconChip({ children, tone = 'bg-muted text-foreground', className }: { children: ReactNode; tone?: string; className?: string }) {
  return (
    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-[10px] [&_svg]:size-4', tone, className)} aria-hidden>
      {children}
    </span>
  );
}
