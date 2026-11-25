export type CoreEmotionId =
  | 'otti'
  | 'reidi'
  | 'vidbjodur'
  | 'depurd'
  | 'hamingja'
  | 'undrun'
  | 'skomm';

export interface OuterEmotion {
  id: string;
  label: string;
}

export interface MiddleEmotion {
  id: string;
  label: string;
  outer: OuterEmotion[];
}

export interface CoreEmotion {
  id: CoreEmotionId;
  label: string;
  wheelFill: string;
  ringColor: string;
  darkFill: string;
  middle: MiddleEmotion[];
}

export interface EmotionNode {
  id: string;
  label: string;
  level: 1 | 2 | 3;
  coreId: CoreEmotionId;
  middleId?: string;
  pathLabels: string[];
  wheelFill: string;
  ringColor: string;
  darkFill: string;
}

function makeMiddle(
  coreId: CoreEmotionId,
  midSlug: string,
  label: string,
  outerItems: Array<[string, string]>,
): MiddleEmotion {
  const middleId = `${coreId}.${midSlug}`;
  return {
    id: middleId,
    label,
    outer: outerItems.map(([slug, outerLabel]) => ({
      id: `${middleId}.${slug}`,
      label: outerLabel,
    })),
  };
}

/**
 * Exact 3-ring emotion taxonomy and color palette from TilfHjol.jpg,
 * ordered clockwise from 12 o'clock.
 */
export const CORE_EMOTIONS: CoreEmotion[] = [
  {
    id: 'otti',
    label: 'Ótti',
    wheelFill: '#FBE0A8',
    ringColor: '#E59A2E',
    darkFill: '#6B4C1D',
    middle: [
      makeMiddle('otti', 'hraedsla', 'Hræðsla', [
        ['skelfing', 'Skelfing'],
        ['beygur', 'Beygur'],
      ]),
      makeMiddle('otti', 'kvidi', 'Kvíði', [
        ['oroi', 'Órói'],
        ['ahyggjur', 'Áhyggjur'],
      ]),
      makeMiddle('otti', 'ognun', 'Ógnun', [
        ['ooryggi', 'Óöryggi'],
        ['skelkun', 'Skelkun'],
      ]),
      makeMiddle('otti', 'alag', 'Álag', [
        ['taugaveiklun', 'Taugaveiklun'],
        ['streita', 'Streita'],
      ]),
    ],
  },
  {
    id: 'reidi',
    label: 'Reiði',
    wheelFill: '#FAC8DE',
    ringColor: '#DC5B94',
    darkFill: '#6E2B4A',
    middle: [
      makeMiddle('reidi', 'vonbrigdi', 'Vonbrigði', [
        ['sar', 'Sár'],
        ['modgun', 'Móðgun'],
      ]),
      makeMiddle('reidi', 'ofund', 'Öfund', [
        ['afbrydisemi', 'Afbrýðisemi'],
        ['ofundsyki', 'Öfundsýki'],
      ]),
      makeMiddle('reidi', 'arasargirni', 'Árásargirni', [
        ['braedi', 'Bræði'],
        ['aesingur', 'Æsingur'],
      ]),
      makeMiddle('reidi', 'pirringur', 'Pirringur', [
        ['skapstyggd', 'Skapstyggð'],
        ['ergelsi', 'Ergelsi'],
      ]),
      makeMiddle('reidi', 'oanaegja', 'Óánægja', [
        ['gremja', 'Gremja'],
        ['biturd', 'Biturð'],
        ['hneykslun', 'Hneykslun'],
      ]),
      makeMiddle('reidi', 'vanthoknun', 'Vanþóknun', [
        ['fyrirlitning', 'Fyrirlitning'],
        ['domharka', 'Dómharka'],
      ]),
    ],
  },
  {
    id: 'vidbjodur',
    label: 'Viðbjóður',
    wheelFill: '#CFCFCF',
    ringColor: '#80858E',
    darkFill: '#4A4E55',
    middle: [
      makeMiddle('vidbjodur', 'andud', 'Andúð', [
        ['andstyggd', 'Andstyggð'],
        ['fyrirlitning', 'Fyrirlitning'],
      ]),
      makeMiddle('vidbjodur', 'mislika', 'Mislíka', [
        ['bloskra', 'Blöskra'],
        ['hatur', 'Hatur'],
      ]),
      makeMiddle('vidbjodur', 'vidurstyggd', 'Viðurstyggð', [
        ['kligja', 'Klígja'],
        ['obeit', 'Óbeit'],
        ['onot', 'Ónot'],
        ['oged', 'Ógeð'],
      ]),
    ],
  },
  {
    id: 'depurd',
    label: 'Depurð',
    wheelFill: '#5AB7E6',
    ringColor: '#2491CC',
    darkFill: '#1B5678',
    middle: [
      makeMiddle('depurd', 'leidi', 'Leiði', [
        ['ahugaleysi', 'Áhugaleysi'],
        ['einmanaleiki', 'Einmanaleiki'],
        ['minnimattarkennd', 'Minnimáttarkennd'],
        ['dodi', 'Doði'],
      ]),
      makeMiddle('depurd', 'sorg', 'Sorg', [
        ['soknudur', 'Söknuður'],
        ['hryggd', 'Hryggð'],
      ]),
      makeMiddle('depurd', 'orvaenting', 'Örvænting', [
        ['vonleysi', 'Vonleysi'],
        ['hjalparleysi', 'Hjálparleysi'],
      ]),
      makeMiddle('depurd', 'thjaning', 'Þjáning', [
        ['bol', 'Böl'],
        ['kvol', 'Kvöl'],
      ]),
      makeMiddle('depurd', 'throttleysi', 'Þróttleysi', [
        ['angist', 'Angist'],
        ['dugleysi', 'Dugleysi'],
        ['slen', 'Slen'],
      ]),
    ],
  },
  {
    id: 'hamingja',
    label: 'Hamingja',
    wheelFill: '#FCF5B0',
    ringColor: '#D6B129',
    darkFill: '#695817',
    middle: [
      makeMiddle('hamingja', 'bjartsyni', 'Bjartsýni', [
        ['von', 'Von'],
        ['eftirvaenting', 'Eftirvænting'],
      ]),
      makeMiddle('hamingja', 'samkennd', 'Samkennd', [
        ['innileiki', 'Innileiki'],
        ['godvild', 'Góðvild'],
      ]),
      makeMiddle('hamingja', 'traust', 'Traust', [
        ['thakklaeti', 'Þakklæti'],
        ['ast', 'Ást'],
      ]),
      makeMiddle('hamingja', 'kraftur', 'Kraftur', [
        ['skopun', 'Sköpun'],
        ['hugrekki', 'Hugrekki'],
      ]),
      makeMiddle('hamingja', 'vidurkenning', 'Viðurkenning', [
        ['stadfesta', 'Staðfesta'],
        ['samthykki', 'Samþykki'],
      ]),
      makeMiddle('hamingja', 'stolt', 'Stolt', [
        ['hreykni', 'Hreykni'],
        ['sjalfstraust', 'Sjálfstraust'],
      ]),
      makeMiddle('hamingja', 'ahugi', 'Áhugi', [
        ['hrifning', 'Hrifning'],
        ['forvitni', 'Forvitni'],
      ]),
      makeMiddle('hamingja', 'ro', 'Ró', [
        ['satt', 'Sátt'],
        ['thakklaeti', 'Þakklæti'],
      ]),
      makeMiddle('hamingja', 'anaegja', 'Ánægja', [
        ['katina', 'Kátína'],
        ['gledi', 'Gleði'],
      ]),
    ],
  },
  {
    id: 'undrun',
    label: 'Undrun',
    wheelFill: '#DCD8F7',
    ringColor: '#8173CE',
    darkFill: '#453D78',
    middle: [
      makeMiddle('undrun', 'spenna', 'Spenna', [
        ['kappsemi', 'Kappsemi'],
        ['akefd', 'Ákefð'],
      ]),
      makeMiddle('undrun', 'agndofa', 'Agndofa', [
        ['hneykslun', 'Hneykslun'],
        ['furda', 'Furða'],
      ]),
      makeMiddle('undrun', 'radaleysi', 'Ráðaleysi', [
        ['ringlun', 'Ringlun'],
        ['svekkelsi', 'Svekkelsi'],
      ]),
      makeMiddle('undrun', 'hissa', 'Hissa', [
        ['vonbrigdi', 'Vonbrigði'],
        ['forvida', 'Forviða'],
      ]),
    ],
  },
  {
    id: 'skomm',
    label: 'Skömm',
    wheelFill: '#C9F2BE',
    ringColor: '#56AB4B',
    darkFill: '#2E5E28',
    middle: [
      makeMiddle('skomm', 'nidurlaeging', 'Niðurlæging', [
        ['feimni', 'Feimni'],
        ['sman', 'Smán'],
        ['minnimattarkennd', 'Minnimáttarkennd'],
        ['hofnun', 'Höfnun'],
        ['vandraedalegt', 'Vandræðalegt'],
      ]),
      makeMiddle('skomm', 'sektarkennd', 'Sektarkennd', [
        ['samviskubit', 'Samviskubit'],
      ]),
      makeMiddle('skomm', 'idrun', 'Iðrun', [
        ['audmykt', 'Auðmýkt'],
        ['skammast', 'Skammast'],
        ['eftirsja', 'Eftirsjá'],
      ]),
    ],
  },
];

export const ALL_EMOTION_NODES: EmotionNode[] = (() => {
  const nodes: EmotionNode[] = [];
  for (const core of CORE_EMOTIONS) {
    nodes.push({
      id: core.id,
      label: core.label,
      level: 1,
      coreId: core.id,
      pathLabels: [core.label],
      wheelFill: core.wheelFill,
      ringColor: core.ringColor,
      darkFill: core.darkFill,
    });
    for (const mid of core.middle) {
      nodes.push({
        id: mid.id,
        label: mid.label,
        level: 2,
        coreId: core.id,
        middleId: mid.id,
        pathLabels: [core.label, mid.label],
        wheelFill: core.wheelFill,
        ringColor: core.ringColor,
        darkFill: core.darkFill,
      });
      for (const out of mid.outer) {
        nodes.push({
          id: out.id,
          label: out.label,
          level: 3,
          coreId: core.id,
          middleId: mid.id,
          pathLabels: [core.label, mid.label, out.label],
          wheelFill: core.wheelFill,
          ringColor: core.ringColor,
          darkFill: core.darkFill,
        });
      }
    }
  }
  return nodes;
})();

const CORE_MAP = new Map<CoreEmotionId, CoreEmotion>(
  CORE_EMOTIONS.map((c) => [c.id, c]),
);
const NODE_MAP = new Map<string, EmotionNode>(
  ALL_EMOTION_NODES.map((n) => [n.id, n]),
);

export function getCoreEmotion(coreId: CoreEmotionId): CoreEmotion | undefined {
  return CORE_MAP.get(coreId);
}

export function getEmotionById(id: string): EmotionNode | undefined {
  return NODE_MAP.get(id);
}

/** Normalize Icelandic text for accent-insensitive search. */
export function normalizeIcelandic(text: string): string {
  return text
    .toLowerCase()
    .replaceAll('á', 'a')
    .replaceAll('ð', 'd')
    .replaceAll('é', 'e')
    .replaceAll('í', 'i')
    .replaceAll('ó', 'o')
    .replaceAll('ú', 'u')
    .replaceAll('ý', 'y')
    .replaceAll('þ', 'th')
    .replaceAll('æ', 'ae')
    .replaceAll('ö', 'o')
    .trim();
}

export function searchEmotions(query: string): EmotionNode[] {
  const norm = normalizeIcelandic(query);
  if (!norm) return ALL_EMOTION_NODES;
  return ALL_EMOTION_NODES.filter(
    (node) =>
      normalizeIcelandic(node.label).includes(norm) ||
      node.pathLabels.some((p) => normalizeIcelandic(p).includes(norm)),
  );
}
