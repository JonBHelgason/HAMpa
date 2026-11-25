import { describe, expect, it } from 'vitest';
import type { ThoughtRecord } from '../db/schema';
import {
  computeDistortionPatterns,
  computeReappraisalComparison,
  computeTagPatterns,
  filterByTimeRange,
} from '../domain/patterns';

const SAMPLE_RECORDS: ThoughtRecord[] = [
  {
    id: 'r1',
    dateKey: '2026-11-25',
    createdAt: '2026-11-25T09:00:00.000Z',
    updatedAt: '2026-11-25T09:30:00.000Z',
    status: 'completed',
    reappraisalSkipped: false,
    situation: { description: 'Verkefnaskil', tags: ['Vinna', 'Álag'] },
    emotions: [
      {
        id: 'e1',
        emotionId: 'otti.kvidi.ahyggjur',
        intensityBefore: 80,
        intensityAfter: 40,
      },
    ],
    thoughts: [{ id: 't1', text: 'Ég næ þessu ekki', groupId: 'g1' }],
    thoughtGroups: [
      {
        id: 'g1',
        beliefBefore: 90,
        beliefAfter: 40,
        distortionIds: ['hamfarahugsun', 'spadomar'],
        promptAnswers: {},
        balancedThought: 'Ég tek eitt skref í einu.',
      },
    ],
  },
  {
    id: 'r2',
    dateKey: '2026-11-10',
    createdAt: '2026-11-10T14:00:00.000Z',
    updatedAt: '2026-11-10T14:30:00.000Z',
    status: 'completed',
    reappraisalSkipped: false,
    situation: { description: 'Fundur', tags: ['Vinna'] },
    emotions: [
      {
        id: 'e2',
        emotionId: 'otti.kvidi.ahyggjur',
        intensityBefore: 60,
        intensityAfter: 30,
      },
    ],
    thoughts: [{ id: 't2', text: 'Þeim fannst ég lélegur', groupId: 'g2' }],
    thoughtGroups: [
      {
        id: 'g2',
        beliefBefore: 70,
        beliefAfter: 30,
        distortionIds: ['hugsanalesning', 'hamfarahugsun'],
        promptAnswers: {},
        balancedThought: 'Ég veit ekki hvað þau hugsa.',
      },
    ],
  },
  {
    id: 'r3',
    dateKey: '2026-10-01',
    createdAt: '2026-10-01T14:00:00.000Z',
    updatedAt: '2026-10-01T14:30:00.000Z',
    status: 'completed',
    reappraisalSkipped: true, // skipped reappraisal must not skew comparison
    situation: { description: 'Eldri atburður', tags: ['Svefn'] },
    emotions: [
      {
        id: 'e3',
        emotionId: 'depurd.throttleysi',
        intensityBefore: 70,
        intensityAfter: 70,
      },
    ],
    thoughts: [{ id: 't3', text: 'Þreyttur', groupId: 'g3' }],
    thoughtGroups: [
      {
        id: 'g3',
        beliefBefore: 80,
        beliefAfter: 80,
        distortionIds: [],
        promptAnswers: {},
        balancedThought: '',
      },
    ],
  },
];

describe('patterns domain logic', () => {
  it('filters records by 7d, 30d, and all', () => {
    const now = new Date(2026, 10, 25, 12, 0, 0);
    expect(filterByTimeRange(SAMPLE_RECORDS, '7d', now)).toHaveLength(1);
    expect(filterByTimeRange(SAMPLE_RECORDS, '30d', now)).toHaveLength(2);
    expect(filterByTimeRange(SAMPLE_RECORDS, 'all', now)).toHaveLength(3);
  });

  it('aggregates tag frequencies and accompanying emotions', () => {
    const tags = computeTagPatterns(SAMPLE_RECORDS);
    expect(tags[0].tag).toBe('Vinna');
    expect(tags[0].count).toBe(2);
    expect(tags[0].topEmotions[0]).toMatchObject({
      emotionId: 'otti.kvidi.ahyggjur',
      count: 2,
      avgIntensity: 70,
    });
  });

  it('ranks cognitive distortions and computes before/after reappraisal averages', () => {
    const distortions = computeDistortionPatterns(SAMPLE_RECORDS);
    expect(distortions[0]).toMatchObject({
      distortionId: 'hamfarahugsun',
      count: 2,
      percentage: 50,
    });

    const comparison = computeReappraisalComparison(SAMPLE_RECORDS);
    expect(comparison.beliefCount).toBe(2);
    expect(comparison.avgBeliefBefore).toBe(80);
    expect(comparison.avgBeliefAfter).toBe(35);
    expect(comparison.beliefDelta).toBe(-45);
    expect(comparison.beliefImprovedPct).toBe(100);

    expect(comparison.emotionCount).toBe(2);
    expect(comparison.avgEmotionBefore).toBe(70);
    expect(comparison.avgEmotionAfter).toBe(35);
    expect(comparison.emotionDelta).toBe(-35);
  });
});
