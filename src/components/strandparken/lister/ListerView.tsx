import { useEffect, useState, type ReactNode } from 'react';
import { listerHref, listerSegment, listerSegments, type ListerSegment } from '../lib/routes';
import { IndkobView } from '../shopping/IndkobView';
import { Card } from '../ui/card';
import { SegmentedControl, SegmentedPanel } from '../ui/segmented-control';

type Props = { path: string[]; householdId: string | null };

/** One entry per Lister segment, in `listerSegments` order. A new list adds its segment in `routes.ts` and a row here. */
const segments: Record<ListerSegment, { label: string; panel: (props: Props) => ReactNode }> = {
  indkob: { label: 'Indkøb', panel: ({ householdId }) => <IndkobView householdId={householdId} showTitle={false} /> },
  todo: {
    label: 'To-do',
    panel: () => (
      <Card className="flex flex-col gap-2">
        <h2 className="sp-title-section">To-do</h2>
        <p className="sp-body text-sp-muted">Kommer snart.</p>
      </Card>
    ),
  },
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

  useEffect(() => setSegment(fromPath), [fromPath]); // a link to another segment (`#lister/todo`) wins

  const select = (value: string) => {
    const next = listerSegment([value]);
    history.replaceState(null, '', listerHref(next));
    setSegment(next);
  };

  return (
    <div className="flex flex-col gap-sp-gap">
      <h1 id="view-title" tabIndex={-1} className="sp-title-page">
        Lister
      </h1>
      <SegmentedControl aria-label="Liste" options={options} value={segment} onValueChange={select} className="flex flex-col gap-sp-gap">
        {listerSegments.map((value) => (
          <SegmentedPanel key={value} value={value}>
            {segments[value].panel(props)}
          </SegmentedPanel>
        ))}
      </SegmentedControl>
    </div>
  );
}
