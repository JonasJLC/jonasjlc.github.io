import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { AuthGate } from './AuthGate';
import { Feriedage } from './feriedage/Feriedage';
import { SettingsSheet } from './feriedage/SettingsSheet';
import { Forslag } from './forslag/Forslag';
import { Kassen } from './kassen/Kassen';
import { Plan } from './plan/Plan';
import { useFerie } from './lib/use-ferie';
import { useSync } from './lib/use-sync';
import { Sidebar, TopBar, VIEWS, type Theme, type View } from './Sidebar';

const THEME_KEY = 'ferie-theme';
const FRAME = { light: '#f2ece4', dark: '#100e0c' };

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
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', FRAME[theme]);
  }, [theme]);
  return [theme, () => setTheme((t) => {
    const next = t === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
    return next;
  })];
}

const readView = (): View => {
  const h = location.hash.slice(1);
  return (VIEWS.find((v) => v.value === h)?.value ?? 'feriedage') as View;
};

/** The current screen lives in the URL hash, so a refresh or a shared link opens the same screen. */
function useView(): View {
  const [view, setView] = useState<View>(readView);
  useEffect(() => {
    const on = () => {
      setView(readView());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return view;
}

export default function FerieApp() {
  const [state, dispatch] = useFerie();
  const sync = useSync(state, dispatch);
  const [theme, toggleTheme] = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const view = useView();
  const Y = state.settings.year;

  const shell = {
    state, view, year: Y, onYear: (year: number) => dispatch({ type: 'year', year }),
    sync, theme, onTheme: toggleTheme, onSettings: () => setSettingsOpen(true),
  };

  return (
    <AuthGate status={sync.status} email={sync.email}>
      <div className="min-h-dvh lg:flex">
        <Sidebar {...shell} />
        <TopBar {...shell} />
        <div className="min-w-0 flex-1 bg-background lg:bg-frame lg:py-2 lg:pr-2">
          <div className="min-h-[calc(100dvh-3.5rem)] bg-background lg:min-h-[calc(100dvh-1rem)] lg:rounded-[20px] lg:shadow-card">
            <main className="mx-auto w-full max-w-[1148px] px-4 pt-6 pb-32 sm:px-6 lg:pt-10 lg:pb-16">
              {view === 'feriedage' && (
                <Feriedage state={state} dispatch={dispatch} onEditBalance={() => setSettingsOpen(true)} />
              )}
              {view === 'rejsekassen' && <Kassen state={state} dispatch={dispatch} />}
              {view === 'rejseplan' && <Plan state={state} dispatch={dispatch} />}
              {view === 'forslag' && <Forslag status={sync.status} />}
            </main>
          </div>
        </div>
      </div>
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} state={state} dispatch={dispatch} />
      <Toaster
        position="top-center"
        closeButton
        toastOptions={{
          classNames: {
            toast: 'bg-card! text-foreground! border-0! rounded-2xl! font-sans! shadow-lift!',
            description: 'text-muted-foreground!',
            actionButton: 'bg-primary! text-primary-foreground! rounded-full!',
            closeButton: 'bg-card! border-border! text-muted-foreground!',
          },
        }}
      />
    </AuthGate>
  );
}
