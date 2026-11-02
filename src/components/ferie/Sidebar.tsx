import { ChevronLeft, ChevronRight, Lightbulb, Map, Menu, Moon, Plane, SlidersHorizontal, Sun, Wallet } from 'lucide-react';
import { useState } from 'react';
import { AccountButton, AccountDetails, type SyncProps } from './AccountButton';
import { Mark } from './Mark';
import { personName } from './feriedage/helpers';
import type { FerieState } from './lib/types';
import { cn } from './lib/utils';
import { Avatars } from './page';
import { Button } from './ui/button';
import { ResponsiveSheet } from './ui/sheet';

export const VIEWS = [
  { value: 'feriedage', label: 'Feriedage', icon: Plane },
  { value: 'rejsekassen', label: 'Rejsekassen', icon: Wallet },
  { value: 'rejseplan', label: 'Rejseplan', icon: Map },
  { value: 'forslag', label: 'Forslag', icon: Lightbulb },
] as const;
export type View = (typeof VIEWS)[number]['value'];

export type Theme = 'light' | 'dark';

interface ShellProps {
  state: FerieState;
  view: View;
  year: number;
  onYear: (y: number) => void;
  sync: SyncProps;
  theme: Theme;
  onTheme: () => void;
  onSettings: () => void;
}

/** The two people as initials in their own pale tint. */
export function Couple({ state, className }: { state: FerieState; className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <Avatars who="both" names={{ a: personName(state, 'a'), b: personName(state, 'b') }} size="size-5 text-[10px] ring-frame" />
      <span className="truncate">{personName(state, 'a')} &amp; {personName(state, 'b')}</span>
    </span>
  );
}

function YearSwitch({ year, onYear, className }: { year: number; onYear: (y: number) => void; className?: string }) {
  return (
    <div role="group" aria-label="År" className={cn('inline-flex h-10 items-center rounded-full border border-input bg-background md:h-8', className)}>
      <button type="button" aria-label={`Forrige år, ${year - 1}`} onClick={() => onYear(year - 1)} className="flex h-full w-10 items-center justify-center rounded-full text-muted-foreground hover:text-foreground md:w-8">
        <ChevronLeft className="size-4" aria-hidden />
      </button>
      <span aria-live="polite" className="min-w-10 text-center text-sm font-medium tabular-nums">{year}</span>
      <button type="button" aria-label={`Næste år, ${year + 1}`} onClick={() => onYear(year + 1)} className="flex h-full w-10 items-center justify-center rounded-full text-muted-foreground hover:text-foreground md:w-8">
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </div>
  );
}

const row = 'flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground';

/** Desktop shell: product, household, the screens, the year, and the utilities at the foot. */
export function Sidebar({ state, view, year, onYear, sync, theme, onTheme, onSettings }: ShellProps) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col px-3 pt-6 pb-4 lg:flex">
      <div className="flex items-center gap-2 px-2.5">
        <Mark className="size-7 shrink-0 text-foreground" />
        <span className="text-[15px] font-semibold">Ferieplan</span>
      </div>
      <Couple state={state} className="mt-2 px-2.5 text-[13px] text-muted-foreground" />

      <nav aria-label="Ferieplan" className="mt-8 flex flex-col gap-0.5">
        {VIEWS.map(({ value, label, icon: Icon }) => (
          <a
            key={value}
            href={`#${value}`}
            aria-current={view === value ? 'page' : undefined}
            className={cn(row, 'h-10', view === value && 'bg-card font-medium text-foreground shadow-card hover:bg-card')}
          >
            <Icon className={cn('size-4 shrink-0', view === value && 'text-data')} aria-hidden strokeWidth={view === value ? 2 : 1.75} />
            {label}
          </a>
        ))}
      </nav>

      <div className="mt-8 px-2.5">
        <p className="mb-2 text-xs text-muted-foreground">År</p>
        <YearSwitch year={year} onYear={onYear} />
      </div>

      <div className="mt-auto flex flex-col gap-0.5">
        <AccountButton {...sync} className={row} />
        <button type="button" className={row} onClick={onSettings}>
          <SlidersHorizontal className="size-4 shrink-0" aria-hidden strokeWidth={1.75} />
          Indstillinger
        </button>
        <button type="button" className={row} onClick={onTheme}>
          {theme === 'dark' ? <Sun className="size-4 shrink-0" aria-hidden strokeWidth={1.75} /> : <Moon className="size-4 shrink-0" aria-hidden strokeWidth={1.75} />}
          {theme === 'dark' ? 'Lyst tema' : 'Mørkt tema'}
        </button>
      </div>
    </aside>
  );
}

/** Phone and tablet shell: a top bar with the year and a menu, the screens as a bottom bar. */
export function TopBar({ state, view, year, onYear, sync, theme, onTheme, onSettings }: ShellProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 bg-frame px-4 sm:px-6 lg:hidden">
        <Mark className="size-7 shrink-0 text-foreground" />
        <span className="mr-auto text-[15px] font-semibold">Ferieplan</span>
        <YearSwitch year={year} onYear={onYear} />
        <Button variant="ghost" size="icon" aria-label="Menu" onClick={() => setOpen(true)}>
          <Menu className="size-5" aria-hidden />
        </Button>
      </header>
      <nav
        aria-label="Ferieplan"
        className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 grid grid-cols-4 gap-1 rounded-[22px] bg-card p-1.5 shadow-lift lg:hidden"
      >
        {VIEWS.map(({ value, label, icon: Icon }) => {
          const on = view === value;
          return (
            <a
              key={value}
              href={`#${value}`}
              aria-current={on ? 'page' : undefined}
              className={cn(
                'flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] text-muted-foreground transition-colors',
                on ? 'bg-data-tint font-semibold text-data-ink' : 'hover:text-foreground',
              )}
            >
              <Icon className="size-5" aria-hidden strokeWidth={on ? 2 : 1.75} />
              {label}
            </a>
          );
        })}
      </nav>
      <ResponsiveSheet open={open} onOpenChange={setOpen} title="Menu">
        <div className="flex flex-col gap-6">
          <Couple state={state} className="text-sm" />
          <AccountDetails {...sync} onDone={() => setOpen(false)} />
          <div className="flex flex-col gap-2">
            <Button variant="outline" className="justify-start" onClick={() => { setOpen(false); onSettings(); }}>
              <SlidersHorizontal aria-hidden />Indstillinger
            </Button>
            <Button variant="outline" className="justify-start" onClick={onTheme}>
              {theme === 'dark' ? <Sun aria-hidden /> : <Moon aria-hidden />}
              {theme === 'dark' ? 'Lyst tema' : 'Mørkt tema'}
            </Button>
          </div>
        </div>
      </ResponsiveSheet>
    </>
  );
}
