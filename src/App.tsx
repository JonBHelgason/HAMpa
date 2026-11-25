import { useEffect, useState } from 'react';
import { BottomNav, type NavTab } from './components/layout/BottomNav';
import { ensureSettings, useAppSettings } from './db/db';
import { toDateKey } from './domain/dates';
import { applyTheme } from './domain/theme';
import { CalendarPage } from './pages/CalendarPage';
import { DiaryPage } from './pages/DiaryPage';
import { HomePage } from './pages/HomePage';
import { PatternsPage } from './pages/PatternsPage';
import { QuickMoodPage } from './pages/QuickMoodPage';
import { SettingsPage } from './pages/SettingsPage';
import { ThoughtRecordPage } from './pages/ThoughtRecordPage';

type RouteState =
  | { view: 'home' }
  | { view: 'calendar' }
  | { view: 'diary'; dateKey: string }
  | { view: 'patterns' }
  | { view: 'settings'; returnTo: RouteState }
  | {
      view: 'thought-record';
      recordId: string | null;
      initialColumn: 1 | 2 | 3 | 4;
      instanceKey: number;
    }
  | {
      view: 'quick-mood';
      entryId: string | null;
      instanceKey: number;
    };

function getActiveTab(route: RouteState): NavTab {
  if (
    route.view === 'home' ||
    route.view === 'calendar' ||
    route.view === 'diary' ||
    route.view === 'patterns'
  ) {
    return route.view;
  }
  if (route.view === 'settings') {
    return getActiveTab(route.returnTo);
  }
  return 'home';
}

export function App() {
  const [route, setRoute] = useState<RouteState>({ view: 'home' });
  const [instanceSeq, setInstanceSeq] = useState(1);

  const settings = useAppSettings();

  useEffect(() => {
    ensureSettings()
      .then((s) => applyTheme(s.theme))
      .catch(() => {});
  }, []);

  useEffect(() => {
    applyTheme(settings.theme);
    if (settings.theme !== 'system' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [settings.theme]);

  const openNewThoughtRecord = () => {
    const nextKey = instanceSeq + 1;
    setInstanceSeq(nextKey);
    setRoute({
      view: 'thought-record',
      recordId: null,
      initialColumn: 1,
      instanceKey: nextKey,
    });
  };

  const openExistingThoughtRecord = (
    id: string,
    initialColumn: 1 | 2 | 3 | 4 = 1,
  ) => {
    const nextKey = instanceSeq + 1;
    setInstanceSeq(nextKey);
    setRoute({
      view: 'thought-record',
      recordId: id,
      initialColumn,
      instanceKey: nextKey,
    });
  };

  const openNewQuickMood = () => {
    const nextKey = instanceSeq + 1;
    setInstanceSeq(nextKey);
    setRoute({
      view: 'quick-mood',
      entryId: null,
      instanceKey: nextKey,
    });
  };

  const openExistingQuickMood = (id: string) => {
    const nextKey = instanceSeq + 1;
    setInstanceSeq(nextKey);
    setRoute({
      view: 'quick-mood',
      entryId: id,
      instanceKey: nextKey,
    });
  };

  const handleSelectTab = (tab: NavTab) => {
    window.scrollTo({ top: 0 });
    if (tab === 'diary') {
      setRoute({ view: 'diary', dateKey: toDateKey() });
    } else {
      setRoute({ view: tab });
    }
  };

  const activeTab = getActiveTab(route);

  return (
    <div className="min-h-dvh bg-[var(--bg-page)] text-[var(--text-primary)]">
      <main>
        {route.view === 'home' && (
          <HomePage
            onNewThoughtRecord={openNewThoughtRecord}
            onOpenThoughtRecord={openExistingThoughtRecord}
            onNewQuickMood={openNewQuickMood}
            onOpenQuickMood={openExistingQuickMood}
            onOpenSettings={() =>
              setRoute({ view: 'settings', returnTo: route })
            }
          />
        )}

        {route.view === 'calendar' && (
          <CalendarPage
            onOpenThoughtRecord={(id) => openExistingThoughtRecord(id, 1)}
            onOpenQuickMood={openExistingQuickMood}
            onOpenDiary={(dateKey) => setRoute({ view: 'diary', dateKey })}
          />
        )}

        {route.view === 'diary' && (
          <DiaryPage
            selectedDateKey={route.dateKey}
            onChangeDateKey={(dateKey) => setRoute({ view: 'diary', dateKey })}
            onOpenSettings={() =>
              setRoute({ view: 'settings', returnTo: route })
            }
          />
        )}

        {route.view === 'patterns' && <PatternsPage />}

        {route.view === 'settings' && (
          <SettingsPage onBack={() => setRoute(route.returnTo)} />
        )}

        {route.view === 'thought-record' && (
          <ThoughtRecordPage
            key={route.instanceKey}
            recordId={route.recordId}
            initialColumn={route.initialColumn}
            onBack={() => setRoute({ view: 'home' })}
          />
        )}

        {route.view === 'quick-mood' && (
          <QuickMoodPage
            key={route.instanceKey}
            entryId={route.entryId}
            onBack={() => setRoute({ view: 'home' })}
          />
        )}
      </main>

      <BottomNav activeTab={activeTab} onSelectTab={handleSelectTab} />
    </div>
  );
}

export default App;
