import type { ReactNode } from 'react';
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
