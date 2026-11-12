import { BookOpen, CalendarDays, Heart, Home, ShoppingBasket, type LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { hrefFor, labels, views, type View } from '../lib/routes';
import { Icon } from '../ui/icon';

const icons: Record<View, LucideIcon> = {
  hjem: Home,
  madplan: CalendarDays,
  indkob: ShoppingBasket,
  sundhed: Heart,
  opskrifter: BookOpen,
};

/**
 * UI spec §5.1: flat, five equal items, no emphasised item. The ground runs the full width; the five cells sit in the
 * centred column. Each item is a link (it changes the URL). Active is marked only by colour and a 2 px top indicator.
 */
export function BottomBar({ current }: { current: View }) {
  return (
    <nav
      aria-label="Hovedmenu"
      className="fixed inset-x-0 bottom-0 z-40 flex h-sp-bar-safe justify-center border-t border-sp-line bg-sp-bg pb-sp-safe"
    >
      <ul className="grid h-full w-full max-w-sp-column grid-cols-5">
        {views.map((view) => {
          const active = view === current;
          return (
            <li key={view} className="flex">
              <a
                href={hrefFor(view)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'sp-nav flex w-full flex-col items-center justify-center gap-1 border-t-2 -outline-offset-4 active:bg-sp-track',
                  active ? 'border-sp-primary text-sp-primary' : 'border-transparent text-sp-muted',
                )}
              >
                <Icon icon={icons[view]} />
                {labels[view]}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
