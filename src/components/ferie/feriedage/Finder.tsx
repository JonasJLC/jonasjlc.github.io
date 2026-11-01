import { Search } from 'lucide-react';
import { useState } from 'react';
import { whoKeys } from '../lib/balance';
import { fmtLong, fmtN, todayTime } from '../lib/dates';
import { earliestAffordable } from '../lib/finder';
import type { FerieState, Who } from '../lib/types';
import { Button } from '../ui/button';
import { Field, Input } from '../ui/input';
import { Segmented } from '../ui/toggle-group';
import { whoOptions } from './helpers';

export function Finder({ state, onCreate }: { state: FerieState; onCreate: (from: number, days: number, who: Who) => void }) {
  const [raw, setRaw] = useState('5');
  const [who, setWho] = useState<Who>('both');
  const days = Number(raw.replace(',', '.'));
  const valid = raw.trim() !== '' && !Number.isNaN(days) && days > 0;
  const found = valid ? earliestAffordable(state, days, whoKeys(who), todayTime()) : null;

  return (
    <section aria-label="Hvornår har vi råd?" className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold tracking-tight"><Search className="size-5" aria-hidden />Hvornår har vi råd?</h2>
      <p className="mb-3 mt-1 text-sm text-muted-foreground">
        Find den første arbejdsdag, hvor turen kan lade sig gøre uden at gå ud over de planlagte rejser.
      </p>
      <div className="grid gap-3">
        <Field label="Antal feriedage"><Input inputMode="decimal" value={raw} onChange={(e) => setRaw(e.target.value)} /></Field>
        <Segmented label="Hvem" value={who} onValueChange={setWho} options={whoOptions(state)} />
      </div>
      <div aria-live="polite" className="mt-4 rounded-xl bg-muted p-3 text-sm">
        {!valid ? (
          'Skriv et antal dage.'
        ) : found === null ? (
          <b className="text-warn">Det kan ikke lade sig gøre inden for de næste par år.</b>
        ) : (
          <>
            <span className="text-muted-foreground">{fmtN(days)} dage kan tidligst bruges</span>
            <b className="mt-0.5 block font-display text-lg first-letter:uppercase">{fmtLong(found)}</b>
            <Button className="mt-3 w-full" onClick={() => onCreate(found, days, who)}>Lav rejse fra denne dato</Button>
          </>
        )}
      </div>
    </section>
  );
}
