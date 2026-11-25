export interface CognitiveDistortion {
  id: string;
  name: string;
  shortDescription: string;
  example: string;
}

export const COGNITIVE_DISTORTIONS: CognitiveDistortion[] = [
  {
    id: 'allt-eda-ekkert',
    name: 'Allt-eða-ekkert hugsun',
    shortDescription:
      'Að sjá hluti eingöngu sem fullkomna eða algerlega misheppnaða án nokkurs millivegar.',
    example: '„Ef þetta gengur ekki 100% upp hjá mér, þá er ég algerlega misheppnaður.“',
  },
  {
    id: 'hamfarahugsun',
    name: 'Hamfarahugsun',
    shortDescription:
      'Að búast sjálfkrafa við verstu hugsanlegu útkomu og ofmeta hversu alvarleg hún yrði.',
    example: '„Ef ég geri mistök á fundinum missi ég örugglega vinnuna og allt hrynur.“',
  },
  {
    id: 'hugsanalesning',
    name: 'Hugsanalesning',
    shortDescription:
      'Að telja sig vita hvað aðrir eru að hugsa (oftast neikvætt um mann) án raunverulegra sannana.',
    example: '„Hún svaraði stutt — hún er örugglega pirruð út í mig.“',
  },
  {
    id: 'spadomar',
    name: 'Spádómar',
    shortDescription:
      'Að spá fyrir um að framtíðin fari illa eins og það sé þegar orðin staðreynd.',
    example: '„Ég á ekki eftir að geta sofnað í nótt og morgundagurinn verður ónýtur.“',
  },
  {
    id: 'tilfinningarok',
    name: 'Tilfinningarök',
    shortDescription:
      'Að álykta að af því manni líði illa eða sé kvíðinn hljóti eitthvað slæmt að vera satt.',
    example: '„Mér líður eins og ég sé byrði, þess vegna hlýt ég að vera það.“',
  },
  {
    id: 'neikvaed-sia',
    name: 'Neikvæð sía',
    shortDescription:
      'Að einblína eingöngu á eitt neikvætt smáatriði og líta fram hjá öllu því góða í heildarmyndinni.',
    example: '„Ég fékk hrós fyrir kynninguna en hikstaði einu sinni — þetta gekk ömurlega.“',
  },
  {
    id: 'ofalhaefing',
    name: 'Ofalhæfing',
    shortDescription:
      'Að draga almenna reglu af einu erfiðu atviki („alltaf“, „aldrei“, „allir“).',
    example: '„Þetta gerist alltaf hjá mér; ég næ aldrei tökum á neinu.“',
  },
  {
    id: 'gera-litid-ur-jakvaedu',
    name: 'Að gera lítið úr því jákvæða',
    shortDescription:
      'Að afskrifa góða hluti eða eigin árangur sem heppni, tilviljun eða eitthvað sem „telst ekki með“.',
    example: '„Þetta tókst bara af því verkefnið var létt, ekki af því ég stóð mig vel.“',
  },
  {
    id: 'aetti-reglur',
    name: '„Ætti / verður“-reglur',
    shortDescription:
      'Að setja sér eða öðrum strangar, ósveigjanlegar kröfur sem kalla fram sektarkennd, skömm eða gremju.',
    example: '„Ég ætti alltaf að geta haldið öllu í fullkomnu lagi án þess að þreytast.“',
  },
  {
    id: 'stimplanir',
    name: 'Stimplanir',
    shortDescription:
      'Að skilgreina sjálfan sig eða aðra með einu hörðu orði út frá mistökum.',
    example: '„Ég gleymdi þessu — ég er algjör auli.“',
  },
  {
    id: 'personugerving',
    name: 'Persónugerving',
    shortDescription:
      'Að taka á sig sökina fyrir hluti sem maður stjórnar ekki eða tengja viðbrögð annarra sjálfkrafa við sjálfan sig.',
    example: '„Andrúmsloftið var þungt við matarborðið — það hlýtur að vera mér að kenna.“',
  },
  {
    id: 'osangjarn-samanburdur',
    name: 'Ósanngjarn samanburður',
    shortDescription:
      'Að bera sig saman við óraunhæfa staðla eða aðra á ósanngjarnan hátt og dæma sig út frá því.',
    example:
      '„Allir aðrir virðast hafa fulla stjórn á lífinu, ég ætti að vera kominn miklu lengra.“',
  },
  {
    id: 'ykjun-og-smaettun',
    name: 'Ýkjun og smættun',
    shortDescription:
      'Að gera mistök og erfiðleika mun stærri en þeir eru og draga um leið úr eigin styrkleikum.',
    example:
      '„Þessi litlu mistök eyðilögðu allt, en það sem ég gerði vel skiptir engu máli.“',
  },
];

const DISTORTION_MAP = new Map<string, CognitiveDistortion>(
  COGNITIVE_DISTORTIONS.map((d) => [d.id, d]),
);

export function getDistortionById(id: string): CognitiveDistortion | undefined {
  return DISTORTION_MAP.get(id);
}
