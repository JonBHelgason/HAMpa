import { DEFAULT_TAGS } from '../data/defaults';
import {
  ALL_EMOTION_NODES,
  getEmotionById,
  normalizeIcelandic,
  type CoreEmotionId,
  type EmotionNode,
} from '../data/emotionWheel';
import { toDateKey } from '../domain/dates';
import { createId, recalculateStatus } from '../domain/thoughtRecord';
import { createDefaultSettings } from './db';
import type {
  AppSettings,
  AutomaticThought,
  DiaryEntry,
  DiaryEvening,
  DiaryHabitCheck,
  DiaryMorning,
  EmotionEntry,
  HampaBackupV1,
  QuickMoodEmotion,
  QuickMoodEntry,
  ThoughtGroup,
  ThoughtRecord,
} from './schema';

export interface LegacyBackupSummary {
  exportedAt: string;
  thoughtRecordsCount: number;
  quickMoodsCount: number;
  diaryEntriesCount: number;
  sourceLabel?: string;
}

export type LegacyConvertResult =
  | { ok: true; backup: HampaBackupV1; summary: LegacyBackupSummary }
  | { ok: false; error: string };

interface LegacySituation {
  id?: unknown;
  title?: unknown;
  desc?: unknown;
  tags?: unknown;
}

interface LegacyEmotion {
  w?: unknown;
  s?: unknown;
  s2?: unknown;
}

interface LegacyThought {
  id?: unknown;
  text?: unknown;
  belief1?: unknown;
  belief2?: unknown;
  errors?: unknown;
  q1?: unknown;
  q2?: unknown;
  lead?: unknown;
  emos?: unknown;
}

interface LegacyRecord {
  id?: unknown;
  time?: unknown;
  situations?: unknown;
  emotions?: unknown;
  thoughts?: unknown;
  ci?: unknown;
  lokid?: unknown;
  legacy?: unknown;
  note?: unknown;
}

interface LegacyDiaryDay {
  sleepFrom?: unknown;
  sleepTo?: unknown;
  sleepQ?: unknown;
  energy?: unknown;
  moodAm?: unknown;
  mood?: unknown;
  steps?: unknown;
  eat?: unknown;
  grat?: unknown;
  pos?: unknown;
}

const LEGACY_DISTORTION_MAP: Record<string, string> = {
  'allt eda ekkert': 'allt-eda-ekkert',
  'allt-eda-ekkert hugsun': 'allt-eda-ekkert',
  hamfarahugsun: 'hamfarahugsun',
  hrakspa: 'spadomar',
  spadomar: 'spadomar',
  hugsunarlestur: 'hugsanalesning',
  hugsanalesning: 'hugsanalesning',
  'neikvaed rorsyn': 'neikvaed-sia',
  'neikvaed sia': 'neikvaed-sia',
  alhaefingar: 'ofalhaefing',
  ofalhaefing: 'ofalhaefing',
  'afskrifum hid jakvaeda': 'gera-litid-ur-jakvaedu',
  'ad gera litid ur thvi jakvaeda': 'gera-litid-ur-jakvaedu',
  tilfinningarok: 'tilfinningarok',
  'oraunsae bod og bonn': 'aetti-reglur',
  'aetti / verdur-reglur': 'aetti-reglur',
  uppnefni: 'stimplanir',
  stimplanir: 'stimplanir',
  personugerving: 'personugerving',
  'osangjarn samanburdur': 'osangjarn-samanburdur',
  'osanngjarn samanburdur': 'osangjarn-samanburdur',
  'ykjun og smaettun': 'ykjun-og-smaettun',
};

const EMOTIONS_BY_LABEL: Map<string, EmotionNode[]> = (() => {
  const map = new Map<string, EmotionNode[]>();
  for (const node of ALL_EMOTION_NODES) {
    const key = normalizeIcelandic(node.label);
    const list = map.get(key) ?? [];
    list.push(node);
    map.set(key, list);
  }
  return map;
})();

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value));
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function parseLegacyTimestamp(timeValue: unknown): {
  dateKey: string;
  iso: string;
} {
  const raw = asTrimmedString(timeValue);
  const localMatch = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (localMatch) {
    const y = Number(localMatch[1]);
    const m = Number(localMatch[2]);
    const d = Number(localMatch[3]);
    const hh = localMatch[4] ? Number(localMatch[4]) : 12;
    const mm = localMatch[5] ? Number(localMatch[5]) : 0;
    const ss = localMatch[6] ? Number(localMatch[6]) : 0;
    const dt = new Date(y, m - 1, d, hh, mm, ss);
    return {
      dateKey: `${localMatch[1]}-${localMatch[2]}-${localMatch[3]}`,
      iso: Number.isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString(),
    };
  }

  const parsed = raw ? new Date(raw) : new Date();
  if (!Number.isNaN(parsed.getTime())) {
    const dateKey = /^\d{4}-\d{2}-\d{2}/.test(raw)
      ? raw.slice(0, 10)
      : toDateKey(parsed);
    return { dateKey, iso: parsed.toISOString() };
  }

  const fallback = new Date();
  return { dateKey: toDateKey(fallback), iso: fallback.toISOString() };
}

function detectIntensityScaleFactor(records: LegacyRecord[]): number {
  let maxVal = 0;
  for (const r of records) {
    if (!Array.isArray(r.emotions)) continue;
    for (const em of r.emotions) {
      if (!isObjectRecord(em)) continue;
      const s = asFiniteNumber(em.s);
      const s2 = asFiniteNumber(em.s2);
      if (s !== undefined && s > maxVal) maxVal = s;
      if (s2 !== undefined && s2 > maxVal) maxVal = s2;
    }
  }
  return maxVal <= 10 ? 10 : 1;
}

function resolveEmotionId(
  word: string,
  unambiguousCoreIds: Set<CoreEmotionId>,
): string {
  const key = normalizeIcelandic(word);
  const candidates = EMOTIONS_BY_LABEL.get(key);
  if (!candidates || candidates.length === 0) {
    return word.trim();
  }
  if (candidates.length === 1) {
    return candidates[0].id;
  }
  const contextMatch = candidates.find((c) =>
    unambiguousCoreIds.has(c.coreId),
  );
  if (contextMatch) {
    return contextMatch.id;
  }
  const byLevel = [...candidates].sort((a, b) => a.level - b.level);
  return byLevel[0].id;
}

function collectUnambiguousCores(
  rawEmotions: LegacyEmotion[],
): Set<CoreEmotionId> {
  const cores = new Set<CoreEmotionId>();
  for (const em of rawEmotions) {
    const word = asTrimmedString(em.w);
    if (!word) continue;
    const candidates = EMOTIONS_BY_LABEL.get(normalizeIcelandic(word));
    if (candidates && candidates.length === 1) {
      cores.add(candidates[0].coreId);
    }
  }
  return cores;
}

function mapDistortionId(rawName: string): string {
  const norm = normalizeIcelandic(rawName);
  return LEGACY_DISTORTION_MAP[norm] ?? rawName.trim();
}

function extractSituationTextAndTags(
  situationsRaw: unknown,
  legacyObj: unknown,
): { description: string; tags: string[] } {
  const situations = Array.isArray(situationsRaw)
    ? situationsRaw.filter(isObjectRecord)
    : [];

  const parts: string[] = [];
  const tagSet = new Set<string>();

  for (const sit of situations as LegacySituation[]) {
    const title = asTrimmedString(sit.title);
    const desc = asTrimmedString(sit.desc);

    if (title && desc && desc !== title && !desc.startsWith(title)) {
      parts.push(`${title}\n${desc}`);
    } else if (desc || title) {
      parts.push(desc || title);
    }

    if (isObjectRecord(sit.tags)) {
      for (const bucket of Object.values(sit.tags)) {
        if (!Array.isArray(bucket)) continue;
        for (const tag of bucket) {
          const trimmed = asTrimmedString(tag);
          if (trimmed) tagSet.add(trimmed);
        }
      }
    }
  }

  if (isObjectRecord(legacyObj)) {
    const did = asTrimmedString(legacyObj.did);
    const helped = asTrimmedString(legacyObj.helped);
    const alt = asTrimmedString(legacyObj.alt);
    const legacyNotes: string[] = [];
    if (did) {
      legacyNotes.push(
        helped ? `Viðbrögð: ${did} (hjálpaði: ${helped})` : `Viðbrögð: ${did}`,
      );
    }
    if (alt) {
      legacyNotes.push(`Annað: ${alt}`);
    }
    if (legacyNotes.length > 0) {
      parts.push(legacyNotes.join('\n'));
    }
  }

  return {
    description: parts.join('\n\n'),
    tags: Array.from(tagSet),
  };
}

function parseClockMinutes(hhmm: unknown): number | undefined {
  const raw = asTrimmedString(hhmm);
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return undefined;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return undefined;
  return hh * 60 + mm;
}

function parseLegacyPosAnswer(val: unknown): boolean | null {
  if (typeof val === 'boolean') return val;
  const norm = normalizeIcelandic(asTrimmedString(val));
  if (norm === 'ja' || norm === 'yes' || norm === 'true') return true;
  if (norm === 'nei' || norm === 'no' || norm === 'false') return false;
  return null;
}

function convertDiaryEntry(
  dateKey: string,
  rawDay: LegacyDiaryDay,
  exportedIso: string,
): DiaryEntry | null {
  const morning: DiaryMorning = {};
  const fromMins = parseClockMinutes(rawDay.sleepFrom);
  const toMins = parseClockMinutes(rawDay.sleepTo);
  if (fromMins !== undefined && toMins !== undefined) {
    let diff = toMins - fromMins;
    if (diff < 0) diff += 24 * 60;
    morning.sleepHours = clamp(0, 14, Math.round((diff / 60) * 2) / 2);
  }

  const sleepQ = asFiniteNumber(rawDay.sleepQ);
  if (sleepQ !== undefined) {
    morning.sleepQuality = clamp(1, 5, Math.round(sleepQ));
  }
  const energy = asFiniteNumber(rawDay.energy);
  if (energy !== undefined) {
    morning.energy = clamp(1, 5, Math.round(energy));
  }
  const moodAm = asFiniteNumber(rawDay.moodAm);
  if (moodAm !== undefined) {
    morning.mood = clamp(1, 5, Math.round(moodAm));
  }
  const grat = asTrimmedString(rawDay.grat);
  if (grat) {
    morning.gratitude = grat;
  }

  const eveningHabits: DiaryHabitCheck[] = [];
  const posAnswer = parseLegacyPosAnswer(rawDay.pos);
  if (posAnswer !== null) {
    eveningHabits.push({
      habitId: 'habit-gott',
      label: 'Gerði eitthvað gott fyrir sjálfan mig',
      answer: posAnswer,
    });
  }

  const evening: DiaryEvening = { habits: eveningHabits };
  const moodPm = asFiniteNumber(rawDay.mood);
  if (moodPm !== undefined) {
    evening.mood = clamp(1, 5, Math.round(moodPm));
  }
  const eat = asTrimmedString(rawDay.eat);
  if (eat) {
    evening.foodAndDrink = eat;
  }
  const steps = asFiniteNumber(rawDay.steps);
  if (steps !== undefined) {
    evening.steps = Math.max(0, Math.round(steps));
  }

  const hasMorning = Object.keys(morning).length > 0;
  const hasEvening =
    evening.mood !== undefined ||
    evening.foodAndDrink !== undefined ||
    evening.steps !== undefined ||
    evening.habits.length > 0;

  if (!hasMorning && !hasEvening) {
    return null;
  }

  return {
    dateKey,
    updatedAt: exportedIso,
    ...(hasMorning ? { morning } : {}),
    ...(hasEvening ? { evening } : {}),
  };
}

function convertLegacySettings(parsed: Record<string, unknown>): AppSettings {
  const defaults = createDefaultSettings();
  const defaultLower = new Map(
    DEFAULT_TAGS.map((t) => [t.toLowerCase(), t]),
  );

  const customTagSet = new Set<string>();
  if (isObjectRecord(parsed.customTags)) {
    for (const bucket of Object.values(parsed.customTags)) {
      if (!Array.isArray(bucket)) continue;
      for (const item of bucket) {
        const trimmed = asTrimmedString(item);
        if (!trimmed) continue;
        if (!defaultLower.has(trimmed.toLowerCase())) {
          customTagSet.add(trimmed);
        }
      }
    }
  }

  const hiddenSet = new Set<string>();
  if (isObjectRecord(parsed.hiddenTags)) {
    for (const bucket of Object.values(parsed.hiddenTags)) {
      if (!Array.isArray(bucket)) continue;
      for (const item of bucket) {
        const trimmed = asTrimmedString(item);
        const matchedDefault = defaultLower.get(trimmed.toLowerCase());
        if (matchedDefault) {
          hiddenSet.add(matchedDefault);
        }
      }
    }
  }

  return {
    ...defaults,
    customTags: Array.from(customTagSet),
    hiddenDefaultTags: Array.from(hiddenSet),
  };
}

export function isLegacyHugsanaskraBackup(parsed: unknown): boolean {
  return (
    isObjectRecord(parsed) &&
    parsed.app === 'hugsanaskra' &&
    Array.isArray(parsed.records)
  );
}

export function convertLegacyBackup(
  parsed: Record<string, unknown>,
): LegacyConvertResult {
  const rawRecords = Array.isArray(parsed.records)
    ? parsed.records.filter(isObjectRecord)
    : null;
  if (!rawRecords) {
    return {
      ok: false,
      error: 'Skráningarlisti vantar í gamla afritið.',
    };
  }

  const exportedAt =
    asTrimmedString(parsed.exported) || new Date().toISOString();
  const scaleFactor = detectIntensityScaleFactor(rawRecords as LegacyRecord[]);

  const thoughtRecords: ThoughtRecord[] = [];
  const quickMoods: QuickMoodEntry[] = [];

  for (const raw of rawRecords as LegacyRecord[]) {
    const id = asTrimmedString(raw.id) || createId();
    const { dateKey, iso } = parseLegacyTimestamp(raw.time);
    const rawEmotions: LegacyEmotion[] = Array.isArray(raw.emotions)
      ? raw.emotions.filter(isObjectRecord)
      : [];
    const contextCores = collectUnambiguousCores(rawEmotions);

    if (raw.ci === true) {
      const moodEmotions: QuickMoodEmotion[] = rawEmotions
        .map((em) => {
          const word = asTrimmedString(em.w);
          if (!word) return null;
          const s = asFiniteNumber(em.s) ?? 5;
          return {
            id: createId(),
            emotionId: resolveEmotionId(word, contextCores),
            intensity: clamp(0, 100, Math.round(s * scaleFactor)),
          };
        })
        .filter((e): e is QuickMoodEmotion => e !== null);

      const { description } = extractSituationTextAndTags(
        raw.situations,
        raw.legacy,
      );
      const noteText = asTrimmedString(raw.note) || description;

      quickMoods.push({
        id,
        dateKey,
        createdAt: iso,
        updatedAt: iso,
        emotions: moodEmotions,
        note: noteText,
      });
      continue;
    }

    const { description, tags } = extractSituationTextAndTags(
      raw.situations,
      raw.legacy,
    );

    const emotions: EmotionEntry[] = [];
    const emotionLookupByWord = new Map<string, string>();
    for (const em of rawEmotions) {
      const word = asTrimmedString(em.w);
      if (!word) continue;
      const emotionId = resolveEmotionId(word, contextCores);
      const s = asFiniteNumber(em.s) ?? 5;
      const s2 = asFiniteNumber(em.s2);
      const entryId = createId();
      emotions.push({
        id: entryId,
        emotionId,
        intensityBefore: clamp(0, 100, Math.round(s * scaleFactor)),
        ...(s2 !== undefined
          ? { intensityAfter: clamp(0, 100, Math.round(s2 * scaleFactor)) }
          : {}),
      });

      emotionLookupByWord.set(normalizeIcelandic(word), entryId);
      const nodeLabel = getEmotionById(emotionId)?.label;
      if (nodeLabel) {
        emotionLookupByWord.set(normalizeIcelandic(nodeLabel), entryId);
      }
    }

    const rawThoughts: LegacyThought[] = Array.isArray(raw.thoughts)
      ? raw.thoughts.filter(isObjectRecord)
      : [];
    const rawThoughtIds = new Set(
      rawThoughts
        .map((t) => asTrimmedString(t.id))
        .filter((tid) => tid.length > 0),
    );

    const thoughts: AutomaticThought[] = [];
    const groupMap = new Map<string, ThoughtGroup>();

    // First pass: register leaders and build their groups
    for (const rt of rawThoughts) {
      const tid = asTrimmedString(rt.id) || createId();
      const leadId = asTrimmedString(rt.lead);
      const isFollower = leadId.length > 0 && rawThoughtIds.has(leadId);
      const leaderId = isFollower ? leadId : tid;
      const groupId = `grp-${leaderId}`;

      let linkedEmotionId: string | undefined;
      if (Array.isArray(rt.emos)) {
        for (const emoLabel of rt.emos) {
          const matchId = emotionLookupByWord.get(
            normalizeIcelandic(asTrimmedString(emoLabel)),
          );
          if (matchId) {
            linkedEmotionId = matchId;
            break;
          }
        }
      }

      thoughts.push({
        id: tid,
        text: asTrimmedString(rt.text),
        groupId,
        ...(linkedEmotionId ? { linkedEmotionId } : {}),
      });

      if (!isFollower) {
        const b1 = asFiniteNumber(rt.belief1);
        const b2 = asFiniteNumber(rt.belief2);
        const q1 = asTrimmedString(rt.q1);
        const q2 = asTrimmedString(rt.q2);
        const distortionIds = Array.isArray(rt.errors)
          ? Array.from(
              new Set(
                rt.errors
                  .map((e) => asTrimmedString(e))
                  .filter(Boolean)
                  .map(mapDistortionId),
              ),
            )
          : [];

        groupMap.set(groupId, {
          id: groupId,
          beliefBefore: b1 !== undefined ? clamp(0, 100, Math.round(b1)) : 50,
          ...(b2 !== undefined
            ? { beliefAfter: clamp(0, 100, Math.round(b2)) }
            : {}),
          distortionIds,
          promptAnswers: q1 ? { rok: q1 } : {},
          balancedThought: q2,
        });
      }
    }

    // Second pass: merge any non-empty follower fields into leader's group
    for (const rt of rawThoughts) {
      const leadId = asTrimmedString(rt.lead);
      if (!leadId || !rawThoughtIds.has(leadId)) continue;
      const group = groupMap.get(`grp-${leadId}`);
      if (!group) continue;

      if (Array.isArray(rt.errors)) {
        for (const err of rt.errors) {
          const mapped = mapDistortionId(asTrimmedString(err));
          if (mapped && !group.distortionIds.includes(mapped)) {
            group.distortionIds.push(mapped);
          }
        }
      }
      const q1 = asTrimmedString(rt.q1);
      if (q1) {
        const prev = group.promptAnswers.rok?.trim();
        group.promptAnswers.rok = prev && prev !== q1 ? `${prev}\n\n${q1}` : q1;
      }
      const q2 = asTrimmedString(rt.q2);
      if (q2) {
        const prev = group.balancedThought.trim();
        group.balancedThought = prev && prev !== q2 ? `${prev}\n\n${q2}` : q2;
      }
    }

    const baseRecord: ThoughtRecord = {
      id,
      dateKey,
      createdAt: iso,
      updatedAt: iso,
      status: raw.lokid === true ? 'completed' : 'draft',
      ...(raw.lokid === true ? { reappraisalSkipped: false } : {}),
      situation: {
        description,
        tags,
      },
      emotions,
      thoughts,
      thoughtGroups: Array.from(groupMap.values()),
    };

    const status =
      raw.lokid === true ? 'completed' : recalculateStatus(baseRecord);

    thoughtRecords.push({
      ...baseRecord,
      status,
    });
  }

  const diaryEntries: DiaryEntry[] = [];
  if (isObjectRecord(parsed.diary)) {
    for (const [dateKey, rawDay] of Object.entries(parsed.diary)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !isObjectRecord(rawDay)) {
        continue;
      }
      const converted = convertDiaryEntry(
        dateKey,
        rawDay as LegacyDiaryDay,
        exportedAt,
      );
      if (converted) {
        diaryEntries.push(converted);
      }
    }
  }

  const settings = convertLegacySettings(parsed);
  const backup: HampaBackupV1 = {
    app: 'HAMpa',
    schemaVersion: 1,
    exportedAt,
    data: {
      thoughtRecords,
      quickMoods,
      diaryEntries,
      settings,
    },
  };

  return {
    ok: true,
    backup,
    summary: {
      exportedAt,
      thoughtRecordsCount: thoughtRecords.length,
      quickMoodsCount: quickMoods.length,
      diaryEntriesCount: diaryEntries.length,
      sourceLabel: 'Gamla forritið (hugsanaskra)',
    },
  };
}
