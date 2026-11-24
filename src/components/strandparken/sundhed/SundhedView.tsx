import { Plus } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useHabits } from '../lib/habits/use-habits';
import type { Habit } from '../lib/habits/model';
import { availableMetrics } from '../lib/habits/view';
import { useHealth } from '../lib/health/use-health';
import { keyFromPerson, people, type Person } from '../lib/people';
import { parseSundhedPath, sundhedHref, sundhedTabs, type SundhedTab } from '../lib/routes';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { SegmentedControl, SegmentedPanel } from '../ui/segmented-control';
import { DataPanel } from './DataPanel';
import { HabitSheet } from './HabitSheet';
import { VanerPanel, type VanerPanelProps } from './VanerPanel';

type Props = { path: string[]; person: Person; householdId: string | null };

type PanelProps = Props & { viewed: Person; onPerson: (p: Person) => void; vaner: VanerPanelProps };

/**
 * One entry per Sundhed panel, in `sundhedTabs` order. The segmented control is drawn when there are two or more. "Vaner"
 * (idea 15) brings its `+` as the `headerAction`, which opens the habit sheet.
 */
const panels: Partial<Record<SundhedTab, { label: string; panel: (p: PanelProps) => ReactNode; headerAction?: (p: { onNew: () => void }) => ReactNode }>> = {
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
  vaner: {
    label: 'Vaner',
    panel: ({ vaner }) => <VanerPanel {...vaner} />,
    headerAction: ({ onNew }) => (
      <Button variant="icon" tone="add" aria-label="Ny vane" onClick={onNew}>
        <Icon icon={Plus} />
      </Button>
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
  // The habits live here, not in the panel, so the header `+` and the edit button in the history can open the one sheet.
  const me = keyFromPerson(props.person);
  const habits = useHabits(props.householdId, me);
  const health = useHealth(props.householdId, props.person);
  const [editor, setEditor] = useState<{ habit: Habit | null } | null>(null);

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

  const openEditor = (habit: Habit | null) => {
    if (tab !== 'vaner') selectTab('vaner');
    setEditor({ habit });
  };

  const vaner: VanerPanelProps = {
    state: habits.state, today: habits.today, offline: habits.offline, me,
    health: { today: health.today, hidden: health.hidden, sources: health.sources },
    setDone: habits.setDone, archive: habits.archive, restore: habits.restore, retry: habits.retry,
    onNew: () => openEditor(null), onEdit: (h) => openEditor(h),
  };

  const body = (value: SundhedTab) => panels[value]!.panel({ ...props, viewed, onPerson: selectPerson, vaner });

  return (
    <div className="flex flex-col gap-sp-gap">
      <header className="flex items-center justify-between gap-3">
        <h1 id="view-title" tabIndex={-1} className="sp-title-page">
          Sundhed
        </h1>
        {/* Header action slot: the active panel's action, such as the `+` for a new habit. */}
        {panels[tab]?.headerAction?.({ onNew: () => openEditor(null) })}
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
      <HabitSheet
        open={editor !== null}
        habit={editor?.habit}
        me={me}
        available={availableMetrics(health.sources.length > 0, health.days)}
        hasSource={health.sources.length > 0}
        onClose={() => setEditor(null)}
        onSave={habits.save}
      />
    </div>
  );
}
