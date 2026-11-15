import { useState } from 'react';
import type { PlanEntry } from '../lib/madplan/model';
import type { Recipe } from '../lib/recipes/model';
import { isEmptyPlan, planGeneration, wantedForRecipe, type Plan, type Wanted } from '../lib/shopping/model';
import { addRecipeRows, applyPlan, loadGroceryCategories, loadRows } from '../lib/shopping/repo';
import { Button } from '../ui/button';
import { notify } from '../ui/toast';
import { ReviewSheet, type ReviewGroup } from './ReviewSheet';

const failed = () => notify('Det lykkedes ikke. Prøv igen.');

const varer = (n: number) => (n === 1 ? '1 vare' : `${n} varer`);

/** `Lav indkøbsliste` for the week on screen. Repeatable: the second press changes nothing (design §5.3.4). */
export function MakeListButton({ householdId, entries, recipes }: { householdId: string; entries: PlanEntry[]; recipes: Recipe[] }) {
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ plan: Plan; groups: ReviewGroup[] } | null>(null);

  const finish = async (plan: Plan, kept: Wanted[], have: Wanted[]) => {
    await applyPlan(householdId, plan, kept, have);
    const added = kept.length + plan.add.length;
    const parts = [
      added ? `${varer(added)} er lagt på listen` : null,
      plan.update.length ? `${varer(plan.update.length)} fik ny mængde` : null,
      plan.remove.length ? `${varer(plan.remove.length)} er fjernet` : null,
    ].filter(Boolean);
    notify(parts.length ? `${parts.join(', ')}.` : 'Intet at lægge på listen.');
  };

  const start = async () => {
    if (!entries.some((e) => e.recipe_id)) {
      notify('Ugen har ingen opskrifter at lave en liste fra.');
      return;
    }
    setBusy(true);
    try {
      const [rows, categories] = await Promise.all([loadRows(), loadGroceryCategories()]);
      const plan = planGeneration(entries, recipes, rows, categories);
      if (isEmptyPlan(plan)) {
        notify('Listen er allerede opdateret.');
      } else if (plan.review.length === 0) {
        await finish(plan, [], []);
      } else {
        setPending({
          plan,
          groups: plan.review.map((r) => ({ id: r.entry.id, title: r.recipe.title, wanted: r.wanted })),
        });
      }
    } catch {
      failed();
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (kept: Wanted[], have: Wanted[]) => {
    if (!pending) return;
    setBusy(true);
    try {
      await finish(pending.plan, kept, have);
      setPending(null);
    } catch {
      failed();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button disabled={busy} onClick={() => void start()}>Lav indkøbsliste</Button>
      <ReviewSheet open={pending !== null} groups={pending?.groups ?? []} busy={busy} onCancel={() => setPending(null)} onConfirm={(k, h) => void confirm(k, h)} />
    </>
  );
}

/** `Læg på indkøbslisten` for one recipe at the chosen number of persons. */
export function AddRecipeButton({ householdId, recipe, persons }: { householdId: string; recipe: Recipe; persons: number }) {
  const [busy, setBusy] = useState(false);
  const [groups, setGroups] = useState<ReviewGroup[] | null>(null);

  const start = async () => {
    if (recipe.ingredients.length === 0) {
      notify('Opskriften har ingen ingredienser.');
      return;
    }
    setBusy(true);
    try {
      const categories = await loadGroceryCategories();
      setGroups([{ id: recipe.id, title: recipe.title, wanted: wantedForRecipe(recipe, persons, categories) }]);
    } catch {
      failed();
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (kept: Wanted[]) => {
    setBusy(true);
    try {
      await addRecipeRows(householdId, kept);
      setGroups(null);
      notify(kept.length ? `${varer(kept.length)} er lagt på listen.` : 'Intet at lægge på listen.');
    } catch {
      failed();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button disabled={busy} onClick={() => void start()}>Læg på indkøbslisten</Button>
      <ReviewSheet open={groups !== null} groups={groups ?? []} busy={busy} onCancel={() => setGroups(null)} onConfirm={(k) => void confirm(k)} />
    </>
  );
}
