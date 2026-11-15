import { ArrowRightLeft, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { filterRecipes, fold } from '../lib/recipes/filter';
import type { Idea } from '../lib/ideas/model';
import { dislikeHits, ideaDislikeHits, whoLabel } from '../lib/profile/model';
import type { Person } from '../lib/people';
import type { Recipe } from '../lib/recipes/model';
import { longDate, dayOfMonth, weekdayShort } from '../lib/madplan/dates';
import { cleanFreeText, dishOf, entryOn, quickDishes, type PlanEntry } from '../lib/madplan/model';
import { addEntry, moveEntry, removeEntry, setServings, swapEntries, type Dish } from '../lib/madplan/repo';
import { personsLabel } from '../lib/stepper';
import { Button } from '../ui/button';
import { Chip } from '../ui/chip';
import { DishImage } from '../ui/dish-image';
import { Field } from '../ui/field';
import { Icon } from '../ui/icon';
import { Sheet, SheetContent, SheetHeader } from '../ui/sheet';
import { Stepper } from '../ui/stepper';
import { SuggestBlock } from './SuggestBlock';
import type { Profile } from '../lib/profile/model';
import { notify } from '../ui/toast';

type Props = {
  householdId: string;
  date: string | null;
  days: string[];
  entries: PlanEntry[];
  recipes: Recipe[];
  ideas: Idea[];
  dislikes: { word: string; people: Person[] }[];
  profiles: Record<Person, Profile>;
  categories: { id: string; name: string }[];
  photos: Record<string, string>;
  onClose: () => void;
  onChanged: (message: string, undo?: () => Promise<void>) => Promise<void>;
};

/** One sheet for both jobs: fill an empty day, or manage a planned one (design §5.3.3). */
export function DaySheet({ date, entries, ...rest }: Props) {
  const entry = date ? entryOn(entries, date) : null;
  return (
    <Sheet open={date !== null} onOpenChange={(o) => !o && rest.onClose()}>
      <SheetContent aria-describedby={undefined}>
        {date && (entry ? <Manage key={entry.id} date={date} entry={entry} entries={entries} {...rest} /> : <Fill key={date} date={date} entries={entries} {...rest} />)}
      </SheetContent>
    </Sheet>
  );
}

type Shared = Omit<Props, 'date' | 'entries'> & { date: string };

function Fill({ householdId, date, entries, recipes, ideas, dislikes, profiles, categories, photos, onClose, onChanged }: Shared & { entries: PlanEntry[] }) {
  const [query, setQuery] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const shown = filterRecipes(recipes, { categoryId: null, tag: null, query }).slice(0, query.trim() ? 20 : 8);
  const q = fold(query).split(/\s+/).filter(Boolean);
  const shownIdeas = ideas
    .filter((i) => !i.promoted_recipe_id && q.every((w) => fold([i.title, ...i.tags].join(' ')).includes(w)))
    .slice(0, query.trim() ? 20 : 8);

  const add = async (dish: Dish, title: string) => {
    setBusy(true);
    try {
      await addEntry(householdId, date, dish);
      onClose();
      await onChanged(`${title} står på ${longDate(date)}.`);
    } catch {
      notify('Det lykkedes ikke. Prøv igen.');
      setBusy(false);
    }
  };
  const addText = () => {
    const free = cleanFreeText(text);
    if (free) void add({ freeText: free }, free);
  };

  return (
    <>
      <SheetHeader title="Tilføj ret" eyebrow={longDate(date)} />
      <div className="flex flex-col gap-sp-gap">
        <SuggestBlock recipes={recipes} categories={categories} ideas={ideas} weekEntries={entries} profiles={Object.values(profiles)} dislikes={dislikes} busy={busy} onPick={(dish, title) => void add(dish, title)} />
        <Field label="Søg i opskrifter" type="search" placeholder="Søg i opskrifter" value={query} onChange={(e) => setQuery(e.target.value)} />
        {shown.length > 0 ? (
          <ul aria-label="Opskrifter" className="flex flex-col gap-sp-gap-row">
            {shown.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void add({ recipeId: r.id }, r.title)}
                  className="flex min-h-sp-row w-full items-center gap-3 rounded-sp-row bg-sp-surface px-3 py-2 text-left active:bg-sp-track disabled:opacity-45"
                >
                  <DishImage shape="round" size={52} src={r.image_path ? photos[r.image_path] : undefined} name={r.title} />
                  <span className="min-w-0 flex-1">
                    <span className="sp-body-strong line-clamp-2 block">{r.title}</span>
                    {(() => {
                      const hits = dislikeHits(r, dislikes);
                      return hits.length > 0 && <span className="sp-caption block text-sp-danger">Indeholder {hits.join(', ')} ({whoLabel([...new Set(dislikes.filter((d) => hits.includes(d.word)).flatMap((d) => d.people))])} kan ikke lide)</span>;
                    })()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p role="status" className="sp-body text-sp-muted">{recipes.length ? 'Ingen opskrifter passer.' : 'Ingen opskrifter endnu. Skriv en, eller tilføj en ret herunder.'}</p>
        )}

        {shownIdeas.length > 0 && (
          <>
            <h3 className="sp-title-group">Fra aftensmadsidéer</h3>
            <ul aria-label="Aftensmadsidéer" className="flex flex-col gap-sp-gap-row">
              {shownIdeas.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void add({ ideaId: i.id }, i.title)}
                    className="sp-border-strong flex min-h-sp-row w-full items-center gap-3 rounded-sp-row border-dashed border-sp-dash px-3 py-2 text-left active:bg-sp-track disabled:opacity-45"
                  >
                    <DishImage shape="round" size={52} src={i.image_path ? photos[i.image_path] : undefined} name={i.title} />
                    <span className="min-w-0 flex-1">
                      <span className="sp-body-strong line-clamp-2 block">{i.title}</span>
                      <span className="sp-caption block text-sp-muted">Idé – tjek ingredienser</span>
                      {ideaDislikeHits(i, dislikes).length > 0 && <span className="sp-caption block text-sp-danger">Nævner {ideaDislikeHits(i, dislikes).join(', ')}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <h3 className="sp-title-group">Skriv selv</h3>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Hurtige valg">
          {quickDishes.map((d) => (
            <Chip key={d} selected={false} disabled={busy} onClick={() => void add({ freeText: d }, d)}>{d}</Chip>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); addText(); }}>
          <Field label="Egen ret" placeholder="F.eks. Mad hos mor" maxLength={120} value={text} onChange={(e) => setText(e.target.value)} action={{ label: 'Tilføj ret', icon: Plus, onClick: addText }} />
        </form>
      </div>
    </>
  );
}

function Manage({ householdId, date, days, entry, entries, recipes, ideas, photos, onClose, onChanged }: Shared & { entry: PlanEntry; entries: PlanEntry[] }) {
  const dish = dishOf(entry, recipes, ideas);
  const [servings, setLocal] = useState(entry.servings ?? 2);
  const [moving, setMoving] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setLocal(entry.servings ?? 2), [entry.servings]);

  const run = async (job: () => Promise<void>, message: string, undo?: () => Promise<void>) => {
    setBusy(true);
    try {
      await job();
      onClose();
      await onChanged(message, undo);
    } catch {
      notify('Det lykkedes ikke. Prøv igen.');
      setBusy(false);
    }
  };

  const changeServings = async (n: number) => {
    const before = servings;
    setLocal(n);
    try {
      await setServings(entry.id, n);
      await onChanged(`${personsLabel(n)} til ${dish.title}.`);
    } catch {
      setLocal(before);
      notify('Det lykkedes ikke. Prøv igen.');
    }
  };

  const restore = () => addEntry(householdId, entry.date, entry.recipe_id ? { recipeId: entry.recipe_id } : entry.idea_id ? { ideaId: entry.idea_id } : { freeText: entry.free_text ?? dish.title }, entry.servings ?? 2);

  return (
    <>
      <SheetHeader title={dish.title} eyebrow={longDate(date)} />
      <div className="flex flex-col gap-sp-gap">
        <div className="flex items-center gap-3">
          <DishImage shape="round" size={64} src={dish.recipe?.image_path ? photos[dish.recipe.image_path] : undefined} name={dish.title} />
          <div className="min-w-0 flex-1"><Stepper value={servings} onChange={(n) => void changeServings(n)} /></div>
        </div>

        {dish.recipe && (
          <Button asChild variant="outline"><a href={`#opskrifter/${dish.recipe.id}`} onClick={onClose}><Icon icon={ExternalLink} />Åbn opskrift</a></Button>
        )}

        {moving ? (
          <div className="flex flex-col gap-2">
            <p className="sp-body-strong">Flyt til</p>
            <ul aria-label="Vælg dag" className="flex flex-col gap-sp-gap-row">
              {days.filter((d) => d !== date).map((d) => {
                const other = entryOn(entries, d);
                return (
                  <li key={d}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void (other
                        ? run(() => swapEntries(entry, other), `${dish.title} og ${dishOf(other, recipes, ideas).title} har byttet plads.`, () => swapEntries({ id: entry.id, date: d }, { id: other.id, date }))
                        : run(() => moveEntry(entry.id, d), `${dish.title} er flyttet til ${longDate(d)}.`, () => moveEntry(entry.id, date)))}
                      className="flex min-h-sp-target w-full items-center justify-between gap-3 rounded-sp-row bg-sp-surface px-4 text-left active:bg-sp-track disabled:opacity-45"
                    >
                      <span className="sp-body-strong">{weekdayShort(d)} {dayOfMonth(d)}.</span>
                      <span className="sp-caption min-w-0 truncate text-sp-muted">{other ? `Byt med ${dishOf(other, recipes, ideas).title}` : 'Tom'}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setMoving(true)}><Icon icon={ArrowRightLeft} />Flyt eller byt</Button>
        )}

        <Button variant="quiet" disabled={busy} className="text-sp-danger" onClick={() => void run(() => removeEntry(entry.id), `${dish.title} er fjernet fra ${longDate(date)}.`, restore)}>
          <Icon icon={Trash2} />Fjern fra dagen
        </Button>
      </div>
    </>
  );
}


