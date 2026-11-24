import { Minus, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
  habitColorNames, habitColors, validateHabitDraft, type DraftErrors, type Frequency, type Habit, type HabitColor, type HabitDraft, type Owner,
} from '../lib/habits/model';
import { suggestions, type Rule, type RuleMetric, type RuleOp } from '../lib/habits/rules';
import { textToThreshold, thresholdToText } from '../lib/habits/view';
import { addDays, weekdayLong } from '../lib/madplan/dates';
import { cn } from '../lib/utils';
import { Button } from '../ui/button';
import { Chip } from '../ui/chip';
import { Field } from '../ui/field';
import { Icon } from '../ui/icon';
import { Sheet, SheetContent, SheetHeader } from '../ui/sheet';

const colorNames: Record<HabitColor, string> = {
  sage: 'Salvie', moss: 'Mos', sky: 'Himmel', lavender: 'Lavendel', plum: 'Blomme', rose: 'Rose', clay: 'Ler', sand: 'Sand',
};
const presetIcons = ['💧', '🚶', '🏃', '🧘', '📖', '🥗', '😴', '💊', '🦷', '🪴', '🧹', '✍️'];
const metricNames: Record<RuleMetric, string> = { steps: 'Skridt', sleep_score: 'Søvnscore', activity_progress: 'Aktivitet (%)' };
const MONDAY = '2026-11-23'; // any Monday: only the weekday names are used

type Props = {
  open: boolean;
  /** The habit being edited; omitted for a new one. */
  habit?: Habit | null;
  /** The signed-in person's key: a new personal habit is theirs. */
  me: 'a' | 'b' | null;
  /** Metrics the person has data or a connected source for (the suggestions are limited to these). */
  available: RuleMetric[];
  /** A connected health source. Automatic habits stay off until there is one. */
  hasSource: boolean;
  onClose: () => void;
  onSave: (draft: HabitDraft, id?: string) => Promise<boolean>;
};

/** "Ny vane" / "Rediger vane" (image8). The body mounts when the sheet opens, so each opening starts from the habit or from empty. */
export function HabitSheet({ open, habit, onClose, ...rest }: Props) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <Body habit={habit ?? null} onClose={onClose} {...rest} />
      </SheetContent>
    </Sheet>
  );
}

function Group({ title, hint, error, children }: { title: string; hint?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2 border-0 p-0">
      <legend className="sp-body-strong mb-2">{title}</legend>
      {children}
      {hint && <p className="sp-small text-sp-muted">{hint}</p>}
      {error && <p role="alert" className="sp-small text-sp-ink">{error}</p>}
    </fieldset>
  );
}

const Row = ({ children, className }: { children: ReactNode; className?: string }) => <div className={cn('flex flex-wrap gap-2', className)}>{children}</div>;

function Body({ habit, me, available, hasSource, onClose, onSave }: Omit<Props, 'open' | 'habit'> & { habit: Habit | null }) {
  const editing = habit !== null;
  const [title, setTitle] = useState(habit?.title ?? '');
  const [tracking, setTracking] = useState<'manual' | 'automatic'>(habit?.tracking ?? 'manual');
  const [freqKind, setFreqKind] = useState<Frequency['kind']>(habit?.frequency.kind ?? 'daily');
  const [count, setCount] = useState(habit?.frequency.kind === 'per_week' ? habit.frequency.count : 3);
  const [days, setDays] = useState<number[]>(habit?.frequency.kind === 'weekdays' ? habit.frequency.days : []);
  const [owner, setOwner] = useState<Owner>(habit?.owner ?? me ?? 'both');
  const [reminder, setReminder] = useState(habit?.reminderTime ?? '');
  const [color, setColor] = useState<HabitColor>(habit?.color ?? 'sage');
  const [icon, setIcon] = useState<string>(habit?.icon ?? '');
  const initialRule: Rule = habit?.rule ?? { metric: 'steps', op: '>=', threshold: 8000 };
  const [metric, setMetric] = useState<RuleMetric>(initialRule.metric);
  const [op, setOp] = useState<RuleOp>(initialRule.op);
  const [threshold, setThreshold] = useState(thresholdToText(initialRule));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [busy, setBusy] = useState(false);

  const automatic = tracking === 'automatic';
  // Editing an automatic habit keeps it automatic even if the source has gone; a new one needs a source.
  const canAutomatic = hasSource || habit?.tracking === 'automatic';
  const ruleThreshold = textToThreshold(metric, threshold);
  const rule: Rule | null = automatic && ruleThreshold !== null ? { metric, op, threshold: ruleThreshold } : null;

  const draft: HabitDraft = {
    owner: automatic && owner === 'both' ? (me ?? owner) : owner,
    title,
    tracking,
    frequency: freqKind === 'daily' ? { kind: 'daily' } : freqKind === 'per_week' ? { kind: 'per_week', count } : { kind: 'weekdays', days },
    rule,
    color,
    icon: icon.trim() === '' ? null : icon.trim(),
    reminderTime: reminder === '' ? null : reminder,
  };

  const chooseTracking = (t: 'manual' | 'automatic') => {
    setTracking(t);
    if (t === 'automatic' && owner === 'both' && me) setOwner(me);
  };

  const submit = async () => {
    const { ok, errors: found } = validateHabitDraft(draft);
    setErrors(found);
    if (!ok || busy) return;
    setBusy(true);
    const saved = await onSave(draft, habit?.id);
    setBusy(false);
    if (saved) onClose();
  };

  return (
    <>
      <SheetHeader title={editing ? 'Rediger vane' : 'Ny vane'} />
      <form className="flex flex-col gap-sp-gap" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Group title="Hvordan registreres den?" error={errors.rule} hint={!canAutomatic ? 'Forbind en enhed under Indstillinger for automatiske vaner.' : undefined}>
          <Row>
            <Chip selected={!automatic} onClick={() => chooseTracking('manual')}>Jeg krydser af</Chip>
            <Chip selected={automatic} disabled={!canAutomatic} className="disabled:opacity-45" onClick={() => chooseTracking('automatic')}>Automatisk</Chip>
          </Row>
          {automatic && (
            <>
              {suggestions(available).length > 0 && (
                <Row>
                  {suggestions(available).map((s) => (
                    <Chip
                      key={s.title}
                      selected={title === s.title && metric === s.rule.metric && op === s.rule.op && textToThreshold(s.rule.metric, threshold) === s.rule.threshold}
                      onClick={() => { setTitle(s.title); setMetric(s.rule.metric); setOp(s.rule.op); setThreshold(thresholdToText(s.rule)); }}
                    >
                      {s.title}
                    </Chip>
                  ))}
                </Row>
              )}
              <p className="sp-small text-sp-muted">Eller lav din egen regel:</p>
              <Row>
                {(Object.keys(metricNames) as RuleMetric[]).map((m) => (
                  <Chip key={m} selected={metric === m} onClick={() => { setMetric(m); setThreshold(thresholdToText({ metric: m, threshold: m === 'steps' ? 8000 : m === 'sleep_score' ? 75 : 1 })); }}>
                    {metricNames[m]}
                  </Chip>
                ))}
              </Row>
              <Row>
                <Chip selected={op === '>='} onClick={() => setOp('>=')}>Mindst</Chip>
                <Chip selected={op === '>'} onClick={() => setOp('>')}>Over</Chip>
              </Row>
              <Field label="Grænse" type="number" inputMode="decimal" min={0} value={threshold} onChange={(e) => setThreshold(e.target.value)} />
            </>
          )}
        </Group>

        <Group title="Navn" error={errors.title}>
          <Field label="Navn på vanen" placeholder="Fx Drik vand" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={errors.title ? true : undefined} />
        </Group>

        <Group title="Hvor tit?" error={errors.frequency}>
          <Row>
            <Chip selected={freqKind === 'daily'} onClick={() => setFreqKind('daily')}>Hver dag</Chip>
            <Chip selected={freqKind === 'per_week'} onClick={() => setFreqKind('per_week')}>{count} dage om ugen</Chip>
            <Chip selected={freqKind === 'weekdays'} onClick={() => setFreqKind('weekdays')}>Bestemte dage</Chip>
          </Row>
          {freqKind === 'per_week' && (
            <div className="flex items-center gap-2">
              <Button variant="icon" aria-label="Færre dage" aria-disabled={count <= 1} onClick={() => setCount((c) => Math.max(1, c - 1))}><Icon icon={Minus} /></Button>
              <span aria-live="polite" className="sp-body-strong min-w-24 text-center">{count} {count === 1 ? 'dag' : 'dage'} om ugen</span>
              <Button variant="icon" aria-label="Flere dage" aria-disabled={count >= 7} onClick={() => setCount((c) => Math.min(7, c + 1))}><Icon icon={Plus} /></Button>
            </div>
          )}
          {freqKind === 'weekdays' && (
            <div role="group" aria-label="Dage" className="flex gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                const name = weekdayLong(addDays(MONDAY, d - 1));
                return (
                  <Chip
                    key={d}
                    selected={days.includes(d)}
                    aria-label={name}
                    className="min-w-0 flex-1 px-0"
                    onClick={() => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort((a, b) => a - b)))}
                  >
                    {name.charAt(0).toUpperCase()}
                  </Chip>
                );
              })}
            </div>
          )}
        </Group>

        <Group
          title="Hvis"
          error={errors.owner}
          hint={editing ? 'Ejeren kan ikke ændres.' : automatic ? 'Automatiske vaner er personlige.' : undefined}
        >
          <Row>
            <Chip selected={owner !== 'both'} disabled={editing || !me} className="disabled:opacity-45" onClick={() => me && setOwner(me)}>Min</Chip>
            <Chip selected={owner === 'both'} disabled={editing || automatic} className="disabled:opacity-45" onClick={() => setOwner('both')}>Fælles</Chip>
          </Row>
        </Group>

        <Group title="Påmindelse (valgfri)" error={errors.reminderTime} hint="Vises ved vanen; appen sender ikke notifikationer endnu.">
          <Row className="items-center">
            <Field label="Påmindelse, klokkeslæt" type="time" value={reminder} onChange={(e) => setReminder(e.target.value)} className="w-40" />
            {reminder !== '' && <Button variant="quiet" onClick={() => setReminder('')}>Fjern</Button>}
          </Row>
        </Group>

        <Group title="Farve" error={errors.color}>
          <div role="group" aria-label="Farve" className="flex flex-wrap gap-1">
            {habitColorNames.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={color === n}
                aria-label={colorNames[n]}
                onClick={() => setColor(n)}
                className="inline-flex size-sp-target items-center justify-center rounded-full"
              >
                <span className={cn('flex size-8 items-center justify-center rounded-full', habitColors[n].fill, color === n && 'ring-2 ring-sp-ink ring-offset-2 ring-offset-sp-bg')}>
                  {color === n && <span className="size-2 rounded-full bg-sp-on-primary" />}
                </span>
              </button>
            ))}
          </div>
        </Group>

        <Group title="Ikon (valgfri)" error={errors.icon}>
          <div role="group" aria-label="Ikon" className="flex flex-wrap gap-1">
            {presetIcons.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={icon === e}
                aria-label={`Ikon ${e}`}
                onClick={() => setIcon(icon === e ? '' : e)}
                className={cn('inline-flex size-sp-target items-center justify-center rounded-sp-row text-xl', icon === e ? cn(habitColors[color].tint, 'sp-border-strong', habitColors[color].border) : 'bg-sp-surface')}
              >
                {e}
              </button>
            ))}
          </div>
          <Field label="Eget ikon (et emoji)" placeholder="Eget emoji" maxLength={16} value={icon} onChange={(e) => setIcon(e.target.value)} />
        </Group>

        <Button type="submit" aria-disabled={busy || undefined}>{editing ? 'Gem' : 'Opret vane'}</Button>
      </form>
    </>
  );
}
