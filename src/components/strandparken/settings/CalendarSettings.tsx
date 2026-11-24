import { useCallback, useEffect, useState } from 'react';
import { calColors, calClasses, calendarErrorMessage, colorOf, splitSources, updatedLabel, type CalColor, type CalendarSource } from '../lib/calendar/model';
import { addSource, CalendarError, loadSources, removeSource, updateSource, type SourcePatch } from '../lib/calendar/repo';
import { calendarsChanged } from '../lib/calendar/use-calendar';
import { keyFromPerson, people, type Person } from '../lib/people';
import { cn } from '../lib/utils';
import { Button } from '../ui/button';
import { Card, CardRow } from '../ui/card';
import { Field } from '../ui/field';
import { Sheet, SheetContent, SheetHeader } from '../ui/sheet';
import { notify } from '../ui/toast';

/** An on/off switch: a real button with role="switch", so the state is read out and never shown by colour alone. */
function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex min-h-sp-target shrink-0 items-center gap-2 disabled:opacity-60"
    >
      <span className={cn('relative h-6 w-10 rounded-sp-pill border-2 transition-colors', checked ? 'border-sp-primary bg-sp-primary' : 'border-sp-dash bg-sp-surface')}>
        <span className={cn('absolute top-0.5 size-4 rounded-full transition-transform', checked ? 'translate-x-4.5 bg-sp-on-primary' : 'translate-x-0.5 bg-sp-dash')} />
      </span>
      <span className="sp-small">{label}</span>
    </button>
  );
}

const Dot = ({ color }: { color: string }) => <span aria-hidden className={cn('size-3 shrink-0 rounded-full', colorOf(color).bar)} />;

function Explanation() {
  return (
    <details className="rounded-sp-inset bg-sp-surface px-4 py-3">
      <summary className="sp-body-strong min-h-sp-target cursor-pointer content-center">Hvorfor en adresse?</summary>
      <p className="sp-small mt-2 text-sp-muted">
        Strandparken er en webapp og kan ikke læse kalenderne på telefonen. I stedet indsætter du kalenderens hemmelige adresse.
        Google: Indstillinger › kalenderen › &quot;Hemmelig adresse i iCal-format&quot;. Outlook: Kalender › Del › Publicer.
        iCloud: Del kalender › Offentlig kalender. Adressen gemmes krypteret og vises ikke igen. Nye aftaler kan være et par
        timer om at dukke op.
      </p>
    </details>
  );
}

function AddForm({ other, onAdded }: { other: Person; onAdded: () => void }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [color, setColor] = useState<CalColor>('cal-1');
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || !url.trim()) {
      setError('Skriv et navn og indsæt adressen.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addSource({ url: url.trim(), label: name.trim(), color, shared });
      setName('');
      setUrl('');
      setShared(false);
      notify('Kalenderen er tilføjet.');
      onAdded();
    } catch (e) {
      setError(e instanceof CalendarError ? e.message : calendarErrorMessage(undefined));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <h3 className="sp-title-group">Tilføj kalender</h3>
      <Field label="Navn" placeholder="Navn, f.eks. Arbejde" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
      <Field
        label="Hemmelig iCal-adresse"
        placeholder="Hemmelig iCal-adresse (https:// eller webcal://)"
        inputMode="url"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        maxLength={2000}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <div role="group" aria-label="Farve" className="flex flex-wrap gap-2">
        {calColors.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={color === c}
            aria-label={calClasses[c].name}
            onClick={() => setColor(c)}
            className={cn('inline-flex size-sp-target items-center justify-center rounded-full', color === c ? 'bg-sp-track ring-2 ring-sp-ink' : 'bg-sp-surface')}
          >
            <span aria-hidden className={cn('size-5 rounded-full', calClasses[c].bar)} />
          </button>
        ))}
      </div>
      <div className="flex flex-col">
        <Switch checked={shared} onChange={setShared} label="Fælles" />
        <p className="sp-caption text-sp-muted">Vises også på {people[other].name}s forside.</p>
      </div>
      {error && <p role="alert" className="sp-small text-sp-danger">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? 'Henter kalenderen …' : 'Tilføj kalender'}</Button>
    </form>
  );
}

function OwnRow({ source, onChange, onRemove }: { source: CalendarSource; onChange: (patch: SourcePatch) => void; onRemove: () => void }) {
  return (
    <CardRow className="flex flex-col gap-1 py-3">
      <div className="flex items-center gap-2">
        <Dot color={source.color} />
        <span className="sp-body-strong min-w-0 flex-1 truncate">{source.label}</span>
        <Button variant="quiet" onClick={onRemove}>Fjern</Button>
      </div>
      {source.last_error ? (
        <p className="sp-caption text-sp-danger">{calendarErrorMessage(source.last_error)}</p>
      ) : source.last_fetched_at ? (
        <p className="sp-caption text-sp-muted">{updatedLabel(source.last_fetched_at, new Date())}</p>
      ) : null}
      <div className="flex flex-wrap gap-x-4">
        <Switch checked={source.shared} onChange={(v) => onChange({ shared: v })} label="Fælles" />
        <Switch checked={source.enabled} onChange={(v) => onChange({ enabled: v })} label="Vis" />
      </div>
    </CardRow>
  );
}

/** Indstillinger › Kalendere (Idé 7): your own calendars, editable; the other person's shared ones, read only; and adding a new one. */
export function CalendarSheet({ open, onOpenChange, householdId, person }: { open: boolean; onOpenChange: (v: boolean) => void; householdId: string | null; person: Person }) {
  const [rows, setRows] = useState<CalendarSource[] | null>(null);
  const [failed, setFailed] = useState(false);
  const other: Person = person === 'jonas' ? 'camilla' : 'jonas';

  const reload = useCallback(async () => {
    try {
      setRows(await loadSources());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    if (open && householdId) void reload();
  }, [open, householdId, reload]);

  const change = async (id: string, patch: SourcePatch) => {
    setRows((r) => r?.map((s) => (s.id === id ? { ...s, ...patch } : s)) ?? r);
    try {
      await updateSource(id, patch);
      calendarsChanged();
    } catch {
      notify('Det lykkedes ikke. Prøv igen.');
      void reload();
    }
  };

  const remove = async (s: CalendarSource) => {
    if (!window.confirm(`Fjern kalenderen "${s.label}"? Adressen slettes også.`)) return;
    try {
      await removeSource(s.id);
      setRows((r) => r?.filter((x) => x.id !== s.id) ?? r);
      calendarsChanged();
    } catch {
      notify('Kalenderen kunne ikke fjernes. Prøv igen.');
    }
  };

  const split = splitSources(rows ?? [], keyFromPerson(person));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader title="Kalendere" eyebrow="Vises på forsiden. Appen læser kun, den ændrer aldrig noget." />
        {!householdId ? (
          <p className="sp-body text-sp-muted">Kalendere kræver, at appen er koblet til databasen.</p>
        ) : (
          <div className="flex flex-col gap-sp-gap">
            <Explanation />
            {failed && rows === null && <p role="alert" className="sp-body">Kalenderne kunne ikke hentes.</p>}
            <section aria-labelledby="own-calendars" className="flex flex-col gap-2">
              <h3 id="own-calendars" className="sp-title-group">Dine kalendere</h3>
              {rows !== null && split.mine.length === 0 && <p className="sp-body text-sp-muted">Du har ikke tilføjet nogen kalender endnu.</p>}
              {split.mine.length > 0 && (
                <Card className="py-0">
                  {split.mine.map((s) => <OwnRow key={s.id} source={s} onChange={(p) => void change(s.id, p)} onRemove={() => void remove(s)} />)}
                </Card>
              )}
            </section>
            {split.theirs.length > 0 && (
              <section aria-labelledby="their-calendars" className="flex flex-col gap-2">
                <h3 id="their-calendars" className="sp-title-group">Fra {people[other].name}</h3>
                <Card className="py-0">
                  {split.theirs.map((s) => (
                    <CardRow key={s.id} className="flex items-center gap-2 py-3">
                      <Dot color={s.color} />
                      <span className="sp-body min-w-0 flex-1 truncate">{s.label}</span>
                      <span className="sp-caption text-sp-muted">Fælles</span>
                    </CardRow>
                  ))}
                </Card>
              </section>
            )}
            <AddForm other={other} onAdded={() => { void reload(); calendarsChanged(); }} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
