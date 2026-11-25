import { createDefaultSettings, db, type HampaDB } from './db';
import {
  convertLegacyBackup,
  isLegacyHugsanaskraBackup,
} from './legacyImport';
import type {
  AppSettings,
  DiaryEntry,
  HampaBackupV1,
  QuickMoodEntry,
  ThoughtRecord,
} from './schema';

export interface BackupSummary {
  exportedAt: string;
  thoughtRecordsCount: number;
  quickMoodsCount: number;
  diaryEntriesCount: number;
  sourceLabel?: string;
}

export type ParseBackupResult =
  | { ok: true; backup: HampaBackupV1; summary: BackupSummary }
  | { ok: false; error: string };

export async function exportBackup(database: HampaDB = db): Promise<HampaBackupV1> {
  const [thoughtRecords, quickMoods, diaryEntries, maybeSettings] =
    await Promise.all([
      database.thoughtRecords.toArray(),
      database.quickMoods.toArray(),
      database.diaryEntries.toArray(),
      database.settings.get('main'),
    ]);

  return {
    app: 'HAMpa',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    data: {
      thoughtRecords,
      quickMoods,
      diaryEntries,
      settings: maybeSettings ?? createDefaultSettings(),
    },
  };
}

export function downloadBackupFile(backup: HampaBackupV1, dateKey: string): void {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `hampa-afrit-${dateKey}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidThoughtRecord(item: unknown): item is ThoughtRecord {
  return (
    isObjectRecord(item) &&
    typeof item.id === 'string' &&
    typeof item.dateKey === 'string' &&
    typeof item.createdAt === 'string' &&
    typeof item.updatedAt === 'string' &&
    (item.status === 'draft' ||
      item.status === 'incomplete' ||
      item.status === 'completed') &&
    isObjectRecord(item.situation) &&
    Array.isArray(item.emotions) &&
    Array.isArray(item.thoughts) &&
    Array.isArray(item.thoughtGroups)
  );
}

function isValidQuickMood(item: unknown): item is QuickMoodEntry {
  return (
    isObjectRecord(item) &&
    typeof item.id === 'string' &&
    typeof item.dateKey === 'string' &&
    typeof item.createdAt === 'string' &&
    Array.isArray(item.emotions)
  );
}

function isValidDiaryEntry(item: unknown): item is DiaryEntry {
  return (
    isObjectRecord(item) &&
    typeof item.dateKey === 'string' &&
    typeof item.updatedAt === 'string'
  );
}

export function parseAndValidateBackup(rawText: string): ParseBackupResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      error: 'Skráin er ekki gild JSON-skrá.',
    };
  }

  if (!isObjectRecord(parsed)) {
    return { ok: false, error: 'Ógilt snið á afritsskrá.' };
  }

  if (isLegacyHugsanaskraBackup(parsed)) {
    return convertLegacyBackup(parsed);
  }

  if (parsed.app !== 'HAMpa') {
    return {
      ok: false,
      error: 'Þetta virðist ekki vera afritsskrá frá HAMpa.',
    };
  }

  if (parsed.schemaVersion !== 1) {
    return {
      ok: false,
      error: `Óþekkt útgáfunúmer afrits (${String(parsed.schemaVersion)}).`,
    };
  }

  const data = parsed.data;
  if (!isObjectRecord(data)) {
    return { ok: false, error: 'Gagnahluti vantar í afritsskrána.' };
  }

  if (
    !Array.isArray(data.thoughtRecords) ||
    !Array.isArray(data.quickMoods) ||
    !Array.isArray(data.diaryEntries)
  ) {
    return { ok: false, error: 'Gagnalistar í afritsskrá eru skemmdir.' };
  }

  if (
    !data.thoughtRecords.every(isValidThoughtRecord) ||
    !data.quickMoods.every(isValidQuickMood) ||
    !data.diaryEntries.every(isValidDiaryEntry)
  ) {
    return {
      ok: false,
      error: 'Sumar færslur í afritsskránni eru ógildar eða skemmdar.',
    };
  }

  const rawSettings = isObjectRecord(data.settings)
    ? (data.settings as Partial<AppSettings>)
    : {};
  const defaults = createDefaultSettings();
  const normalizedSettings: AppSettings = {
    id: 'main',
    theme:
      rawSettings.theme === 'light' ||
      rawSettings.theme === 'dark' ||
      rawSettings.theme === 'system'
        ? rawSettings.theme
        : defaults.theme,
    customTags: Array.isArray(rawSettings.customTags)
      ? rawSettings.customTags.filter((t): t is string => typeof t === 'string')
      : defaults.customTags,
    hiddenDefaultTags: Array.isArray(rawSettings.hiddenDefaultTags)
      ? rawSettings.hiddenDefaultTags.filter(
          (t): t is string => typeof t === 'string',
        )
      : defaults.hiddenDefaultTags,
    eveningHabits: Array.isArray(rawSettings.eveningHabits)
      ? rawSettings.eveningHabits.filter(
          (h): h is AppSettings['eveningHabits'][number] =>
            isObjectRecord(h) &&
            typeof h.id === 'string' &&
            typeof h.label === 'string' &&
            typeof h.active === 'boolean',
        )
      : defaults.eveningHabits,
  };

  const backup: HampaBackupV1 = {
    app: 'HAMpa',
    schemaVersion: 1,
    exportedAt:
      typeof parsed.exportedAt === 'string'
        ? parsed.exportedAt
        : new Date().toISOString(),
    data: {
      thoughtRecords: data.thoughtRecords,
      quickMoods: data.quickMoods,
      diaryEntries: data.diaryEntries,
      settings: normalizedSettings,
    },
  };

  return {
    ok: true,
    backup,
    summary: {
      exportedAt: backup.exportedAt,
      thoughtRecordsCount: backup.data.thoughtRecords.length,
      quickMoodsCount: backup.data.quickMoods.length,
      diaryEntriesCount: backup.data.diaryEntries.length,
    },
  };
}

function mergeDiaryEntry(local: DiaryEntry, incoming: DiaryEntry): DiaryEntry {
  const incomingIsNewer = incoming.updatedAt > local.updatedAt;
  const morning =
    local.morning && incoming.morning
      ? incomingIsNewer
        ? incoming.morning
        : local.morning
      : (local.morning ?? incoming.morning);
  const evening =
    local.evening && incoming.evening
      ? incomingIsNewer
        ? incoming.evening
        : local.evening
      : (local.evening ?? incoming.evening);

  return {
    dateKey: local.dateKey,
    updatedAt: incomingIsNewer ? incoming.updatedAt : local.updatedAt,
    ...(morning ? { morning } : {}),
    ...(evening ? { evening } : {}),
  };
}

function mergeSettings(local: AppSettings, incoming: AppSettings): AppSettings {
  const customTagsSet = new Set([...local.customTags, ...incoming.customTags]);
  const hiddenSet = new Set([
    ...local.hiddenDefaultTags,
    ...incoming.hiddenDefaultTags,
  ]);
  const habitMap = new Map(local.eveningHabits.map((h) => [h.id, h]));
  for (const habit of incoming.eveningHabits) {
    if (!habitMap.has(habit.id)) {
      habitMap.set(habit.id, habit);
    }
  }
  return {
    id: 'main',
    theme: local.theme,
    customTags: Array.from(customTagsSet),
    hiddenDefaultTags: Array.from(hiddenSet),
    eveningHabits: Array.from(habitMap.values()),
  };
}

export async function restoreBackup(
  database: HampaDB,
  backup: HampaBackupV1,
  mode: 'merge' | 'replace',
): Promise<void> {
  await database.transaction(
    'rw',
    database.thoughtRecords,
    database.quickMoods,
    database.diaryEntries,
    database.settings,
    async () => {
      if (mode === 'replace') {
        await Promise.all([
          database.thoughtRecords.clear(),
          database.quickMoods.clear(),
          database.diaryEntries.clear(),
          database.settings.clear(),
        ]);
        if (backup.data.thoughtRecords.length > 0) {
          await database.thoughtRecords.bulkPut(backup.data.thoughtRecords);
        }
        if (backup.data.quickMoods.length > 0) {
          await database.quickMoods.bulkPut(backup.data.quickMoods);
        }
        if (backup.data.diaryEntries.length > 0) {
          await database.diaryEntries.bulkPut(backup.data.diaryEntries);
        }
        await database.settings.put({ ...backup.data.settings, id: 'main' });
        return;
      }

      // Merge mode
      const [existingThoughts, existingMoods, existingDiary, existingSettings] =
        await Promise.all([
          database.thoughtRecords.toArray(),
          database.quickMoods.toArray(),
          database.diaryEntries.toArray(),
          database.settings.get('main'),
        ]);

      const thoughtMap = new Map(existingThoughts.map((r) => [r.id, r]));
      for (const incoming of backup.data.thoughtRecords) {
        const local = thoughtMap.get(incoming.id);
        if (!local || incoming.updatedAt > local.updatedAt) {
          thoughtMap.set(incoming.id, incoming);
        }
      }

      const moodMap = new Map(existingMoods.map((m) => [m.id, m]));
      for (const incoming of backup.data.quickMoods) {
        const local = moodMap.get(incoming.id);
        if (!local || incoming.updatedAt > local.updatedAt) {
          moodMap.set(incoming.id, incoming);
        }
      }

      const diaryMap = new Map(existingDiary.map((d) => [d.dateKey, d]));
      for (const incoming of backup.data.diaryEntries) {
        const local = diaryMap.get(incoming.dateKey);
        diaryMap.set(
          incoming.dateKey,
          local ? mergeDiaryEntry(local, incoming) : incoming,
        );
      }

      const mergedSettings = existingSettings
        ? mergeSettings(existingSettings, backup.data.settings)
        : { ...backup.data.settings, id: 'main' as const };

      if (thoughtMap.size > 0) {
        await database.thoughtRecords.bulkPut(Array.from(thoughtMap.values()));
      }
      if (moodMap.size > 0) {
        await database.quickMoods.bulkPut(Array.from(moodMap.values()));
      }
      if (diaryMap.size > 0) {
        await database.diaryEntries.bulkPut(Array.from(diaryMap.values()));
      }
      await database.settings.put(mergedSettings);
    },
  );
}
