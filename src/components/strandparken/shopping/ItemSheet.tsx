import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { formatQuantity } from '../lib/recipes/scale';
import type { GroceryCategory, Line } from '../lib/shopping/model';
import { setCategory } from '../lib/shopping/repo';
import { Button } from '../ui/button';
import { Chip } from '../ui/chip';
import { Icon } from '../ui/icon';
import { Sheet, SheetContent, SheetHeader } from '../ui/sheet';
import { notify } from '../ui/toast';

type Props = { line: Line | null; categories: GroceryCategory[]; onClose: () => void; onChanged: () => Promise<void>; onRemove: (line: Line) => void };

/** Tap a list row: change its category (the guess can be wrong) or take it off the list. */
export function ItemSheet({ line, categories, onClose, onChanged, onRemove }: Props) {
  const [busy, setBusy] = useState(false);
  const pick = async (line: Line, id: string) => {
    setBusy(true);
    try {
      await setCategory(line.rows.map((r) => r.id), id);
      await onChanged();
      onClose();
    } catch {
      notify('Det lykkedes ikke. Prøv igen.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={line !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent aria-describedby={undefined}>
        {line && (
          <>
            <SheetHeader title={line.name} eyebrow={[formatQuantity(line.amount, line.unit), line.dishes.join(', ')].filter(Boolean).join(' · ') || undefined} />
            <div className="flex flex-col gap-sp-gap">
              <section aria-labelledby="item-category" className="flex flex-col gap-2">
                <h3 id="item-category" className="sp-title-group">Kategori</h3>
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <Chip key={c.id} selected={c.id === line.categoryId} disabled={busy} onClick={() => void pick(line, c.id)}>{c.name}</Chip>
                  ))}
                </div>
              </section>
              <Button variant="outline" onClick={() => onRemove(line)}>
                <Icon icon={Trash2} size={18} /> Fjern fra listen
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
