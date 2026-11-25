import { BookOpen, CalendarDays, Home, TrendingUp } from 'lucide-react';

export type NavTab = 'home' | 'calendar' | 'diary' | 'patterns';

interface BottomNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

const NAV_ITEMS: Array<{
  id: NavTab;
  label: string;
  Icon: typeof Home;
}> = [
  { id: 'home', label: 'Heim', Icon: Home },
  { id: 'calendar', label: 'Dagatal', Icon: CalendarDays },
  { id: 'diary', label: 'Dagbók', Icon: BookOpen },
  { id: 'patterns', label: 'Mynstur', Icon: TrendingUp },
];

export function BottomNav({ activeTab, onSelectTab }: BottomNavProps) {
  return (
    <nav
      aria-label="Aðalvalmynd"
      className="bottom-nav-safe fixed inset-x-0 bottom-0 z-40 border-t bg-[var(--bg-surface)]/95 backdrop-blur-md"
    >
      <div className="mx-auto grid max-w-2xl grid-cols-4">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectTab(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-2 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span
                className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                  isActive ? 'bg-[var(--accent-soft)]' : ''
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 1.8} />
              </span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
