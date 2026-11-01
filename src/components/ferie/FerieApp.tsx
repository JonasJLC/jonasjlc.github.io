import { Moon, Plane, Settings, Sun, Wallet, Map } from 'lucide-react';
import { Tabs } from 'radix-ui';
import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { Feriedage } from './feriedage/Feriedage';
import { Kassen } from './kassen/Kassen';
import { Plan } from './plan/Plan';
import { useFerie } from './lib/use-ferie';
import { Button } from './ui/button';
import { cn } from './lib/utils';

type Theme = 'light' | 'dark';
const THEME_KEY = 'ferie-theme';

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const s = localStorage.getItem(THEME_KEY);
      if (s === 'light' || s === 'dark') return s;
    } catch { /* ignore */ }
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0e171b' : '#eaf0ef');
  }, [theme]);
  return [theme, () => setTheme((t) => {
    const next = t === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
    return next;
  })];
}

const TABS = [
  { value: 'feriedage', label: 'Feriedage', icon: Plane, ready: true },
  { value: 'rejsekassen', label: 'Rejsekassen', icon: Wallet, ready: true },
  { value: 'rejseplan', label: 'Rejseplan', icon: Map, ready: true },
];

export default function FerieApp() {
  const [state, dispatch] = useFerie();
  const [theme, toggleTheme] = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tab, setTab] = useState('feriedage');
  const Y = state.settings.year;

  return (
    <Tabs.Root value={tab} onValueChange={setTab} className="min-h-dvh">
      <div className="mx-auto max-w-[1180px] px-4 pb-44 pt-6 sm:px-6 md:pb-16 md:pt-10">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div>
            <h1 className="font-display text-5xl font-extrabold leading-none tracking-tight sm:text-6xl">Ferieplan</h1>
            <p className="mt-2 max-w-prose text-muted-foreground">Feriedage, rejser og rejsekasse – samlet for jer to.</p>
          </div>
          <div className="flex items-center gap-2">
            <div role="group" aria-label="Vælg år" className="inline-flex rounded-full border bg-card p-1">
              {[Y - 1, Y, Y + 1].map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={v === Y}
                  onClick={() => dispatch({ type: 'year', year: v })}
                  className={cn('h-9 rounded-full px-3.5 text-sm font-semibold tabular-nums text-muted-foreground transition-colors', v === Y && 'bg-primary text-primary-foreground')}
                >
                  {v}
                </button>
              ))}
            </div>
            <Button variant="outline" size="icon" aria-label="Indstillinger" onClick={() => setSettingsOpen(true)}><Settings className="size-5" /></Button>
            <Button variant="outline" size="icon" aria-label={theme === 'dark' ? 'Skift til lyst tema' : 'Skift til mørkt tema'} onClick={toggleTheme}>
              {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </Button>
          </div>
        </header>

        <Tabs.List
          aria-label="Visning"
          className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:static md:mb-6 md:inline-flex md:rounded-full md:border md:p-1 md:pb-1"
        >
          {TABS.map(({ value, label, icon: Icon, ready }) => (
            <Tabs.Trigger
              key={value}
              value={value}
              disabled={!ready}
              className="flex h-16 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold text-muted-foreground transition-colors disabled:opacity-45 data-[state=active]:text-foreground md:h-10 md:flex-row md:gap-2 md:rounded-full md:px-4 md:text-sm md:data-[state=active]:bg-primary md:data-[state=active]:text-primary-foreground"
            >
              <Icon className="size-5 md:size-4" aria-hidden />
              <span>{label}{!ready && <small className="ml-1 hidden font-normal md:inline">· snart</small>}</span>
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <main>
          <Tabs.Content value="feriedage" className="outline-none">
            <Feriedage state={state} dispatch={dispatch} settingsOpen={settingsOpen} setSettingsOpen={setSettingsOpen} />
          </Tabs.Content>
          <Tabs.Content value="rejsekassen" className="outline-none">
            <Kassen state={state} dispatch={dispatch} />
          </Tabs.Content>
          <Tabs.Content value="rejseplan" className="outline-none">
            <Plan state={state} dispatch={dispatch} />
          </Tabs.Content>
        </main>
      </div>
      <Toaster position="top-center" richColors closeButton />
    </Tabs.Root>
  );
}
