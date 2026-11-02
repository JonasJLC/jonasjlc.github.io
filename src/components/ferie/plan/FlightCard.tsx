import { ExternalLinkIcon, PlaneIcon, PlusIcon } from 'lucide-react';
import { WEEKDAYS, fmtShort, toTime } from '../lib/dates';
import { kr } from '../lib/kasse';
import { PLAN_STATUS, flightLabel, fmtMins, safeUrl } from '../lib/plan';
import type { Flight, PlanItem } from '../lib/types';
import { cn } from '../lib/utils';
import { IconChip } from '../page';

export const STATUS_STYLE: Record<PlanItem['status'], string> = {
  idea: 'bg-muted text-muted-foreground',
  tobook: 'bg-caution-tint text-caution',
  booked: 'bg-ok-tint text-ok-ink',
};

const dayLabel = (day: string | null) => {
  if (!day) return 'Ingen dag';
  const t = toTime(day);
  return `${WEEKDAYS[new Date(t).getUTCDay()].slice(0, 3)}. ${fmtShort(t)}`;
};

/** The dashed flight path with the plane riding in the middle. */
function Path({ children, small = false }: { children?: React.ReactNode; small?: boolean }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1.5" aria-hidden>
      <i className="size-1.5 shrink-0 rounded-full border-[1.5px] border-cat-transport" />
      <i className="h-0 min-w-3 flex-1 border-t-[1.5px] border-dashed border-cat-transport/45" />
      <span className={cn('flex shrink-0 items-center justify-center rounded-full bg-cat-transport-tint text-cat-transport-ink', small ? 'size-6' : 'h-7 px-2.5')}>
        <PlaneIcon className={small ? 'size-3.5' : 'size-4'} strokeWidth={2} />
        {children}
      </span>
      <i className="h-0 min-w-3 flex-1 border-t-[1.5px] border-dashed border-cat-transport/45" />
      <i className="size-1.5 shrink-0 rounded-full bg-cat-transport" />
    </span>
  );
}

const Code = ({ code, className }: { code: string; className?: string }) => (
  <span className={cn('block font-semibold tracking-[-0.03em] tabular-nums', !code && 'text-muted-foreground', className)}>{code || '–––'}</span>
);

/**
 * A flight as a boarding pass: the two airports big, times under them, the flight path and
 * duration between, and a torn-off stub with the booking reference, price and link.
 * `notch` is the colour of the surface the card sits on, so the punched holes read as holes.
 */
export function FlightCard({ item, onEdit, notch = 'bg-panel' }: { item: PlanItem & { flight: Flight }; onEdit: (it: PlanItem) => void; notch?: string }) {
  const f = item.flight;
  const status = PLAN_STATUS.find((s) => s.value === item.status)!;
  const carrier = [f.airline, f.no].filter(Boolean).join(' · ');
  const dur = fmtMins(f.mins);
  const stub = [f.ref && { k: 'Booking', v: <span className="tracking-[0.08em]">{f.ref}</span> }, (item.price ?? 0) > 0 && { k: 'Pris', v: kr(item.price!) }]
    .filter(Boolean) as { k: string; v: React.ReactNode }[];
  return (
    <article className="relative min-w-0 rounded-card bg-card shadow-card">
      <button
        type="button"
        onClick={() => onEdit(item)}
        aria-label={`${flightLabel(item)}. ${status.label}. Ret`}
        className="block w-full rounded-t-card px-4 pt-4 pb-4 text-left transition-colors hover:bg-accent/50 sm:px-5"
      >
        <span className="flex items-center gap-2.5">
          <IconChip tone="bg-cat-transport-tint text-cat-transport-ink"><PlaneIcon /></IconChip>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{carrier || item.title || 'Fly'}</span>
            <span className="block text-xs text-muted-foreground">{dayLabel(item.day)}</span>
          </span>
          <span className={cn('h-6 shrink-0 rounded-full px-2.5 text-xs leading-6 font-medium', STATUS_STYLE[item.status])}>{status.label}</span>
        </span>
        <span className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(64px,1.1fr)_minmax(0,1fr)] items-end gap-2" aria-hidden>
          <span className="min-w-0">
            <span className="block truncate text-xs text-muted-foreground">{f.fromCity || 'Fra'}</span>
            <Code code={f.from} className="text-[34px] leading-[38px] sm:text-[40px] sm:leading-[44px]" />
            <span className="block text-[15px] font-medium tabular-nums">{f.dep || '–:–'}</span>
          </span>
          <span className="flex min-w-0 flex-col items-center gap-1.5 pb-1">
            <Path />
            <span className="text-xs whitespace-nowrap text-muted-foreground">{dur || 'Flyvetid'}</span>
          </span>
          <span className="min-w-0 text-right">
            <span className="block truncate text-xs text-muted-foreground">{f.toCity || 'Til'}</span>
            <Code code={f.to} className="text-[34px] leading-[38px] sm:text-[40px] sm:leading-[44px]" />
            <span className="block text-[15px] font-medium tabular-nums">
              {f.arr || '–:–'}{f.arrPlus ? <sup className="ml-0.5 text-[10px] font-semibold text-cat-transport-ink">+1</sup> : null}
            </span>
          </span>
        </span>
      </button>
      {(stub.length > 0 || item.link) && (
        <>
          <div className="relative mx-4 border-t-[1.5px] border-dashed border-rule sm:mx-5" aria-hidden>
            <i className={cn('absolute -top-[9px] -left-[25px] size-4 rounded-full sm:-left-[29px]', notch)} />
            <i className={cn('absolute -top-[9px] -right-[25px] size-4 rounded-full sm:-right-[29px]', notch)} />
          </div>
          <div className="flex min-h-11 items-center gap-5 px-4 py-2 text-xs sm:px-5">
            {stub.map((s) => (
              <span key={s.k} className="flex flex-col">
                <span className="text-muted-foreground">{s.k}</span>
                <span className="font-medium tabular-nums">{s.v}</span>
              </span>
            ))}
            {item.link && (
              <a
                href={safeUrl(item.link)}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-full px-3 font-medium text-cat-transport-ink hover:bg-cat-transport-tint"
              >
                Åbn booking<ExternalLinkIcon className="size-3.5" aria-hidden />
              </a>
            )}
          </div>
        </>
      )}
    </article>
  );
}

/** The flight as one line inside a day: `CPH 07:40 ─✈─ RVN 11:05`. */
export function FlightLine({ f }: { f: Flight }) {
  return (
    <span className="flex min-w-0 max-w-[340px] items-center gap-2" aria-hidden>
      <span className="flex items-baseline gap-1.5">
        <Code code={f.from} className="text-[15px]" />
        <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">{f.dep}</span>
      </span>
      <Path small />
      <span className="flex items-baseline gap-1.5">
        <Code code={f.to} className="text-[15px]" />
        <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">{f.arr}{f.arrPlus ? '+1' : ''}</span>
      </span>
    </span>
  );
}

/** Placeholder where the flights go, when none have been added. */
export function AddFlight({ onAdd, label = 'Tilføj fly' }: { onAdd: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="flex min-h-[132px] w-full flex-col items-center justify-center gap-2 rounded-card border-[1.5px] border-dashed border-input text-sm text-muted-foreground transition-colors hover:border-cat-transport hover:bg-cat-transport-tint/50 hover:text-cat-transport-ink"
    >
      <span className="flex items-center gap-1.5 font-medium"><PlusIcon className="size-4" aria-hidden />{label}</span>
      <span className="text-xs">Lufthavne, tider og flynummer</span>
    </button>
  );
}
