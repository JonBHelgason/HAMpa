import {
  getCoreEmotion,
  getEmotionById,
  type CoreEmotionId,
} from '../data/emotionWheel';
import type { QuickMoodEntry, ThoughtRecord } from '../db/schema';

export interface DayEmotionSegment {
  coreId: CoreEmotionId;
  label: string;
  ringColor: string;
  wheelFill: string;
  totalIntensity: number;
  ratio: number;
}

/**
 * Computes the proportional emotion mix for a single calendar day.
 * Thought records intentionally use initial intensity (`intensityBefore`)
 * so the calendar reflects how the user actually felt that day.
 */
export function computeDayEmotionBlend(
  thoughtRecords: ThoughtRecord[],
  quickMoods: QuickMoodEntry[],
  dateKey: string,
): DayEmotionSegment[] {
  const totals = new Map<CoreEmotionId, number>();
  const rawCounts = new Map<CoreEmotionId, number>();

  const addSample = (emotionId: string, intensity: number) => {
    const node = getEmotionById(emotionId);
    if (!node) return;
    const clamped = Math.max(0, intensity);
    totals.set(node.coreId, (totals.get(node.coreId) ?? 0) + clamped);
    rawCounts.set(node.coreId, (rawCounts.get(node.coreId) ?? 0) + 1);
  };

  for (const record of thoughtRecords) {
    if (record.dateKey !== dateKey) continue;
    for (const em of record.emotions) {
      addSample(em.emotionId, em.intensityBefore);
    }
  }

  for (const mood of quickMoods) {
    if (mood.dateKey !== dateKey) continue;
    for (const em of mood.emotions) {
      addSample(em.emotionId, em.intensity);
    }
  }

  if (rawCounts.size === 0) return [];

  const sumIntensity = Array.from(totals.values()).reduce((a, b) => a + b, 0);
  const useCountsFallback = sumIntensity === 0;
  const denominator = useCountsFallback
    ? Array.from(rawCounts.values()).reduce((a, b) => a + b, 0)
    : sumIntensity;

  const segments: DayEmotionSegment[] = [];
  for (const [coreId, count] of rawCounts.entries()) {
    const value = useCountsFallback ? count : (totals.get(coreId) ?? 0);
    if (value <= 0) continue;
    const core = getCoreEmotion(coreId);
    if (!core) continue;
    segments.push({
      coreId,
      label: core.label,
      ringColor: core.ringColor,
      wheelFill: core.wheelFill,
      totalIntensity: totals.get(coreId) ?? 0,
      ratio: value / denominator,
    });
  }

  segments.sort((a, b) => b.ratio - a.ratio);
  return segments;
}
