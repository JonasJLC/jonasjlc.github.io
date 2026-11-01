import { X } from 'lucide-react';
import { fmtN, fmtRange, toISO } from '../lib/dates';
import type { FerieState } from '../lib/types';
import { Button } from '../ui/button';
import { fmtHours } from '../lib/units';
import { fmtDaysRange, impact, personColor, personName } from './helpers';
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
      className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-2xl animate-[rise_.2s_ease-out] rounded-2xl border bg-card p-3 shadow-2xl md:bottom-4"
      role="region"
      aria-label="Valgte datoer"
    >
      <div className="flex items-center gap-3" aria-live="polite">
        <div className="min-w-0 flex-1">
          <b className="block truncate font-display text-lg leading-tight">
            {ready ? fmtRange(a, b, year) : 'Vælg slutdato'}
          </b>
          {ready ? (
            <span className="text-sm text-muted-foreground">
              Koster <b className="text-foreground">{fmtDaysRange(costs)}</b> feriedag{cost === 1 ? '' : 'e'} ({fmtHours(cost, state.settings)})
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">Tryk på den sidste dag i rejsen</span>
          )}
        </div>
        <Button variant="ghost" size="icon" aria-label="Ryd valg" onClick={onClear}><X className="size-5" /></Button>
        <Button onClick={onContinue} disabled={!ready}>Fortsæt</Button>
      </div>
      {ready && (
        <ul className="mt-2 flex flex-wrap gap-2 text-xs">
          {chips.map((c) => {
            const ok = !c.short && !c.squeezes;
            return (
              <li
                key={c.k}
                className={`rounded-full border px-2.5 py-1 font-semibold ${ok ? 'text-ok' : 'text-warn'}`}
              >
                <i className="mr-1.5 inline-block size-2 rounded-full" style={{ background: personColor(c.k) }} />
                {personName(state, c.k)}: {fmtN(c.after)} ({fmtHours(c.after, state.settings)}) efter {ok ? '✓' : c.short ? '– for få dage' : '– senere rejse bliver for dyr'}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
