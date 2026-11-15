import { useEffect, useState } from 'react';
import { cleanDislikes, splitDislikes } from '../lib/profile/model';
import { saveProfile } from '../lib/profile/repo';
import { useProfiles } from '../lib/profile/use-profiles';
import { people, type Person } from '../lib/people';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Chip } from '../ui/chip';
import { Field } from '../ui/field';
import { notify } from '../ui/toast';

const area = 'sp-input sp-body min-h-24 w-full resize-y rounded-sp-row bg-sp-surface px-4 py-3 text-sp-ink placeholder:text-sp-muted';

/** Profile (design §5.5.1): your own dislikes and preferences, editable; the other person's, readable. Everything that suggests food uses them. */
export function ProfileSection({ householdId, person }: { householdId: string | null; person: Person }) {
  const { profiles, loaded, failed, reload } = useProfiles(householdId);
  const mine = profiles[person];
  const other: Person = person === 'jonas' ? 'camilla' : 'jonas';
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [preferences, setPreferences] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loaded) {
      setDislikes(mine.dislikes);
      setPreferences(mine.preferences);
    }
  }, [loaded, mine.dislikes, mine.preferences]);

  if (!householdId) return <p className="sp-body text-sp-muted">Profilen kræver, at appen er koblet til databasen.</p>;

  const add = () => {
    if (text.trim()) setDislikes(cleanDislikes([...dislikes, ...splitDislikes(text)]));
    setText('');
  };

  const save = async () => {
    setBusy(true);
    try {
      await saveProfile(householdId, person, cleanDislikes([...dislikes, ...splitDislikes(text)]), preferences);
      setText('');
      await reload();
      notify('Profilen er gemt.');
    } catch {
      notify('Profilen kunne ikke gemmes. Prøv igen.');
    } finally {
      setBusy(false);
    }
  };

  const o = profiles[other];
  return (
    <div className="flex flex-col gap-sp-gap">
      <section aria-labelledby="profile-title" className="flex flex-col gap-sp-gap">
        <div className="flex items-center gap-2">
          <h3 id="profile-title" className="sp-title-group">Din profil</h3>
          <Badge tone="person" person={person === 'jonas' ? 'jonas' : 'camilla'}>{people[person].name}</Badge>
        </div>
        {failed && !loaded && <p role="alert" className="sp-body">Profilen kunne ikke hentes.</p>}
        <form className="flex flex-col gap-sp-gap" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <div className="flex flex-col gap-2">
            <Field label="Tilføj noget, du ikke kan lide" placeholder="Det kan jeg ikke lide, f.eks. koriander" maxLength={60} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
            {dislikes.length > 0 ? (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Det kan du ikke lide (tryk for at fjerne)">
                {dislikes.map((d) => <Chip key={d} selected onClick={() => setDislikes(dislikes.filter((x) => x !== d))}>{d} ×</Chip>)}
              </div>
            ) : (
              <p className="sp-small text-sp-muted">Skriv en ting ad gangen, eller flere adskilt med komma.</p>
            )}
          </div>
          <label className="flex flex-col gap-1">
            <span className="sp-small text-sp-muted">Ønsker til maden (valgfri)</span>
            <textarea className={area} maxLength={1000} value={preferences} onChange={(e) => setPreferences(e.target.value)} placeholder="F.eks. meget grønt, gerne let og hurtigt" />
          </label>
          <Button type="submit" disabled={busy || !loaded}>Gem profil</Button>
        </form>
      </section>

      <section aria-labelledby="other-title" className="flex flex-col gap-2">
        <h3 id="other-title" className="sp-title-group">{people[other].name}s profil</h3>
        {o.dislikes.length === 0 && !o.preferences ? (
          <p className="sp-body text-sp-muted">{people[other].name} har ikke udfyldt sin profil endnu.</p>
        ) : (
          <>
            {o.dislikes.length > 0 && <p className="sp-body">Kan ikke lide: {o.dislikes.join(', ')}</p>}
            {o.preferences && <p className="sp-body text-sp-muted">{o.preferences}</p>}
          </>
        )}
      </section>
    </div>
  );
}
