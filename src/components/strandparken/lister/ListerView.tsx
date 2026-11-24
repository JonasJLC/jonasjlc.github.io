import { useEffect, useState, type ReactNode } from 'react';
import { listerHref, listerSegment, listerSegments, type ListerSegment } from '../lib/routes';
import { IndkobView, type ShoppingProgress } from '../shopping/IndkobView';
import { TodoView } from './TodoView';
import { SegmentedControl, SegmentedPanel } from '../ui/segmented-control';

type Props = { path: string[]; householdId: string | null };
type PanelProps = Props & { onProgress: (p: ShoppingProgress | null) => void };

/** One entry per Lister segment, in `listerSegments` order. A new list adds its segment in `routes.ts` and a row here. */
const segments: Record<ListerSegment, { label: string; panel: (props: PanelProps) => ReactNode }> = {
  indkob: { label: 'Indkøb', panel: ({ householdId, onProgress }) => <IndkobView householdId={householdId} onProgress={onProgress} /> },
  todo: { label: 'To-do', panel: ({ householdId }) => <TodoView householdId={householdId} /> },
};

const options = listerSegments.map((value) => ({ value, label: segments[value].label }));

/**
 * Lister (idea 4): the page title and a segmented control, Indkøb | To-do. The segment lives in the hash (`#lister/todo`) so a
 * refresh or a shared link keeps it. Switching uses `replaceState`, so Back leaves Lister instead of stepping through segments,
 * and no `hashchange` fires, so focus stays on the segment the user picked.
 */
export function ListerView(props: Props) {
  const fromPath = listerSegment(props.path);
  const [segment, setSegment] = useState<ListerSegment>(fromPath);
  // "x af y købt" from the Indkøb panel, shown on the title row (idea 14); null while the list is empty or loading.
  const [progress, setProgress] = useState<ShoppingProgress | null>(null);

  useEffect(() => setSegment(fromPath), [fromPath]); // a link to another segment (`#lister/todo`) wins

  const select = (value: string) => {
    const next = listerSegment([value]);
    history.replaceState(null, '', listerHref(next));
    setSegment(next);
  };

  return (
    <div className="flex flex-col gap-sp-gap">
      <div className="flex items-baseline justify-between gap-3">
        <h1 id="view-title" tabIndex={-1} className="sp-title-card">
          Lister
        </h1>
        {segment === 'indkob' && (
          <p className="sp-small shrink-0 text-sp-muted" aria-live="polite">
            {progress ? `${progress.done} af ${progress.total} købt` : ''}
          </p>
        )}
      </div>
      <SegmentedControl aria-label="Liste" options={options} value={segment} onValueChange={select} className="flex flex-col gap-sp-gap">
        {listerSegments.map((value) => (
          <SegmentedPanel key={value} value={value}>
            {segments[value].panel({ ...props, onProgress: setProgress })}
          </SegmentedPanel>
        ))}
      </SegmentedControl>
    </div>
  );
}
