import { useEffect, useState } from 'react';
import { formatQuantity } from '../lib/recipes/scale';
import type { Wanted } from '../lib/shopping/model';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Sheet, SheetContent, SheetHeader } from '../ui/sheet';

export type ReviewGroup = { id: string; title: string; wanted: Wanted[] };

type Props = {
  open: boolean;
  groups: ReviewGroup[];
  busy: boolean;
  onCancel: () => void;
  /** `have` are the ingredients the person unticked: they already own them. */
  onConfirm: (kept: Wanted[], have: Wanted[]) => void;
};

const keyOf = (groupId: string, w: Wanted) => `${groupId}|${w.canonicalName}|${w.unit ?? ''}`;

/** The "har hjemme" review (design §5.3.4): everything starts ticked; untick what is already in the cupboard. */
export function ReviewSheet({ open, groups, busy, onCancel, onConfirm }: Props) {
  const [off, setOff] = useState<Set<string>>(new Set());
  useEffect(() => { if (open) setOff(new Set()); }, [open, groups]);

  const toggle = (key: string, on: boolean) => setOff((s) => { const n = new Set(s); if (on) n.delete(key); else n.add(key); return n; });
  const all = groups.flatMap((g) => g.wanted.map((w) => ({ key: keyOf(g.id, w), w })));
  const kept = all.filter((x) => !off.has(x.key)).map((x) => x.w);
  const have = all.filter((x) => off.has(x.key)).map((x) => x.w);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      <SheetContent aria-describedby={undefined}>
        <SheetHeader title="Har I det hjemme?" eyebrow="Fjern hakket ved det, I allerede har." />
        <div className="flex flex-col gap-sp-gap">
          {groups.map((g) => (
            <section key={g.id} aria-labelledby={`review-${g.id}`} className="flex flex-col gap-2">
              <h3 id={`review-${g.id}`} className="sp-title-group">{g.title}</h3>
              <ul className="overflow-hidden rounded-sp-row bg-sp-surface">
                {g.wanted.map((w) => {
                  const key = keyOf(g.id, w);
                  const id = `review-${g.id}-${key.length}-${w.canonicalName}`.replace(/\W+/g, '-');
                  return (
                    <li key={key} className="flex min-h-13.5 items-center gap-1 border-t border-sp-line-soft pr-4 pl-1 first:border-t-0">
                      <Checkbox aria-labelledby={id} checked={!off.has(key)} onCheckedChange={(c) => toggle(key, c === true)} />
                      <span id={id} className="sp-body min-w-0 flex-1 font-medium">{w.name}</span>
                      <span className="sp-small text-sp-muted">{formatQuantity(w.amount, w.unit)}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          <Button disabled={busy} onClick={() => onConfirm(kept, have)}>
            {kept.length === 0 ? 'Intet at købe' : kept.length === 1 ? 'Læg 1 vare på listen' : `Læg ${kept.length} varer på listen`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
