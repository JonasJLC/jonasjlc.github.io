import { useEffect, useState } from 'react';
import { METRICS, type Metric } from '../lib/health/model';
import { setSharing } from '../lib/health/repo';
import { useHealthSettings } from '../lib/health/use-health';
import { people, type Person } from '../lib/people';
import { Card, CardRow } from '../ui/card';
import { Switch } from '../ui/switch';
import { notify } from '../ui/toast';

const labelFor = (metric: Metric, name: string) => {
  switch (metric) {
    case 'sleep_score': return `Vis min søvn for ${name}`;
    case 'activity': return `Vis min aktivitet for ${name}`;
    case 'steps': return `Vis mine skridt for ${name}`;
    case 'cycle_day': return `Vis min cyklus for ${name}`;
  }
};

/**
 * The signed-in person's own switches: what the other member may see. Missing rows show as off (cycle is private by
 * default). A change is shown at once and rolled back, with a toast, if saving fails.
 */
export function SharingSettings({ householdId, person }: { householdId: string; person: Person }) {
  const other: Person = person === 'jonas' ? 'camilla' : 'jonas';
  const otherName = people[other].name;
  const { sharing, status } = useHealthSettings(householdId, person);
  const [values, setValues] = useState<Record<Metric, boolean> | null>(null);
  const [busy, setBusy] = useState<Metric | null>(null);

  useEffect(() => {
    if (status === 'ready') setValues(sharing.values);
  }, [status, sharing]);

  if (status === 'error') return null;
  if (!values) return <div aria-busy="true" aria-label="Henter deling" className="h-40 rounded-sp-card bg-sp-surface" />;

  const toggle = async (metric: Metric, on: boolean) => {
    const before = values;
    setValues({ ...values, [metric]: on });
    setBusy(metric);
    try {
      await setSharing(householdId, person, metric, on);
    } catch {
      setValues(before);
      notify('Kunne ikke gemme. Prøv igen.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="sharing-title" className="flex flex-col gap-2">
      <h2 id="sharing-title" className="sp-title-section">Hvad må {otherName} se?</h2>
      <Card className="py-1">
        {METRICS.map((m) => (
          <CardRow key={m}>
            <Switch label={labelFor(m, otherName)} checked={values[m]} disabled={busy === m} onCheckedChange={(on) => void toggle(m, on)} />
          </CardRow>
        ))}
      </Card>
      <p className="sp-small text-sp-muted">Du bestemmer selv. Du kan ændre det når som helst.</p>
    </section>
  );
}
