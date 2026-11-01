import { kr, settlement } from '../lib/kasse';
import type { FerieState } from '../lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { personName } from './helpers';

export function Settle({ state }: { state: FerieState }) {
  const { net, rows } = settlement(state);
  const text = Math.abs(net) < 1 ? 'I er kvit' : net > 0 ? `${personName(state, 'b')} skylder ${personName(state, 'a')} ${kr(net)}` : `${personName(state, 'a')} skylder ${personName(state, 'b')} ${kr(-net)}`;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">Hvem har lagt ud?</CardTitle>
        {rows.length === 0 && (
          <CardDescription>
            Betaler en af jer noget med sit eget kort, så vælg det under “Betales af”. Så holder planen styr på, hvem der skylder hvem.
          </CardDescription>
        )}
      </CardHeader>
      {rows.length > 0 && (
        <CardContent className="flex flex-col gap-3">
          <b className="font-display text-xl">{text}</b>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {rows.map((r) => <li key={r.id}>{personName(state, r.payer)} betalte {r.text}: {kr(r.amount)}</li>)}
          </ul>
          <p className="text-xs text-muted-foreground">Udgifter til fælles rejser deles 50/50.</p>
        </CardContent>
      )}
    </Card>
  );
}
