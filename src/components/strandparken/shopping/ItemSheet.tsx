import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { weekdayShort } from '../lib/madplan/dates';
import { formatQuantity } from '../lib/recipes/scale';
import type { GroceryCategory, Line, Source } from '../lib/shopping/model';
import { ingredientByKey, optionLabel, purchaseText, unitOptions } from '../lib/shopping/purchase';
import { setCategory } from '../lib/shopping/repo';
import { Button } from '../ui/button';
import { Chip } from '../ui/chip';
import { Icon } from '../ui/icon';
import { Sheet, SheetContent, SheetHeader } from '../ui/sheet';
import { notify } from '../ui/toast';

type Props = {
  line: Line | null;
  categories: GroceryCategory[];
  /** Remembered units per ingredient key. */
  prefs: Readonly<Record<string, string>>;
  offline: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
  /** Saves (or with `null` clears) the remembered unit; throws when it could not be saved. */
  onUnit: (ingredientKey: string, unit: string | null) => Promise<void>;
  onRemove: (line: Line) => void;
};

/** "Quesadillas · Tor · 1½ lime": the dish, its weekday and the amount exactly as the recipe has it. */
function sourceText(s: Source): string {
  const amount = formatQuantity(s.amount, s.unit);
  return [s.dish ?? 'Tilføjet i hånden', s.date ? weekdayShort(s.date) : null, amount ? `${amount} ${s.name.toLocaleLowerCase('da')}` : null]
    .filter(Boolean)
    .join(' · ');
}

/** Tap a list row: see what it is for, change its category (the guess can be wrong) or take it off the list. */
export function ItemSheet({ line, categories, prefs, offline, onClose, onChanged, onUnit, onRemove }: Props) {
  const [busy, setBusy] = useState(false);
  const chooseUnit = async (line: Line, unit: string | null) => {
    if (offline) {
      notify('Enheden kan kun ændres, når der er forbindelse.');
      return;
    }
    setBusy(true);
    try {
      await onUnit(line.ingredientKey, unit);
    } catch {
      notify('Det lykkedes ikke. Prøv igen.');
    } finally {
      setBusy(false);
    }
  };
  const options = line && !line.pantry ? unitOptions(ingredientByKey(line.ingredientKey)) : [];
  const current = line ? prefs[line.ingredientKey] : undefined;
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
            <SheetHeader title={line.name} eyebrow={line.pantry ? 'Tjek at I har' : purchaseText(line.purchase) || undefined} />
            <div className="flex flex-col gap-sp-gap">
              <section aria-labelledby="item-sources" className="flex flex-col gap-2">
                <h3 id="item-sources" className="sp-title-group">Til</h3>
                <ul className="flex flex-col gap-1">
                  {line.sources.map((s) => (
                    <li key={s.rowId} className="sp-body">{sourceText(s)}</li>
                  ))}
                </ul>
              </section>
              {options.length > 0 && (
                <section aria-labelledby="item-unit" className="flex flex-col gap-2">
                  <h3 id="item-unit" className="sp-title-group">Enhed</h3>
                  <div className="flex flex-wrap gap-2">
                    <Chip selected={!current || !options.includes(current)} disabled={busy} onClick={() => void chooseUnit(line, null)}>Standard</Chip>
                    {options.map((u) => (
                      <Chip key={u} selected={u === current} disabled={busy} onClick={() => void chooseUnit(line, u)}>{optionLabel(u)}</Chip>
                    ))}
                  </div>
                </section>
              )}
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
