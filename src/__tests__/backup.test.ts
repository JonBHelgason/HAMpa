import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  exportBackup,
  parseAndValidateBackup,
  restoreBackup,
} from '../db/backup';
import { createDefaultSettings, HampaDB } from '../db/db';
import type { DiaryEntry, HampaBackupV1, ThoughtRecord } from '../db/schema';

describe('backup and restore', () => {
  let testDb: HampaDB;

  beforeEach(async () => {
    testDb = new HampaDB(`hampa-test-${Math.random()}`);
    await testDb.open();
  });

  it('rejects invalid JSON or non-HAMpa backup payloads', () => {
    const badJson = parseAndValidateBackup('{not json');
    expect(badJson.ok).toBe(false);

    const wrongApp = parseAndValidateBackup(
      JSON.stringify({ app: 'Other', schemaVersion: 1, data: {} }),
    );
    expect(wrongApp.ok).toBe(false);
  });

  it('exports, merges without losing morning/evening halves, and replaces cleanly', async () => {
    const localThought: ThoughtRecord = {
      id: 't1',
      dateKey: '2026-11-25',
      createdAt: '2026-11-25T09:00:00.000Z',
      updatedAt: '2026-11-25T10:00:00.000Z',
      status: 'completed',
      situation: { description: 'Local version', tags: ['Vinna'] },
      emotions: [],
      thoughts: [],
      thoughtGroups: [],
    };
    const localDiary: DiaryEntry = {
      dateKey: '2026-11-25',
      updatedAt: '2026-11-25T08:00:00.000Z',
      morning: { sleepHours: 7.5, sleepQuality: 4 },
    };

    await testDb.thoughtRecords.put(localThought);
    await testDb.diaryEntries.put(localDiary);
    await testDb.settings.put({
      ...createDefaultSettings(),
      theme: 'dark',
      customTags: ['Kaffihús'],
    });

    const incomingBackup: HampaBackupV1 = {
      app: 'HAMpa',
      schemaVersion: 1,
      exportedAt: '2026-11-25T20:00:00.000Z',
      data: {
        thoughtRecords: [
          {
            ...localThought,
            updatedAt: '2026-11-25T09:30:00.000Z', // older than local
            situation: { description: 'Older incoming', tags: [] },
          },
          {
            ...localThought,
            id: 't2',
            updatedAt: '2026-11-25T12:00:00.000Z',
            situation: { description: 'New incoming', tags: ['Svefn'] },
          },
        ],
        quickMoods: [],
        diaryEntries: [
          {
            dateKey: '2026-11-25',
            updatedAt: '2026-11-25T21:00:00.000Z',
            evening: { mood: 4, steps: 6400, habits: [] },
          },
        ],
        settings: {
          ...createDefaultSettings(),
          theme: 'light',
          customTags: ['Próf'],
        },
      },
    };

    const parsed = parseAndValidateBackup(JSON.stringify(incomingBackup));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    // Test merge
    await restoreBackup(testDb, parsed.backup, 'merge');
    const mergedThoughts = await testDb.thoughtRecords.toArray();
    expect(mergedThoughts).toHaveLength(2);
    expect(mergedThoughts.find((t) => t.id === 't1')?.situation.description).toBe(
      'Local version',
    );
    const mergedDiary = await testDb.diaryEntries.get('2026-11-25');
    expect(mergedDiary?.morning?.sleepHours).toBe(7.5);
    expect(mergedDiary?.evening?.steps).toBe(6400);

    const mergedSettings = await testDb.settings.get('main');
    expect(mergedSettings?.theme).toBe('dark'); // kept local theme on merge
    expect(mergedSettings?.customTags).toContain('Kaffihús');
    expect(mergedSettings?.customTags).toContain('Próf');

    // Test export roundtrip + replace
    const exported = await exportBackup(testDb);
    expect(exported.data.thoughtRecords).toHaveLength(2);

    await restoreBackup(testDb, parsed.backup, 'replace');
    const replacedThoughts = await testDb.thoughtRecords.toArray();
    expect(replacedThoughts).toHaveLength(2);
    expect(replacedThoughts.find((t) => t.id === 't1')?.situation.description).toBe(
      'Older incoming',
    );
    const replacedSettings = await testDb.settings.get('main');
    expect(replacedSettings?.theme).toBe('light');
  });
});
