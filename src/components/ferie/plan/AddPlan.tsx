import { ChevronDownIcon, PlaneIcon, PlusIcon } from 'lucide-react';
import { PLAN_TYPES } from '../lib/plan';
import type { PlanType } from '../lib/types';
import { Button } from '../ui/button';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../ui/menu';
import { TypeIcon, typeTone } from './icons';

/** One quiet "add" that asks for the kind, instead of a row of buttons on every day. */
export function AddPlan({ onAdd, label = 'Tilføj', types = PLAN_TYPES.map((t) => t.value) }: { onAdd: (t: PlanType, fly?: boolean) => void; label?: string; types?: PlanType[] }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" size="sm" className="self-start text-muted-foreground hover:text-foreground">
          <PlusIcon aria-hidden />{label}<ChevronDownIcon aria-hidden />
        </Button>
      </MenuTrigger>
      <MenuContent>
        {PLAN_TYPES.filter((t) => types.includes(t.value)).map((t) => (
          <MenuItem key={t.value} onSelect={() => onAdd(t.value)}><TypeIcon type={t.value} className={typeTone(t.value).ink} />{t.label}</MenuItem>
        ))}
        {types.includes('transport') && (
          <MenuItem onSelect={() => onAdd('transport', true)}><PlaneIcon className={typeTone('transport').ink} aria-hidden />Fly</MenuItem>
        )}
      </MenuContent>
    </Menu>
  );
}
