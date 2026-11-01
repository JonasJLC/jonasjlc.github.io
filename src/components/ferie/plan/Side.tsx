import { PlusIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { CHECK_TEMPLATES, bookByLabel, typeInfo } from '../lib/plan';
import type { CheckItem, PlanItem } from '../lib/types';
import { cn } from '../lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Progress } from '../ui/progress';
import { DropList } from './DayCard';
import { TypeIcon } from './icons';

export function ToBook({ items, today, onEdit }: { items: PlanItem[]; today: number; onEdit: (it: PlanItem) => void }) {
  const list = items
    .filter((x) => x.status === 'tobook')
    .sort((a, b) => (a.bookBy || '9999').localeCompare(b.bookBy || '9999') || (a.day || '9999').localeCompare(b.day || '9999'));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-lg">Skal bookes {list.length > 0 && <Badge variant="secondary">{list.length}</Badge>}</CardTitle>
        {list.length === 0 && <CardDescription>Intet mangler. Sæt status til “Skal bookes” på det, I skal have booket, så samles det her.</CardDescription>}
      </CardHeader>
      {list.length > 0 && (
        <CardContent>
          <ul className="flex flex-col gap-1.5">
            {list.map((x) => {
              const b = bookByLabel(x, today);
              return (
                <li key={x.id}>
                  <button
                    type="button"
                    onClick={() => onEdit(x)}
                    className={cn('flex min-h-12 w-full flex-col items-start rounded-xl border px-3 py-2 text-left hover:bg-muted', b.over && 'border-warn bg-warn/10', !b.over && b.soon && 'border-holiday bg-holiday/10')}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold"><TypeIcon type={x.type} className="size-4" />{x.title || typeInfo(x.type).label}</span>
                    <small className={cn('text-xs text-muted-foreground', b.over && 'font-semibold text-warn')}>{b.when}</small>
                  </button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}

export function IdeaBank({
  items, onAdd, renderRow,
}: {
  items: PlanItem[]; onAdd: () => void; renderRow: (it: PlanItem) => React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-lg">Idébank {items.length > 0 && <Badge variant="secondary">{items.length}</Badge>}</CardTitle>
        <CardDescription>Ting, I gerne vil nå, men ikke har placeret endnu. Træk dem over på en dag.</CardDescription>
      </CardHeader>
      <CardContent>
        <DropList id="ideas" items={items} empty="Ingen idéer endnu">{renderRow}</DropList>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm" onClick={onAdd}><PlusIcon data-icon="inline-start" />Idé</Button>
      </CardFooter>
    </Card>
  );
}

export function Checklist({
  tripId, checks, onAdd, onToggle, onRemove,
}: {
  tripId: string; checks: CheckItem[];
  onAdd: (texts: string[], force?: boolean) => void; onToggle: (c: CheckItem, done: boolean) => void; onRemove: (id: string) => void;
}) {
  const [text, setText] = useState('');
  const list = checks.filter((c) => c.tripId === tripId).sort((a, b) => a.order - b.order);
  const done = list.filter((c) => c.done).length;
  const add = () => {
    const v = text.trim();
    if (v) { onAdd([v], true); setText(''); }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-lg">Huskeliste {list.length > 0 && <Badge variant="secondary">{done}/{list.length}</Badge>}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {list.length > 0 && <Progress value={(done / list.length) * 100} aria-label="Klaret på huskelisten" />}
        <ul className="flex flex-col">
          {list.map((c) => (
            <li key={c.id} className="flex min-h-11 items-center gap-3 border-b last:border-0">
              <Checkbox id={`chk-${c.id}`} checked={c.done} onCheckedChange={(v) => onToggle(c, v === true)} />
              <label htmlFor={`chk-${c.id}`} className={cn('flex-1 py-2 text-sm', c.done && 'text-muted-foreground line-through')}>{c.text}</label>
              <Button variant="ghost" size="icon-sm" aria-label={`Fjern ${c.text}`} onClick={() => onRemove(c.id)}><XIcon /></Button>
            </li>
          ))}
        </ul>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <Input aria-label="Tilføj til listen" placeholder="Tilføj til listen" maxLength={80} value={text} onChange={(e) => setText(e.target.value)} />
          <Button type="submit">Tilføj</Button>
        </form>
      </CardContent>
      <CardFooter className="flex-wrap gap-1.5">
        {Object.keys(CHECK_TEMPLATES).map((k) => (
          <Button key={k} variant="outline" size="sm" onClick={() => onAdd(CHECK_TEMPLATES[k])}><PlusIcon data-icon="inline-start" />{k}</Button>
        ))}
      </CardFooter>
    </Card>
  );
}

