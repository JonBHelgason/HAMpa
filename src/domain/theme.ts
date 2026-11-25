import type { ThemePreference } from '../db/schema';

const THEME_STORAGE_KEY = 'hampa-theme';

export function resolveDarkMode(preference: ThemePreference): boolean {
  if (preference === 'dark') return true;
  if (preference === 'light') return false;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

export function applyTheme(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Ignore storage quota / privacy errors
  }

  const isDark = resolveDarkMode(preference);
  const root = document.documentElement;
  root.classList.toggle('dark', isDark);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', isDark ? '#161412' : '#F7F4EF');
  }
}
