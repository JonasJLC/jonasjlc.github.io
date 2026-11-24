import { Circle, Droplet, Watch, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import {
  copenhagenToday,
  defaultSharing,
  errorText,
  formatSync,
  missingDataHint,
  PROVIDERS,
  sourceNames,
  type Metric,
  type ProviderId,
  type SourceStatus,
} from '../lib/health/model';
import { deletePeriodStart, disconnectSource, HealthCallError, logPeriodStart, saveGarminGoal, saveGarminKey, saveSharing, startOura, syncHealth } from '../lib/health/repo';
import { useHealthSettings } from '../lib/health/use-health';
import { people, type Person } from '../lib/people';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Icon } from '../ui/icon';
import { SheetContent, SheetHeader } from '../ui/sheet';
import { Switch } from '../ui/switch';
import { notify } from '../ui/toast';
import { SharingConfirm } from './SharingConfirm';

const icons: Record<ProviderId, LucideIcon> = { oura: Circle, garmin: Watch };
const codeOf = (e: unknown) => (e instanceof HealthCallError ? e.code : 'internal');
const formatDay = (iso: string) => new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));
const steps = (n: number) => new Intl.NumberFormat('da-DK').format(n);

type Step = { kind: 'list' } | { kind: 'confirm'; source: ProviderId } | { kind: 'sharing' } | { kind: 'disconnect'; source: ProviderId };

function SourceTile({ source }: { source: ProviderId }) {
  return (
    <span aria-hidden className="flex size-sp-target shrink-0 items-center justify-center rounded-sp-check bg-sp-track text-sp-ink">
      <Icon icon={icons[source]} />
    </span>
  );
}

/** "Forbind enheder" (idea 10, mockup image5 left): each person connects their own source; nothing is shared before the confirmation. */
export function ConnectSheet({ householdId, person }: { householdId: string; person: Person }) {
  const { sources, sharing, periods, status, reload } = useHealthSettings(householdId, person);
  const [step, setStep] = useState<Step>({ kind: 'list' });
  const [busy, setBusy] = useState(false);
  const [garminKey, setGarminKey] = useState('');
  const [garminGoal, setGarminGoal] = useState('');
  const [deleteData, setDeleteData] = useState(true);
  const [goalEdit, setGoalEdit] = useState<string | null>(null);

  const other: Person = person === 'jonas' ? 'camilla' : 'jonas';
  const otherName = people[other].name;
  const mine = sources.filter((s) => s.person === person);
  const theirs = sources.filter((s) => s.person === other);
  const own = (source: ProviderId): SourceStatus | undefined => mine.find((s) => s.source === source);
  const initialSharing = sharing.confirmed ? sharing.values : defaultSharing;
  const parsedGoal = (text: string): number | null | 'bad' => {
    if (!text.trim()) return null;
    const n = Number(text.replace(/\D/g, ''));
    return Number.isInteger(n) && n >= 100 && n <= 100_000 ? n : 'bad';
  };

  const confirmAndConnect = async (source: ProviderId, values: Record<Metric, boolean>) => {
    setBusy(true);
    try {
      if (source === 'oura') {
        await saveSharing(householdId, person, values);
        const { url } = await startOura();
        window.location.assign(url); // Oura's consent page; the callback brings us back to #hjem?forbundet=oura
        return;
      }
      const goal = parsedGoal(garminGoal);
      if (goal === 'bad') {
        notify('Skridtmålet skal være et tal mellem 100 og 100.000.');
        return;
      }
      await saveGarminKey(garminKey.trim(), goal);
      await saveSharing(householdId, person, values);
      setGarminKey('');
      setGarminGoal('');
      setStep({ kind: 'list' });
      notify('Garmin er forbundet.');
      await syncHealth(true).catch(() => null);
      await reload();
    } catch (e) {
      notify(errorText(codeOf(e)) ?? 'Det lykkedes ikke. Prøv igen.');
    } finally {
      setBusy(false);
    }
  };

  const changeSharing = async (values: Record<Metric, boolean>) => {
    setBusy(true);
    try {
      await saveSharing(householdId, person, values);
      setStep({ kind: 'list' });
      notify('Delingen er gemt.');
      await reload();
    } catch {
      notify('Kunne ikke gemme. Prøv igen.');
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async (source: ProviderId) => {
    setBusy(true);
    try {
      await disconnectSource(source, deleteData);
      setStep({ kind: 'list' });
      notify(`${sourceNames[source]} er afbrudt.`);
      await reload();
    } catch {
      notify('Forbindelsen kunne ikke afbrydes. Prøv igen.');
    } finally {
      setBusy(false);
    }
  };

  const saveGoal = async () => {
    const goal = parsedGoal(goalEdit ?? '');
    if (goal === 'bad') return notify('Skridtmålet skal være et tal mellem 100 og 100.000.');
    setBusy(true);
    try {
      await saveGarminGoal(goal);
      setGoalEdit(null);
      await reload();
    } catch {
      notify('Skridtmålet kunne ikke gemmes. Prøv igen.');
    } finally {
      setBusy(false);
    }
  };

  const logPeriod = async () => {
    setBusy(true);
    try {
      await logPeriodStart(householdId, person, copenhagenToday());
      await reload();
      notify('Første dag er gemt.');
    } catch {
      notify('Det kunne ikke gemmes. Prøv igen.');
    } finally {
      setBusy(false);
    }
  };

  const removePeriod = async (id: string) => {
    setBusy(true);
    try {
      await deletePeriodStart(id);
      await reload();
    } catch {
      notify('Det kunne ikke slettes. Prøv igen.');
    } finally {
      setBusy(false);
    }
  };

  let body;
  if (status === 'loading') {
    body = <p className="sp-body text-sp-muted" role="status">Henter forbindelser …</p>;
  } else if (status === 'error') {
    body = (
      <Card className="flex flex-col gap-3">
        <p role="alert" className="sp-body">Forbindelserne kunne ikke hentes.</p>
        <Button variant="outline" onClick={() => void reload()}>Prøv igen</Button>
      </Card>
    );
  } else if (step.kind === 'confirm') {
    body = (
      <div className="flex flex-col gap-sp-gap">
        {step.source === 'garmin' && (
          <Card className="flex flex-col gap-3">
            <p className="sp-body-strong">Garmin-nøgle</p>
            <p className="sp-small text-sp-muted">
              Lav en personlig API-nøgle i Garmin Connect på nettet (Indstillinger › Personlig API-nøgle) og indsæt den her. Den gemmes
              krypteret og vises aldrig igen.
            </p>
            <label className="flex flex-col gap-1">
              <span className="sp-small text-sp-muted">API-nøgle</span>
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                className="sp-input h-12.5 w-full rounded-sp-pill bg-sp-track px-5 text-sp-ink"
                value={garminKey}
                maxLength={512}
                onChange={(e) => setGarminKey(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="sp-small text-sp-muted">Dagligt skridtmål (bruges, hvis Garmin ikke har et)</span>
              <input
                inputMode="numeric"
                className="sp-input h-12.5 w-full rounded-sp-pill bg-sp-track px-5 text-sp-ink"
                placeholder="F.eks. 8000"
                value={garminGoal}
                onChange={(e) => setGarminGoal(e.target.value)}
              />
            </label>
          </Card>
        )}
        <SharingConfirm
          otherName={otherName}
          initial={initialSharing}
          busy={busy || (step.source === 'garmin' && garminKey.trim().length < 16)}
          submitLabel={step.source === 'oura' ? 'Gem og fortsæt til Oura' : 'Gem og del'}
          onSubmit={(values) => void confirmAndConnect(step.source, values)}
          onCancel={() => setStep({ kind: 'list' })}
        />
      </div>
    );
  } else if (step.kind === 'sharing') {
    body = (
      <SharingConfirm otherName={otherName} initial={initialSharing} busy={busy} submitLabel="Gem" onSubmit={(v) => void changeSharing(v)} onCancel={() => setStep({ kind: 'list' })} />
    );
  } else if (step.kind === 'disconnect') {
    body = (
      <Card className="flex flex-col gap-sp-gap">
        <p className="sp-body-strong">Afbryd {sourceNames[step.source]}?</p>
        <p className="sp-small text-sp-muted">Forbindelsen slettes, og {otherName} kan ikke længere se nye tal herfra.</p>
        <Switch label="Slet også de hentede data" checked={deleteData} disabled={busy} onCheckedChange={setDeleteData} />
        <div className="flex flex-col gap-2">
          <Button disabled={busy} onClick={() => void disconnect(step.source)}>Afbryd</Button>
          <Button variant="quiet" disabled={busy} onClick={() => setStep({ kind: 'list' })}>Fortryd</Button>
        </div>
      </Card>
    );
  } else {
    const connected = mine.filter((s) => s.lastError !== 'reconnect');
    body = (
      <div className="flex flex-col gap-sp-gap">
        <section aria-labelledby="mine-title" className="flex flex-col gap-2">
          <h3 id="mine-title" className="sp-title-group">Dine enheder</h3>
          {PROVIDERS.map((source) => {
            const s = own(source);
            const error = errorText(s?.lastError ?? null);
            const expired = s?.lastError === 'reconnect';
            return (
              <Card key={source} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <SourceTile source={source} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="sp-body-strong">{sourceNames[source]}</span>
                    <span className="sp-small text-sp-muted">{s ? formatSync(source, s.lastSyncedAt) : 'Ikke forbundet'}</span>
                  </span>
                  {s && !expired ? (
                    <span className="sp-small shrink-0 text-sp-muted">Forbundet</span>
                  ) : (
                    <Button variant="outline" disabled={busy} onClick={() => { setDeleteData(true); setStep({ kind: 'confirm', source }); }}>
                      {expired ? 'Forbind igen' : 'Forbind'}
                    </Button>
                  )}
                </div>
                {error && <p role="status" className="sp-small">{error}</p>}
                {s && source === 'garmin' && (
                  goalEdit === null ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="sp-small text-sp-muted">Skridtmål: {s.stepGoal ? steps(s.stepGoal) : 'fra Garmin'}</span>
                      <Button variant="quiet" disabled={busy} onClick={() => setGoalEdit(s.stepGoal ? String(s.stepGoal) : '')}>Skift</Button>
                    </div>
                  ) : (
                    <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void saveGoal(); }}>
                      <label className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="sp-small text-sp-muted">Dagligt skridtmål (tomt: brug Garmins)</span>
                        <input inputMode="numeric" className="sp-input h-12.5 w-full rounded-sp-pill bg-sp-track px-5 text-sp-ink" value={goalEdit} onChange={(e) => setGoalEdit(e.target.value)} />
                      </label>
                      <Button type="submit" variant="outline" disabled={busy}>Gem</Button>
                    </form>
                  )
                )}
                {s && (
                  <Button variant="quiet" className="self-start" disabled={busy} onClick={() => { setDeleteData(true); setStep({ kind: 'disconnect', source }); }}>
                    Afbryd
                  </Button>
                )}
              </Card>
            );
          })}
          {person === 'camilla' && (
            // Cycle day comes from this log (ADR-06 Decision 3); it is private until shared.
            <Card className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span aria-hidden className="flex size-sp-target shrink-0 items-center justify-center rounded-sp-check bg-sp-track text-sp-ink">
                  <Icon icon={Droplet} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="sp-body-strong">Min cyklus</span>
                  <span className="sp-small text-sp-muted">
                    {periods[0] ? `Seneste første dag: ${formatDay(periods[0].period_start)}` : 'Ingen første dag gemt endnu'}
                  </span>
                </span>
              </div>
              <Button variant="outline" disabled={busy || periods[0]?.period_start === copenhagenToday()} onClick={() => void logPeriod()}>
                Første dag i menstruation
              </Button>
              {periods[0] && (
                <Button variant="quiet" className="self-start" disabled={busy} onClick={() => void removePeriod(periods[0].id)}>
                  Fjern {formatDay(periods[0].period_start)}
                </Button>
              )}
            </Card>
          )}
        </section>

        {sharing.confirmed && (
          <section aria-labelledby="sharing-title" className="flex flex-col gap-2">
            <h3 id="sharing-title" className="sp-title-group">Deling</h3>
            <p className="sp-small text-sp-muted">
              Du deler: {(Object.keys(sharing.values) as Metric[]).filter((m) => sharing.values[m]).map((m) => ({ sleep_score: 'søvn', activity: 'aktivitet', steps: 'skridt', cycle_day: 'cyklus' })[m]).join(', ') || 'intet'}.
            </p>
            <Button variant="quiet" className="self-start" disabled={busy} onClick={() => setStep({ kind: 'sharing' })}>
              Skift hvad {otherName} kan se
            </Button>
          </section>
        )}

        <section aria-labelledby="theirs-title" className="flex flex-col gap-2">
          <h3 id="theirs-title" className="sp-title-group">{otherName}s enheder</h3>
          {theirs.length === 0 ? (
            <p className="sp-body text-sp-muted">{otherName} har ikke forbundet noget endnu.</p>
          ) : (
            theirs.map((s) => (
              <Card key={s.source} className="flex items-center gap-3">
                <SourceTile source={s.source} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="sp-body-strong">{sourceNames[s.source]}</span>
                  <span className="sp-small text-sp-muted">{formatSync(s.source, s.lastSyncedAt)}</span>
                </span>
              </Card>
            ))
          )}
        </section>

        {connected.length > 0 && (
          <Card className="flex flex-col gap-1">
            <p className="sp-body-strong">Hvis data mangler</p>
            {connected.map((s) => <p key={s.source} className="sp-small text-sp-muted">{missingDataHint(s.source)}</p>)}
          </Card>
        )}
      </div>
    );
  }

  return (
    <SheetContent>
      <SheetHeader title="Forbind enheder" eyebrow="Hver af jer forbinder jeres egen enhed. Jeres login deles ikke med hinanden." />
      {body}
    </SheetContent>
  );
}
