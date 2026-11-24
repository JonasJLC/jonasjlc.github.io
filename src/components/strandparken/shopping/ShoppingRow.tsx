import { motion, useReducedMotion } from 'motion/react';
import { capitalise, rowLabel, toneClasses, type CategoryTone } from '../lib/shopping/category-style';
import type { Line } from '../lib/shopping/model';
import { purchaseText } from '../lib/shopping/purchase';
import { cn } from '../lib/utils';
import { Checkbox } from '../ui/checkbox';

/** The day a planned meal's item is for ("Tor"), as a small neutral pill (idea 8). */
export function DayTag({ label }: { label: string }) {
  return <span className="sp-caption shrink-0 rounded-sp-pill bg-sp-track px-2 py-0.5 text-sp-muted">{label}</span>;
}

type Props = {
  line: Line;
  /** The category's tone, for the amount pill. */
  tone: CategoryTone;
  dayTag: string | null;
  onTick: (line: Line, checked: boolean) => void;
  onOpen: (line: Line) => void;
};

/**
 * One shopping-list row (idea 14): 48 px, the round check (a 44 px target), the capitalised name on one line, the day
 * tag and the amount as a pill in the category's tone. The rest of the row opens the item sheet, which lists the dishes.
 */
export function ShoppingRow({ line, tone, dayTag, onTick, onOpen }: Props) {
  const reduce = useReducedMotion();
  const amount = purchaseText(line.purchase);
  const nameId = `line-${line.key}`;
  return (
    <motion.li
      layout={reduce ? false : 'position'}
      initial={false}
      exit={reduce ? undefined : { opacity: 0, height: 0, transition: { duration: 0.2 } }}
      className="flex min-h-12 items-center gap-1 overflow-hidden border-t border-sp-line-soft pr-3 pl-0.5 first:border-t-0"
    >
      <Checkbox aria-labelledby={nameId} checked={line.checked} onCheckedChange={(c) => onTick(line, c === true)} />
      <button
        type="button"
        aria-label={rowLabel(line.name, amount, dayTag)}
        onClick={() => onOpen(line)}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
      >
        <span id={nameId} className={cn('sp-body min-w-0 flex-1 truncate', line.checked && 'text-sp-muted line-through')}>
          {capitalise(line.name)}
        </span>
        {dayTag && <DayTag label={dayTag} />}
        {amount && (
          <span className={cn('sp-caption-strong shrink-0 rounded-sp-pill px-2.5 py-1 whitespace-nowrap', toneClasses[tone])}>{amount}</span>
        )}
      </button>
    </motion.li>
  );
}
