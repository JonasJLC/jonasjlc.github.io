import { X } from 'lucide-react';
import { fmtN, fmtRange, toISO } from '../lib/dates';
import type { FerieState } from '../lib/types';
import { Button } from '../ui/button';
import { fmtHours } from '../lib/units';
import { fmtDaysRange, impact, personName } from './helpers';
import type { Selection } from './YearCalendar';

export function SelectionBar({
  state, selection, onClear, onContinue,
}: {
  state: FerieState; selection: Selection; onClear: () => void; onContinue: () => void;
}) {
  if (selection.from === null) return null;
  const { year } = state.settings;
  const ready = selection.to !== null;
  const a = Math.min(selection.from, selection.to ?? selection.from);
  const b = Math.max(selection.from, selection.to ?? selection.from);
  const chips = ready ? impact(state, 'both', { from: toISO(a), to: toISO(b), days: null }) : [];
  const costs = chips.map((c) => c.days);
  const cost = Math.max(0, ...costs);

  return (
    <div
      className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-xl animate-[rise_.2s_ease-out] rounded-2xl border bg-card p-3 pl-4 shadow-[0_16px_48px_rgba(0,0,0,.16)] lg:right-2 lg:bottom-6 lg:left-56"
      role="region"
      aria-label="Valgte datoer"
    >
      <div className="flex items-center gap-2" aria-live="polite">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] leading-6 font-semibold">
            {ready ? fmtRange(a, b, year) : 'Vælg sidste dag'}
          </p>
          {ready ? (
            <p className="text-xs text-muted-foreground">
              Koster <span className="text-foreground">{fmtDaysRange(costs)}</span> feriedag{cost === 1 ? '' : 'e'} ({fmtHours(cost, state.settings)})
              {chips.map((c) => {
                const ok = !c.short && !c.squeezes;
                return (
                  <span key={c.k} className={ok ? undefined : 'text-warn'}>
                    {' · '}{personName(state, c.k)} {fmtN(c.after)} efter{ok ? '' : c.short ? ', for få dage' : ', en senere rejse bliver for dyr'}
                  </span>
                );
              })}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Tryk på den sidste dag i rejsen</p>
          )}
        </div>
        <Button variant="ghost" size="icon" aria-label="Ryd valg" onClick={onClear}><X className="size-5" /></Button>
        <Button onClick={onContinue} disabled={!ready}>Fortsæt</Button>
      </div>
    </div>
  );
}
