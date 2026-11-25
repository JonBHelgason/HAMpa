import { describe, expect, it } from 'vitest';
import type { QuickMoodEntry, ThoughtRecord } from '../db/schema';
import { computeDayEmotionBlend } from '../domain/calendar';

describe('calendar emotion blend', () => {
  it('uses initial intensityBefore (not intensityAfter) plus quick moods and normalizes ratios to 1', () => {
    const records: ThoughtRecord[] = [
      {
        id: 'tr-1',
        dateKey: '2026-11-25',
        createdAt: '2026-11-25T10:00:00.000Z',
        updatedAt: '2026-11-25T10:30:00.000Z',
        status: 'completed',
        situation: { description: 'Fundur', tags: [] },
        emotions: [
          {
            id: 'e1',
            emotionId: 'otti.kvidi',
            intensityBefore: 60,
            intensityAfter: 10, // must NOT affect calendar ring
          },
          {
            id: 'e2',
            emotionId: 'depurd.sorg',
            intensityBefore: 20,
            intensityAfter: 5,
          },
        ],
        thoughts: [],
        thoughtGroups: [],
      },
    ];

    const moods: QuickMoodEntry[] = [
      {
        id: 'qm-1',
        dateKey: '2026-11-25',
        createdAt: '2026-11-25T16:00:00.000Z',
        updatedAt: '2026-11-25T16:00:00.000Z',
        emotions: [
          {
            id: 'qe1',
            emotionId: 'hamingja.ro',
            intensity: 20,
          },
        ],
        note: '',
      },
    ];

    const segments = computeDayEmotionBlend(records, moods, '2026-11-25');
    expect(segments).toHaveLength(3);

    const otti = segments.find((s) => s.coreId === 'otti');
    const depurd = segments.find((s) => s.coreId === 'depurd');
    const hamingja = segments.find((s) => s.coreId === 'hamingja');

    expect(otti?.ratio).toBeCloseTo(0.6, 5);
    expect(depurd?.ratio).toBeCloseTo(0.2, 5);
    expect(hamingja?.ratio).toBeCloseTo(0.2, 5);

    const sumRatio = segments.reduce((acc, s) => acc + s.ratio, 0);
    expect(sumRatio).toBeCloseTo(1, 5);
  });
});
