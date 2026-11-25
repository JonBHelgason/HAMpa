import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  exportBackup,
  parseAndValidateBackup,
  restoreBackup,
} from '../db/backup';
import { createDefaultSettings, HampaDB } from '../db/db';
import type { DiaryEntry, HampaBackupV1, ThoughtRecord } from '../db/schema';
import { getDistortionById } from '../data/distortions';
import { getEmotionById } from '../data/emotionWheel';

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

  it('converts legacy hugsanaskra v2 backups cleanly and merges idempotently', async () => {
    const legacyPayload = {
      app: 'hugsanaskra',
      version: 2,
      exported: '2026-11-25T23:00:00.000Z',
      records: [
        {
          id: 'leg-comp',
          time: '2026-10-12T16:57',
          situations: [
            {
              id: 's1',
              title: 'Vinnufundur',
              desc: 'Kynning gekk hægt',
              tags: {
                tema: ['Kynning'],
                folk: ['Samstarfsfólk'],
                stadur: ['Skrifstofa'],
              },
            },
          ],
          emotions: [
            { w: 'Skömm', s: 6, s2: 2 },
            { w: 'Minnimáttarkennd', s: 5, s2: 1 },
          ],
          thoughts: [
            {
              id: 'th-lead',
              text: 'Þetta var allt í klessu',
              belief1: 75,
              belief2: 20,
              errors: [
                'Ósanngjarn samanburður',
                'Ýkjun og smættun',
                'Hrakspá',
                'Afskrifum hið jákvæða',
                'Óraunsæ boð og bönn',
                'Uppnefni',
                'Neikvæð rörsýn',
                'Alhæfingar',
                'Allt eða ekkert',
                'Hugsunarlestur',
                'Tilfinningarök',
              ],
              q1: 'Rök gegn þessu',
              q2: 'Raunsærri hugsun',
              lead: '',
              emos: ['Skömm'],
            },
            {
              id: 'th-follow',
              text: 'Enginn hlustaði',
              belief1: null,
              belief2: null,
              errors: [],
              q1: '',
              q2: '',
              lead: 'th-lead',
              emos: [],
            },
          ],
          ci: false,
          lokid: true,
        },
        {
          id: 'leg-inc',
          time: '2026-11-20T09:38',
          situations: [
            {
              id: 's2',
              title: 'Morgunstund',
              desc: 'Morgunstund',
              tags: { tema: ['Svefn'], folk: [], stadur: [] },
            },
          ],
          emotions: [{ w: 'Vonbrigði', s: 7 }],
          thoughts: [
            {
              id: 'th-inc',
              text: 'Ég er of þreyttur',
              belief1: null,
              belief2: null,
              errors: [],
              q1: '',
              q2: '',
              lead: '',
              emos: [],
            },
          ],
          ci: false,
          lokid: false,
        },
        {
          id: 'leg-ci',
          time: '2026-11-08T18:31',
          situations: [],
          emotions: [{ w: 'Áhugaleysi', s: 7, s2: null }],
          thoughts: [],
          ci: true,
          lokid: false,
        },
      ],
      customTags: {
        stadur: ['Skrifstofa'],
        folk: ['Samstarfsfólk'],
        tema: ['Kynning', 'Vinna'],
      },
      hiddenTags: {
        tema: ['Heimili'],
      },
      diary: {
        '2026-11-10': {
          sleepFrom: '23:30',
          sleepTo: '07:00',
          sleepQ: 4,
          energy: 3,
          moodAm: 4,
          mood: 5,
          steps: 7200,
          eat: 'Hafragrautur og lax',
          grat: 'Góður göngutúr',
          pos: 'já',
        },
      },
    };

    const parsed = parseAndValidateBackup(JSON.stringify(legacyPayload));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.summary.sourceLabel).toBe('Gamla forritið (hugsanaskra)');
    expect(parsed.summary.thoughtRecordsCount).toBe(2);
    expect(parsed.summary.quickMoodsCount).toBe(1);
    expect(parsed.summary.diaryEntriesCount).toBe(1);

    const comp = parsed.backup.data.thoughtRecords.find((r) => r.id === 'leg-comp');
    expect(comp?.status).toBe('completed');
    expect(comp?.situation.description).toBe('Vinnufundur\nKynning gekk hægt');
    expect(comp?.situation.tags).toEqual(['Kynning', 'Samstarfsfólk', 'Skrifstofa']);
    // 0-10 scaled to 0-100%, Minnimáttarkennd disambiguated to skomm because Skömm is in same record
    expect(comp?.emotions[0].intensityBefore).toBe(60);
    expect(comp?.emotions[0].intensityAfter).toBe(20);
    expect(comp?.emotions[1].emotionId).toBe('skomm.nidurlaeging.minnimattarkennd');
    // All emotions and distortions resolve cleanly
    for (const em of comp?.emotions ?? []) {
      expect(getEmotionById(em.emotionId)).toBeDefined();
    }
    expect(comp?.thoughtGroups).toHaveLength(1);
    expect(comp?.thoughts).toHaveLength(2);
    expect(comp?.thoughts[0].groupId).toBe(comp?.thoughts[1].groupId);
    expect(comp?.thoughts[0].linkedEmotionId).toBe(comp?.emotions[0].id);
    expect(comp?.thoughtGroups[0].promptAnswers.rok).toBe('Rök gegn þessu');
    expect(comp?.thoughtGroups[0].balancedThought).toBe('Raunsærri hugsun');
    for (const dId of comp?.thoughtGroups[0].distortionIds ?? []) {
      expect(getDistortionById(dId)).toBeDefined();
    }

    const inc = parsed.backup.data.thoughtRecords.find((r) => r.id === 'leg-inc');
    expect(inc?.status).toBe('incomplete');
    expect(inc?.situation.description).toBe('Morgunstund');
    expect(inc?.emotions[0].emotionId).toBe('reidi.vonbrigdi');

    const ci = parsed.backup.data.quickMoods[0];
    expect(ci.id).toBe('leg-ci');
    expect(ci.emotions[0].emotionId).toBe('depurd.leidi.ahugaleysi');
    expect(ci.emotions[0].intensity).toBe(70);

    const diary = parsed.backup.data.diaryEntries[0];
    expect(diary.dateKey).toBe('2026-11-10');
    expect(diary.morning?.sleepHours).toBe(7.5);
    expect(diary.morning?.sleepQuality).toBe(4);
    expect(diary.evening?.steps).toBe(7200);
    expect(diary.evening?.habits[0]).toMatchObject({ answer: true });

    // Custom tags exclude defaults like 'Vinna'; hidden default tags capture 'Heimili'
    expect(parsed.backup.data.settings.customTags).toContain('Kynning');
    expect(parsed.backup.data.settings.customTags).not.toContain('Vinna');
    expect(parsed.backup.data.settings.hiddenDefaultTags).toContain('Heimili');

    // Merge twice is idempotent
    await restoreBackup(testDb, parsed.backup, 'merge');
    await restoreBackup(testDb, parsed.backup, 'merge');
    expect(await testDb.thoughtRecords.count()).toBe(2);
    expect(await testDb.quickMoods.count()).toBe(1);
    expect(await testDb.diaryEntries.count()).toBe(1);
  });
});
