import { useEffect, useState, type ReactNode } from 'react';
import { people, type Person } from '../lib/people';
import { parseSundhedPath, sundhedHref, sundhedTabs, type SundhedTab } from '../lib/routes';
import { SegmentedControl, SegmentedPanel } from '../ui/segmented-control';
import { DataPanel } from './DataPanel';

type Props = { path: string[]; person: Person; householdId: string | null };

/**
 * One entry per Sundhed panel, in `sundhedTabs` order. Idea 15 adds "Vaner" here (and its `+` as `headerAction`), then the
 * segmented control appears on its own because it has two options. Until then only Data exists and the control is not drawn.
 */
const panels: Partial<Record<SundhedTab, { label: string; panel: (p: Props & { viewed: Person; onPerson: (p: Person) => void }) => ReactNode; headerAction?: (p: Props) => ReactNode }>> = {
  data: {
    label: 'Data',
    panel: ({ householdId, person, viewed, onPerson }) => (
      <div className="flex flex-col gap-sp-gap">
        <SegmentedControl
          aria-label="Person"
          options={(['camilla', 'jonas'] as const).map((p) => ({ value: p, label: people[p].name }))}
          value={viewed}
          onValueChange={(v) => onPerson(v === 'camilla' ? 'camilla' : 'jonas')}
        />
        <DataPanel householdId={householdId} person={viewed} me={person} />
      </div>
    ),
  },
};

const available = sundhedTabs.filter((t) => panels[t]);
const options = available.map((value) => ({ value, label: panels[value]!.label }));

/**
 * Sundhed: title, a header slot (idea 15's `+`), and the panels. The route is `#sundhed`, `#sundhed/data/<person>` and later
 * `#sundhed/vaner`. Switching person uses `replaceState` so Back leaves Sundhed and a refresh keeps the choice.
 */
export function SundhedView(props: Props) {
  const route = parseSundhedPath(props.path);
  const requested: SundhedTab = available.includes(route.tab) ? route.tab : 'data';
  const [tab, setTab] = useState<SundhedTab>(requested);
  const [viewed, setViewed] = useState<Person>(route.person ?? props.person);

  useEffect(() => setTab(requested), [requested]);
  useEffect(() => setViewed(route.person ?? props.person), [route.person, props.person]);

  const selectPerson = (p: Person) => {
    history.replaceState(null, '', sundhedHref(p));
    setViewed(p);
  };
  const selectTab = (value: string) => {
    const next: SundhedTab = available.find((t) => t === value) ?? 'data';
    history.replaceState(null, '', next === 'data' ? sundhedHref(viewed) : `#sundhed/${next}`);
    setTab(next);
  };

  const body = (value: SundhedTab) => panels[value]!.panel({ ...props, viewed, onPerson: selectPerson });

  return (
    <div className="flex flex-col gap-sp-gap">
      <header className="flex items-center justify-between gap-3">
        <h1 id="view-title" tabIndex={-1} className="sp-title-page">
          Sundhed
        </h1>
        {/* Header action slot: the active panel's action, such as idea 15's `+` for a new habit. */}
        {panels[tab]?.headerAction?.(props)}
      </header>
      {options.length > 1 ? (
        <SegmentedControl aria-label="Visning" options={options} value={tab} onValueChange={selectTab} className="flex flex-col gap-sp-gap">
          {available.map((value) => (
            <SegmentedPanel key={value} value={value}>
              {body(value)}
            </SegmentedPanel>
          ))}
        </SegmentedControl>
      ) : (
        body('data')
      )}
    </div>
  );
}
