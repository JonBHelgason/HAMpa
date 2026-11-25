import Dexie, { type Table } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { DEFAULT_EVENING_HABITS, DEFAULT_TAGS } from '../data/defaults';
import type {
  AppSettings,
  DiaryEntry,
  QuickMoodEntry,
  ThoughtRecord,
} from './schema';

export class HampaDB extends Dexie {
  thoughtRecords!: Table<ThoughtRecord, string>;
  quickMoods!: Table<QuickMoodEntry, string>;
  diaryEntries!: Table<DiaryEntry, string>;
  settings!: Table<AppSettings, string>;

  constructor(name = 'hampa-db') {
    super(name);
    this.version(1).stores({
      thoughtRecords: 'id, dateKey, status, createdAt, updatedAt',
      quickMoods: 'id, dateKey, createdAt',
      diaryEntries: 'dateKey, updatedAt',
      settings: 'id',
    });
  }
}

export const db = new HampaDB();

export function createDefaultSettings(): AppSettings {
  return {
    id: 'main',
    theme: 'system',
    customTags: [],
    hiddenDefaultTags: [],
    eveningHabits: DEFAULT_EVENING_HABITS.map((h) => ({ ...h, active: true })),
  };
}

export async function ensureSettings(database: HampaDB = db): Promise<AppSettings> {
  const existing = await database.settings.get('main');
  if (existing) {
    return existing;
  }
  const initial = createDefaultSettings();
  await database.settings.put(initial);
  return initial;
}

export function useAppSettings(): AppSettings {
  return (
    useLiveQuery(
      async () => (await db.settings.get('main')) ?? createDefaultSettings(),
      [],
    ) ?? createDefaultSettings()
  );
}

export function getVisibleTags(settings: AppSettings): string[] {
  const hiddenSet = new Set(settings.hiddenDefaultTags);
  const visibleDefaults = DEFAULT_TAGS.filter((t) => !hiddenSet.has(t));
  const seen = new Set<string>(visibleDefaults.map((t) => t.toLowerCase()));
  const result = [...visibleDefaults];
  for (const tag of settings.customTags) {
    const trimmed = tag.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(trimmed);
    }
  }
  return result;
}
