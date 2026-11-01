import { useState } from 'react';
import { whoKeys } from '../lib/balance';
import { fmtLong, fmtN, todayTime } from '../lib/dates';
import { earliestAffordable } from '../lib/finder';
import type { FerieState, Who } from '../lib/types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Segmented } from '../ui/segmented';
import { UnitToggle } from '../days-hours-field';
import { fmtHours, parseDays } from '../lib/units';
import type { Action } from '../lib/use-ferie';
import { whoOptions } from './helpers';

export function Finder({ state, dispatch, onCreate }: { state: FerieState; dispatch: React.Dispatch<Action>; onCreate: (from: number, days: number, who: Who) => void }) {
  const [raw, setRaw] = useState('5');
  const [who, setWho] = useState<Who>('both');
  const { unit } = state.settings;
  const days = parseDays(raw, unit, state.settings);
  const valid = raw.trim() !== '' && !Number.isNaN(days) && days > 0;
  const found = valid ? earliestAffordable(state, days, whoKeys(who), todayTime()) : null;

  return (
    <section aria-labelledby="finder-h" className="flex flex-col gap-4 rounded-panel bg-panel p-5">
      <div>
        <h2 id="finder-h" className="text-[15px] leading-6 font-semibold">Hvornår har vi råd?</h2>
        <p className="text-sm text-muted-foreground">Den første arbejdsdag, hvor turen kan lade sig gøre uden at gå ud over de planlagte rejser.</p>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <label htmlFor="finder-n" className="sr-only">{unit === 'hours' ? 'Antal ferietimer' : 'Antal feriedage'}</label>
          <Input id="finder-n" inputMode="decimal" className="w-20 shrink-0 text-center" value={raw} onChange={(e) => setRaw(e.target.value)} />
          <UnitToggle unit={unit} onChange={(u) => dispatch({ type: 'settings', patch: { unit: u } })} />
        </div>
        <Segmented label="Hvem" value={who} onValueChange={setWho} options={whoOptions(state)} />
      </div>
      <div aria-live="polite" className="mt-auto border-t border-rule pt-4">
        {!valid ? (
          <p className="text-sm text-muted-foreground">Skriv et antal {unit === 'hours' ? 'timer' : 'dage'}.</p>
        ) : found === null ? (
          <p className="text-sm font-medium text-warn">Det kan ikke lade sig gøre inden for de næste par år.</p>
        ) : (
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{fmtN(days)} dage ({fmtHours(days, state.settings)}) kan tidligst bruges</p>
              <p className="text-2xl leading-8 first-letter:uppercase">{fmtLong(found)}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => onCreate(found, days, who)}>Lav rejse herfra</Button>
          </div>
        )}
      </div>
    </section>
  );
}
