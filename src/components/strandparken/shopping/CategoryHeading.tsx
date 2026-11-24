import {
  Apple, Beef, Candy, Croissant, CupSoda, Leaf, ListChecks, Milk, Package, Sandwich, ShoppingBasket, Snowflake, SprayCan, Wheat,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { styleFor, toneClasses, type CategoryIcon } from '../lib/shopping/category-style';
import { cn } from '../lib/utils';
import { Icon } from '../ui/icon';

const icons: Record<CategoryIcon, LucideIcon> = {
  apple: Apple, croissant: Croissant, beef: Beef, sandwich: Sandwich, milk: Milk, snowflake: Snowflake, wheat: Wheat,
  package: Package, leaf: Leaf, 'cup-soda': CupSoda, candy: Candy, 'spray-can': SprayCan, 'shopping-basket': ShoppingBasket,
  'list-checks': ListChecks,
};

/** The 28 px tile in the category's tone with its icon (decorative). */
export function CategoryTile({ name }: { name: string }) {
  const style = styleFor(name);
  return (
    <span className={cn('inline-flex size-7 shrink-0 items-center justify-center rounded-sp-inset', toneClasses[style.tone])}>
      <Icon icon={icons[style.icon]} size={18} />
    </span>
  );
}

/**
 * A shopping-list category heading (idea 14): the tinted icon tile, then the name. `children` replaces the plain name,
 * for headings that are also a disclosure button ("Tjek at I har", "Købt").
 */
export function CategoryHeading({ id, name, children }: { id: string; name: string; children?: ReactNode }) {
  return (
    <h2 id={id} className="sp-body-strong flex min-h-8 items-center gap-2.5">
      {children ?? (
        <>
          <CategoryTile name={name} />
          {name}
        </>
      )}
    </h2>
  );
}
