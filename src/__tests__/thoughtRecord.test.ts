import { describe, expect, it } from 'vitest';
import type { QuickMoodEntry, ThoughtRecord } from '../db/schema';
import {
  addThought,
  canUnlockColumn4,
  createEmptyThoughtRecord,
  groupHomeEntries,
  isColumn1Complete,
  isColumn2Complete,
  isColumn3Complete,
  linkThoughts,
  recalculateStatus,
  removeThought,
  unlinkThought,
} from '../domain/thoughtRecord';

function buildCompleteBaseRecord(): ThoughtRecord {
  const base = createEmptyThoughtRecord(new Date(2026, 10, 25, 10, 0, 0));
  const withSituation: ThoughtRecord = {
    ...base,
    situation: { description: 'Fundur í vinnunni', tags: ['Vinna'] },
    emotions: [
      { id: 'em-1', emotionId: 'otti.kvidi', intensityBefore: 75 },
    ],
  };
  return addThought(withSituation, 'Ég næ ekki að standa mig', 80);
}

describe('thoughtRecord domain logic', () => {
  it('enforces columns 1-3 completion before unlocking column 4', () => {
    const empty = createEmptyThoughtRecord(new Date(2026, 10, 25, 9, 0, 0));
    expect(isColumn1Complete(empty)).toBe(false);
    expect(isColumn2Complete(empty)).toBe(false);
    expect(isColumn3Complete(empty)).toBe(false);
    expect(canUnlockColumn4(empty)).toBe(false);
    expect(recalculateStatus(empty)).toBe('draft');

    const withSit: ThoughtRecord = {
      ...empty,
      situation: { description: 'Álag heima', tags: [] },
    };
    expect(isColumn1Complete(withSit)).toBe(true);
    expect(canUnlockColumn4(withSit)).toBe(false);
    expect(recalculateStatus(withSit)).toBe('draft');

    const completeBase = buildCompleteBaseRecord();
    expect(isColumn1Complete(completeBase)).toBe(true);
    expect(isColumn2Complete(completeBase)).toBe(true);
    expect(isColumn3Complete(completeBase)).toBe(true);
    expect(canUnlockColumn4(completeBase)).toBe(true);
    expect(completeBase.status).toBe('incomplete');
  });

  it('links and unlinks thoughts while merging and cleaning up groups', () => {
    let rec = buildCompleteBaseRecord();
    rec = addThought(rec, 'Fólk tekur eftir stressinu mínu', 70);
    expect(rec.thoughts).toHaveLength(2);
    expect(rec.thoughtGroups).toHaveLength(2);

    // Add distortion on second group before linking
    const secondGroupId = rec.thoughts[1].groupId;
    rec = {
      ...rec,
      thoughtGroups: rec.thoughtGroups.map((g) =>
        g.id === secondGroupId
          ? {
              ...g,
              distortionIds: ['hugsanalesning'],
              promptAnswers: { rok: 'Engar sannanir' },
            }
          : g,
      ),
    };

    const linked = linkThoughts(rec, [rec.thoughts[0].id, rec.thoughts[1].id]);
    expect(linked.thoughtGroups).toHaveLength(1);
    expect(linked.thoughts[0].groupId).toBe(linked.thoughts[1].groupId);
    expect(linked.thoughtGroups[0].distortionIds).toContain('hugsanalesning');
    expect(linked.thoughtGroups[0].promptAnswers.rok).toBe('Engar sannanir');

    const unlinked = unlinkThought(linked, linked.thoughts[1].id);
    expect(unlinked.thoughtGroups).toHaveLength(2);
    expect(unlinked.thoughts[0].groupId).not.toBe(
      unlinked.thoughts[1].groupId,
    );

    const removed = removeThought(unlinked, unlinked.thoughts[1].id);
    expect(removed.thoughts).toHaveLength(1);
    expect(removed.thoughtGroups).toHaveLength(1);
  });

  it('pins incomplete records at top and buckets remaining entries by Monday-start week', () => {
    // Anchor: Wednesday, Nov 25, 2026
    const now = new Date(2026, 10, 25, 18, 0, 0);

    const oldIncomplete: ThoughtRecord = {
      ...buildCompleteBaseRecord(),
      id: 'inc-old',
      dateKey: '2026-10-01',
      createdAt: new Date(2026, 9, 1, 10, 0, 0).toISOString(),
      status: 'incomplete',
    };

    const todayCompleted: ThoughtRecord = {
      ...buildCompleteBaseRecord(),
      id: 'comp-today',
      dateKey: '2026-11-25',
      createdAt: new Date(2026, 10, 25, 12, 0, 0).toISOString(),
      status: 'completed',
    };

    const yesterdayMood: QuickMoodEntry = {
      id: 'mood-yest',
      dateKey: '2026-11-24',
      createdAt: new Date(2026, 10, 24, 15, 0, 0).toISOString(),
      updatedAt: new Date(2026, 10, 24, 15, 0, 0).toISOString(),
      emotions: [{ id: 'q1', emotionId: 'hamingja.ro', intensity: 70 }],
      note: '',
    };

    // Monday of this week is Nov 23, 2026
    const thisWeekMood: QuickMoodEntry = {
      id: 'mood-mon',
      dateKey: '2026-11-23',
      createdAt: new Date(2026, 10, 23, 9, 0, 0).toISOString(),
      updatedAt: new Date(2026, 10, 23, 9, 0, 0).toISOString(),
      emotions: [{ id: 'q2', emotionId: 'otti.kvidi', intensity: 40 }],
      note: '',
    };

    // Sunday of last week is Nov 22, 2026
    const lastWeekCompleted: ThoughtRecord = {
      ...buildCompleteBaseRecord(),
      id: 'comp-last-week',
      dateKey: '2026-11-22',
      createdAt: new Date(2026, 10, 22, 11, 0, 0).toISOString(),
      status: 'completed',
    };

    const olderCompleted: ThoughtRecord = {
      ...buildCompleteBaseRecord(),
      id: 'comp-older',
      dateKey: '2026-11-10',
      createdAt: new Date(2026, 10, 10, 11, 0, 0).toISOString(),
      status: 'completed',
    };

    const grouped = groupHomeEntries(
      [oldIncomplete, todayCompleted, lastWeekCompleted, olderCompleted],
      [yesterdayMood, thisWeekMood],
      now,
    );

    expect(grouped.incomplete.map((r) => r.id)).toEqual(['inc-old']);
    expect(grouped.today.map((i) => (i.kind === 'thought' ? i.record.id : i.entry.id))).toEqual(['comp-today']);
    expect(grouped.yesterday.map((i) => (i.kind === 'thought' ? i.record.id : i.entry.id))).toEqual(['mood-yest']);
    expect(grouped.thisWeek.map((i) => (i.kind === 'thought' ? i.record.id : i.entry.id))).toEqual(['mood-mon']);
    expect(grouped.lastWeek.map((i) => (i.kind === 'thought' ? i.record.id : i.entry.id))).toEqual(['comp-last-week']);
    expect(grouped.older.map((i) => (i.kind === 'thought' ? i.record.id : i.entry.id))).toEqual(['comp-older']);
  });
});
