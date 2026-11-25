import { getDistortionById } from '../data/distortions';
import { getEmotionById, type CoreEmotionId } from '../data/emotionWheel';
import type { ThoughtRecord } from '../db/schema';
import { shiftDateKey, toDateKey } from './dates';

export type PatternTimeRange = '7d' | '30d' | 'all';

export function filterByTimeRange<T extends { dateKey: string }>(
  items: T[],
  range: PatternTimeRange,
  now: Date = new Date(),
): T[] {
  if (range === 'all') return items;
  const todayKey = toDateKey(now);
  const daysBack = range === '7d' ? 6 : 29;
  const cutoffKey = shiftDateKey(todayKey, -daysBack);
  return items.filter((item) => item.dateKey >= cutoffKey && item.dateKey <= todayKey);
}

export interface TagEmotionInsight {
  emotionId: string;
  label: string;
  coreId: CoreEmotionId;
  ringColor: string;
  count: number;
  avgIntensity: number;
}

export interface TagPattern {
  tag: string;
  count: number;
  topEmotions: TagEmotionInsight[];
}

export function computeTagPatterns(records: ThoughtRecord[]): TagPattern[] {
  const byTag = new Map<
    string,
    {
      count: number;
      emotions: Map<
        string,
        { count: number; totalIntensity: number }
      >;
    }
  >();

  for (const record of records) {
    for (const tag of record.situation.tags) {
      let bucket = byTag.get(tag);
      if (!bucket) {
        bucket = { count: 0, emotions: new Map() };
        byTag.set(tag, bucket);
      }
      bucket.count += 1;

      for (const em of record.emotions) {
        const prev = bucket.emotions.get(em.emotionId) ?? {
          count: 0,
          totalIntensity: 0,
        };
        prev.count += 1;
        prev.totalIntensity += em.intensityBefore;
        bucket.emotions.set(em.emotionId, prev);
      }
    }
  }

  const results: TagPattern[] = [];
  for (const [tag, data] of byTag.entries()) {
    const topEmotions: TagEmotionInsight[] = [];
    for (const [emotionId, stat] of data.emotions.entries()) {
      const node = getEmotionById(emotionId);
      if (!node) continue;
      topEmotions.push({
        emotionId,
        label: node.label,
        coreId: node.coreId,
        ringColor: node.ringColor,
        count: stat.count,
        avgIntensity: Math.round(stat.totalIntensity / stat.count),
      });
    }
    topEmotions.sort(
      (a, b) => b.count - a.count || b.avgIntensity - a.avgIntensity,
    );
    results.push({
      tag,
      count: data.count,
      topEmotions: topEmotions.slice(0, 4),
    });
  }

  results.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'is'));
  return results;
}

export interface DistortionPattern {
  distortionId: string;
  name: string;
  count: number;
  percentage: number;
}

export function computeDistortionPatterns(
  records: ThoughtRecord[],
): DistortionPattern[] {
  const counts = new Map<string, number>();
  let totalSelections = 0;

  for (const record of records) {
    for (const group of record.thoughtGroups) {
      for (const id of group.distortionIds) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
        totalSelections += 1;
      }
    }
  }

  if (totalSelections === 0) return [];

  const results: DistortionPattern[] = [];
  for (const [distortionId, count] of counts.entries()) {
    const def = getDistortionById(distortionId);
    results.push({
      distortionId,
      name: def?.name ?? distortionId,
      count,
      percentage: Math.round((count / totalSelections) * 100),
    });
  }

  results.sort((a, b) => b.count - a.count);
  return results;
}

export interface ReappraisalComparison {
  beliefCount: number;
  avgBeliefBefore: number | null;
  avgBeliefAfter: number | null;
  beliefDelta: number | null;
  beliefImprovedPct: number | null;
  emotionCount: number;
  avgEmotionBefore: number | null;
  avgEmotionAfter: number | null;
  emotionDelta: number | null;
  emotionImprovedPct: number | null;
}

export function computeReappraisalComparison(
  records: ThoughtRecord[],
): ReappraisalComparison {
  const eligible = records.filter(
    (r) => r.status === 'completed' && !r.reappraisalSkipped,
  );

  let beliefSumBefore = 0;
  let beliefSumAfter = 0;
  let beliefCount = 0;
  let beliefImproved = 0;

  let emotionSumBefore = 0;
  let emotionSumAfter = 0;
  let emotionCount = 0;
  let emotionImproved = 0;

  for (const record of eligible) {
    const activeGroupIds = new Set(
      record.thoughts.filter((t) => t.text.trim().length > 0).map((t) => t.groupId),
    );
    for (const group of record.thoughtGroups) {
      if (!activeGroupIds.has(group.id)) continue;
      if (typeof group.beliefAfter !== 'number') continue;
      beliefSumBefore += group.beliefBefore;
      beliefSumAfter += group.beliefAfter;
      beliefCount += 1;
      if (group.beliefAfter < group.beliefBefore) {
        beliefImproved += 1;
      }
    }

    for (const em of record.emotions) {
      if (typeof em.intensityAfter !== 'number') continue;
      emotionSumBefore += em.intensityBefore;
      emotionSumAfter += em.intensityAfter;
      emotionCount += 1;
      if (em.intensityAfter < em.intensityBefore) {
        emotionImproved += 1;
      }
    }
  }

  const avgBeliefBefore =
    beliefCount > 0 ? Math.round(beliefSumBefore / beliefCount) : null;
  const avgBeliefAfter =
    beliefCount > 0 ? Math.round(beliefSumAfter / beliefCount) : null;
  const avgEmotionBefore =
    emotionCount > 0 ? Math.round(emotionSumBefore / emotionCount) : null;
  const avgEmotionAfter =
    emotionCount > 0 ? Math.round(emotionSumAfter / emotionCount) : null;

  return {
    beliefCount,
    avgBeliefBefore,
    avgBeliefAfter,
    beliefDelta:
      avgBeliefBefore !== null && avgBeliefAfter !== null
        ? avgBeliefAfter - avgBeliefBefore
        : null,
    beliefImprovedPct:
      beliefCount > 0 ? Math.round((beliefImproved / beliefCount) * 100) : null,
    emotionCount,
    avgEmotionBefore,
    avgEmotionAfter,
    emotionDelta:
      avgEmotionBefore !== null && avgEmotionAfter !== null
        ? avgEmotionAfter - avgEmotionBefore
        : null,
    emotionImprovedPct:
      emotionCount > 0
        ? Math.round((emotionImproved / emotionCount) * 100)
        : null,
  };
}
