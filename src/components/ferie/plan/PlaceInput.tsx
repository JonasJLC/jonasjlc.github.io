import { MapPinIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '../lib/utils';

export interface Place { base: string; lat?: number; lng?: number }
interface Suggestion { label: string; lat: number; lng: number }

const MAX = 60;

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: { name?: string; street?: string; housenumber?: string; city?: string; town?: string; village?: string; country?: string };
}

function toSuggestion(f: PhotonFeature): Suggestion | null {
  const p = f.properties ?? {};
  const c = f.geometry?.coordinates;
  if (!c || c.length < 2) return null;
  const street = p.street ? `${p.street}${p.housenumber ? ` ${p.housenumber}` : ''}` : '';
  const name = p.name || street;
  if (!name) return null;
  const place = p.city || p.town || p.village || '';
  const label = [name, place || p.country].filter(Boolean).join(', ');
  return { label, lat: c[1], lng: c[0] };
}

/** Free-text place field with OpenStreetMap (Photon) suggestions. Typing freely always works. */
export function PlaceInput({ value, lat, lng, label, onChange }: {
  value: string; lat?: number; lng?: number; label: string; onChange: (p: Place) => void;
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const typed = useRef(false);
  const listId = useId();

  useEffect(() => {
    const q = value.trim();
    if (!typed.current || q.length < 3) { setItems([]); return; }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((j: { features?: PhotonFeature[] }) => {
          const seen = new Set<string>();
          const out = (j.features ?? []).map(toSuggestion).filter((s): s is Suggestion => !!s && !seen.has(s.label) && !!seen.add(s.label));
          setItems(out);
          setActive(-1);
        })
        .catch(() => { if (!ctrl.signal.aborted) setItems([]); });
    }, 350);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [value]);

  const pick = (s: Suggestion) => {
    typed.current = false;
    setItems([]);
    setOpen(false);
    onChange({ base: s.label.slice(0, MAX), lat: s.lat, lng: s.lng });
  };
  const show = open && items.length > 0;
  const pinned = lat !== undefined && lng !== undefined;

  return (
    <div className="relative flex h-full min-w-0 flex-1 items-center gap-1">
      <input
        className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
        placeholder="Hvor sover I?"
        aria-label={label}
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={show && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={value}
        maxLength={MAX}
        onChange={(e) => { typed.current = true; setOpen(true); onChange({ base: e.target.value }); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          else if (!show) return;
          else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % items.length); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a <= 0 ? items.length - 1 : a - 1)); }
          else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(items[active]); }
        }}
      />
      {pinned && (
        <a
          href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Vis ${value} på kortet (åbner i ny fane)`}
          title="Vis på kortet"
        >
          <MapPinIcon className="size-4" aria-hidden />
        </a>
      )}
      {show && (
        <ul id={listId} role="listbox" className="absolute top-full left-0 z-20 mt-1 w-full min-w-56 overflow-hidden rounded-xl border border-input bg-card py-1 shadow-md">
          {items.map((s, i) => (
            <li
              key={s.label}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={cn('cursor-pointer px-3 py-2 text-sm', i === active && 'bg-accent')}
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
              onMouseEnter={() => setActive(i)}
            >
              {s.label}
            </li>
          ))}
          <li role="presentation" className="px-3 pt-1 text-[11px] text-muted-foreground">© OpenStreetMap</li>
        </ul>
      )}
    </div>
  );
}
