import { describe, expect, it } from 'vitest';
import {
  ALL_EMOTION_NODES,
  CORE_EMOTIONS,
  getEmotionById,
  searchEmotions,
} from '../data/emotionWheel';

describe('emotionWheel', () => {
  it('contains exact 7 core, 34 middle, and 77 outer nodes (118 total) from TilfHjol.jpg', () => {
    const coreCount = CORE_EMOTIONS.length;
    const middleCount = CORE_EMOTIONS.reduce(
      (sum, core) => sum + core.middle.length,
      0,
    );
    const outerCount = CORE_EMOTIONS.reduce(
      (sum, core) =>
        sum + core.middle.reduce((mSum, mid) => mSum + mid.outer.length, 0),
      0,
    );

    expect(coreCount).toBe(7);
    expect(middleCount).toBe(34);
    expect(outerCount).toBe(77);
    expect(ALL_EMOTION_NODES).toHaveLength(118);
  });

  it('guarantees unique IDs even when labels repeat across sectors', () => {
    const ids = ALL_EMOTION_NODES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ALL_EMOTION_NODES.length);

    // Specific repeated words from TilfHjol.jpg must map to distinct nodes
    expect(getEmotionById('hamingja.traust.thakklaeti')?.pathLabels).toEqual([
      'Hamingja',
      'Traust',
      'Þakklæti',
    ]);
    expect(getEmotionById('hamingja.ro.thakklaeti')?.pathLabels).toEqual([
      'Hamingja',
      'Ró',
      'Þakklæti',
    ]);
    expect(
      getEmotionById('depurd.leidi.minnimattarkennd')?.coreId,
    ).toBe('depurd');
    expect(
      getEmotionById('skomm.nidurlaeging.minnimattarkennd')?.coreId,
    ).toBe('skomm');
  });

  it('supports accent-insensitive Icelandic search', () => {
    const kvidiMatches = searchEmotions('kvidi');
    expect(kvidiMatches.some((n) => n.label === 'Kvíði')).toBe(true);
    expect(kvidiMatches.some((n) => n.label === 'Áhyggjur')).toBe(true);

    const thakklaetiMatches = searchEmotions('thakklaeti');
    expect(thakklaetiMatches.filter((n) => n.label === 'Þakklæti')).toHaveLength(
      2,
    );
  });
});
