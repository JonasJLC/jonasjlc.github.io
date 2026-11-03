import { FoldBody, FoldButton, useFold } from '../fold';
import { settlement } from '../lib/kasse';
import type { FerieState } from '../lib/types';
import { Money } from '../page';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { personName } from './helpers';

/** Who owes whom for what one of them paid with their own card. */
export function Settle({ state }: { state: FerieState }) {
  const fold = useFold('settle');
  const { net, rows } = settlement(state);
  const even = Math.abs(net) < 1;
  const [from, to] = net > 0 ? ['b', 'a'] as const : ['a', 'b'] as const;
  return (
    <Card>
      <CardHeader>
        <CardTitle><FoldButton folded={fold.folded} onToggle={fold.toggle} controls="settle-body">Hvem har lagt ud?</FoldButton></CardTitle>
        {!fold.folded && rows.length === 0 && (
          <CardDescription>
            Betaler en af jer noget med sit eget kort, så vælg det under “Betales af”. Så holder planen styr på, hvem der skylder hvem.
          </CardDescription>
        )}
      </CardHeader>
      <FoldBody id="settle-body" folded={fold.folded}>
      {rows.length > 0 && (
        <>
          <p className="text-lg leading-7">
            {even ? 'I er kvit' : <>{personName(state, from)} skylder {personName(state, to)} <Money value={Math.abs(net)} /></>}
          </p>
          <ul className="flex flex-col text-sm">
            {rows.map((r) => (
              <li key={r.id} className="flex min-h-8 items-baseline justify-between gap-3 border-t border-rule py-1.5">
                <span className="min-w-0 text-muted-foreground"><span className="text-foreground">{personName(state, r.payer)}</span> betalte {r.text}</span>
                <Money value={r.amount} />
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Udgifter til fælles rejser deles 50/50.</p>
        </>
      )}
      </FoldBody>
    </Card>
  );
}
