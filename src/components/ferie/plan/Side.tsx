import { CalendarClockIcon, ChevronDownIcon, LightbulbIcon, ListChecksIcon, PlusIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { fmtShort, toTime } from '../lib/dates';
import { CHECK_TEMPLATES, bookByLabel, typeInfo } from '../lib/plan';
import type { CheckItem, PlanItem } from '../lib/types';
import { cn } from '../lib/utils';
import { Button } from '../ui/button';
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from '../ui/menu';
import { Progress } from '../ui/progress';
import { DropList } from './DayCard';
import { ItemIcon, typeTone } from './icons';
import { IconChip } from '../page';

const Count = ({ children }: { children: React.ReactNode }) => (
  <span className="ml-1.5 text-sm font-normal text-muted-foreground tabular-nums">{children}</span>
);

/** Everything still to book, soonest deadline first. Amber within two weeks, red once it has passed. */
export function ToBook({ items, today, onEdit }: { items: PlanItem[]; today: number; onEdit: (it: PlanItem) => void }) {
  const list = items
    .filter((x) => x.status === 'tobook')
    .sort((a, b) => (a.bookBy || '9999').localeCompare(b.bookBy || '9999') || (a.day || '9999').localeCompare(b.day || '9999'));
  return (
    <Card id="tobook" className="scroll-mt-20 gap-3">
      <CardHeader className="grid-cols-[auto_1fr] items-center gap-x-3">
        <IconChip tone="bg-caution-tint text-caution" className="row-span-2"><CalendarClockIcon /></IconChip>
        <CardTitle>Skal bookes{list.length > 0 && <Count>{list.length}</Count>}</CardTitle>
        {list.length === 0 && <CardDescription>Intet mangler. Sæt status til “Skal bookes” på det, I skal have booket, så samles det her.</CardDescription>}
      </CardHeader>
      {list.length > 0 && (
        <ul className="flex flex-col">
          {list.map((x) => {
            const b = bookByLabel(x, today);
            return (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => onEdit(x)}
                  className="-mx-2 flex min-h-13 w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-card"
                >
                  <IconChip tone={typeTone(x.type).chip}><ItemIcon item={x} /></IconChip>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{x.title || typeInfo(x.type).label}</span>
                    <span className="block text-xs text-muted-foreground">{x.day ? `Til ${fmtShort(toTime(x.day))}` : 'I idébanken'}</span>
                  </span>
                  <span
                    className={cn(
                      'shrink-0 whitespace-nowrap text-xs',
                      b.over ? 'rounded-full bg-warn-tint px-2 py-0.5 font-medium text-warn-ink' : b.soon ? 'rounded-full bg-caution-tint px-2 py-0.5 font-medium text-caution' : 'text-muted-foreground',
                    )}
                  >
                    {x.bookBy ? b.when : 'Ingen frist'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
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
    <Card id="idebank" className="scroll-mt-20 gap-3">
      <CardHeader className="grid-cols-[auto_1fr] items-center gap-x-3">
        <IconChip tone="bg-cat-oplevelse-tint text-cat-oplevelse-ink" className="row-span-2"><LightbulbIcon /></IconChip>
        <CardTitle>Idébank{items.length > 0 && <Count>{items.length}</Count>}</CardTitle>
        <CardDescription>Ting, I gerne vil nå, men ikke har placeret. Træk dem over på en dag.</CardDescription>
      </CardHeader>
      <DropList id="ideas" items={items} empty="Ingen idéer endnu" always>{renderRow}</DropList>
      <Button variant="ghost" size="sm" className="self-start text-muted-foreground hover:text-foreground" onClick={onAdd}><PlusIcon aria-hidden />Ny idé</Button>
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
    <Card variant="sheet" className="gap-3">
      <CardHeader className="grid-cols-[auto_1fr_auto] items-center gap-x-3 has-data-[slot=card-action]:grid-cols-[auto_1fr_auto]">
        <IconChip tone="bg-cat-mad-tint text-cat-mad-ink" className="row-span-2"><ListChecksIcon /></IconChip>
        <CardTitle>Huskeliste</CardTitle>
        <CardDescription className="col-start-2 text-xs">
          {list.length ? <><span className="text-foreground tabular-nums">{done}/{list.length}</span> klaret{done === list.length ? ' · alt er pakket' : ''}</> : 'Tom endnu'}
        </CardDescription>
        <CardAction className="col-start-3 self-center">
          <Menu>
            <MenuTrigger asChild>
              <Button variant="secondary" size="sm" className="-mr-1">Færdig liste<ChevronDownIcon aria-hidden /></Button>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuLabel>Tilføj tingene fra</MenuLabel>
              {Object.keys(CHECK_TEMPLATES).map((k) => (
                <MenuItem key={k} onSelect={() => onAdd(CHECK_TEMPLATES[k])}>{k}<span className="ml-auto text-xs text-muted-foreground">{CHECK_TEMPLATES[k].length}</span></MenuItem>
              ))}
            </MenuContent>
          </Menu>
        </CardAction>
      </CardHeader>
      {list.length > 0 && <Progress className="bg-cat-mad-tint [&>[data-slot=progress-indicator]]:bg-cat-mad" value={(done / list.length) * 100} aria-label={`${done} af ${list.length} klaret på huskelisten`} />}
      {list.length > 0 && (
        <ul className="flex flex-col">
          {list.map((c) => (
            <li key={c.id} className="group flex min-h-11 items-center gap-3 border-t border-rule first:border-t-0">
              <Checkbox
                id={`chk-${c.id}`}
                checked={c.done}
                onCheckedChange={(v) => onToggle(c, v === true)}
                className="size-[22px] rounded-full border-input data-[state=checked]:border-ok data-[state=checked]:bg-ok data-[state=checked]:text-white dark:data-[state=checked]:bg-ok"
              />
              <label htmlFor={`chk-${c.id}`} className={cn('flex-1 py-2 text-sm', c.done && 'text-muted-foreground line-through decoration-muted-foreground/60')}>{c.text}</label>
              <Button variant="ghost" size="icon-sm" className="text-muted-foreground opacity-60 group-hover:opacity-100 focus-visible:opacity-100" aria-label={`Fjern ${c.text}`} onClick={() => onRemove(c.id)}><XIcon /></Button>
            </li>
          ))}
        </ul>
      )}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <Input aria-label="Tilføj til listen" placeholder="Tilføj til listen" maxLength={80} value={text} onChange={(e) => setText(e.target.value)} />
        <Button type="submit" variant="outline">Tilføj</Button>
      </form>
    </Card>
  );
}
