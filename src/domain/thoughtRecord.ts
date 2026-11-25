import type {
  AutomaticThought,
  QuickMoodEntry,
  ThoughtGroup,
  ThoughtRecord,
  ThoughtRecordStatus,
} from '../db/schema';
import { getMondayOfWeek, shiftDateKey, toDateKey } from './dates';

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyThoughtGroup(beliefBefore = 50): ThoughtGroup {
  return {
    id: createId(),
    beliefBefore,
    distortionIds: [],
    promptAnswers: {},
    balancedThought: '',
  };
}

export function createEmptyThoughtRecord(now: Date = new Date()): ThoughtRecord {
  const iso = now.toISOString();
  return {
    id: createId(),
    dateKey: toDateKey(now),
    createdAt: iso,
    updatedAt: iso,
    status: 'draft',
    situation: {
      description: '',
      tags: [],
    },
    emotions: [],
    thoughts: [],
    thoughtGroups: [],
  };
}

export function isRecordCompletelyEmpty(record: ThoughtRecord): boolean {
  const hasSituation = record.situation.description.trim().length > 0;
  const hasTags = record.situation.tags.length > 0;
  const hasEmotions = record.emotions.length > 0;
  const hasThoughtText = record.thoughts.some((t) => t.text.trim().length > 0);
  const hasReappraisal = record.thoughtGroups.some(
    (g) =>
      g.distortionIds.length > 0 ||
      g.balancedThought.trim().length > 0 ||
      Object.values(g.promptAnswers).some((v) => v.trim().length > 0),
  );
  return (
    !hasSituation &&
    !hasTags &&
    !hasEmotions &&
    !hasThoughtText &&
    !hasReappraisal
  );
}

export function isColumn1Complete(record: ThoughtRecord): boolean {
  return record.situation.description.trim().length > 0;
}

export function isColumn2Complete(record: ThoughtRecord): boolean {
  return record.emotions.length > 0;
}

export function isColumn3Complete(record: ThoughtRecord): boolean {
  return record.thoughts.some((t) => t.text.trim().length > 0);
}

export function canUnlockColumn4(record: ThoughtRecord): boolean {
  return (
    isColumn1Complete(record) &&
    isColumn2Complete(record) &&
    isColumn3Complete(record)
  );
}

export function recalculateStatus(record: ThoughtRecord): ThoughtRecordStatus {
  if (!canUnlockColumn4(record)) {
    return 'draft';
  }
  if (record.status === 'completed') {
    return 'completed';
  }
  return 'incomplete';
}

export function addThought(
  record: ThoughtRecord,
  text = '',
  beliefBefore = 50,
): ThoughtRecord {
  const group = createEmptyThoughtGroup(beliefBefore);
  const thought: AutomaticThought = {
    id: createId(),
    text,
    groupId: group.id,
  };
  const next: ThoughtRecord = {
    ...record,
    thoughts: [...record.thoughts, thought],
    thoughtGroups: [...record.thoughtGroups, group],
  };
  return {
    ...next,
    status: recalculateStatus(next),
  };
}

export function removeThought(
  record: ThoughtRecord,
  thoughtId: string,
): ThoughtRecord {
  const target = record.thoughts.find((t) => t.id === thoughtId);
  if (!target) return record;
  const remainingThoughts = record.thoughts.filter((t) => t.id !== thoughtId);
  const usedGroupIds = new Set(remainingThoughts.map((t) => t.groupId));
  const remainingGroups = record.thoughtGroups.filter((g) =>
    usedGroupIds.has(g.id),
  );
  const next: ThoughtRecord = {
    ...record,
    thoughts: remainingThoughts,
    thoughtGroups: remainingGroups,
  };
  return {
    ...next,
    status: recalculateStatus(next),
  };
}

export function linkThoughts(
  record: ThoughtRecord,
  thoughtIds: string[],
): ThoughtRecord {
  const selectedIds = Array.from(new Set(thoughtIds));
  if (selectedIds.length < 2) return record;

  const selectedThoughts = record.thoughts.filter((t) =>
    selectedIds.includes(t.id),
  );
  if (selectedThoughts.length < 2) return record;

  const targetGroupId = selectedThoughts[0].groupId;
  const involvedGroupIds = Array.from(
    new Set(selectedThoughts.map((t) => t.groupId)),
  );
  if (involvedGroupIds.length <= 1) return record;

  const groupMap = new Map(record.thoughtGroups.map((g) => [g.id, g]));
  const primaryGroup =
    groupMap.get(targetGroupId) ?? createEmptyThoughtGroup(50);

  const distortionSet = new Set<string>(primaryGroup.distortionIds);
  const mergedPromptAnswers: Record<string, string> = {
    ...primaryGroup.promptAnswers,
  };
  const balancedParts: string[] = [];
  if (primaryGroup.balancedThought.trim()) {
    balancedParts.push(primaryGroup.balancedThought.trim());
  }

  for (const gid of involvedGroupIds) {
    if (gid === targetGroupId) continue;
    const g = groupMap.get(gid);
    if (!g) continue;
    for (const d of g.distortionIds) {
      distortionSet.add(d);
    }
    for (const [key, val] of Object.entries(g.promptAnswers)) {
      const trimmed = val.trim();
      if (!trimmed) continue;
      const existing = mergedPromptAnswers[key]?.trim();
      if (!existing) {
        mergedPromptAnswers[key] = trimmed;
      } else if (existing !== trimmed) {
        mergedPromptAnswers[key] = `${existing}\n\n${trimmed}`;
      }
    }
    const bal = g.balancedThought.trim();
    if (bal && !balancedParts.includes(bal)) {
      balancedParts.push(bal);
    }
  }

  const mergedGroup: ThoughtGroup = {
    ...primaryGroup,
    distortionIds: Array.from(distortionSet),
    promptAnswers: mergedPromptAnswers,
    balancedThought: balancedParts.join('\n\n'),
  };

  const selectedSet = new Set(selectedIds);
  const nextThoughts = record.thoughts.map((t) =>
    selectedSet.has(t.id) ? { ...t, groupId: targetGroupId } : t,
  );
  const activeGroupIds = new Set(nextThoughts.map((t) => t.groupId));
  const nextGroups = record.thoughtGroups
    .map((g) => (g.id === targetGroupId ? mergedGroup : g))
    .filter((g) => activeGroupIds.has(g.id));

  return {
    ...record,
    thoughts: nextThoughts,
    thoughtGroups: nextGroups,
  };
}

export function unlinkThought(
  record: ThoughtRecord,
  thoughtId: string,
): ThoughtRecord {
  const target = record.thoughts.find((t) => t.id === thoughtId);
  if (!target) return record;
  const siblings = record.thoughts.filter((t) => t.groupId === target.groupId);
  if (siblings.length <= 1) return record;

  const currentGroup = record.thoughtGroups.find(
    (g) => g.id === target.groupId,
  );
  const newGroup = createEmptyThoughtGroup(currentGroup?.beliefBefore ?? 50);

  return {
    ...record,
    thoughts: record.thoughts.map((t) =>
      t.id === thoughtId ? { ...t, groupId: newGroup.id } : t,
    ),
    thoughtGroups: [...record.thoughtGroups, newGroup],
  };
}

export type HomeEntryItem =
  | { kind: 'thought'; dateKey: string; createdAt: string; record: ThoughtRecord }
  | { kind: 'mood'; dateKey: string; createdAt: string; entry: QuickMoodEntry };

export interface GroupedHomeEntries {
  incomplete: ThoughtRecord[];
  today: HomeEntryItem[];
  yesterday: HomeEntryItem[];
  thisWeek: HomeEntryItem[];
  lastWeek: HomeEntryItem[];
  older: HomeEntryItem[];
}

export function groupHomeEntries(
  thoughtRecords: ThoughtRecord[],
  quickMoods: QuickMoodEntry[],
  now: Date = new Date(),
): GroupedHomeEntries {
  const incomplete: ThoughtRecord[] = [];
  const items: HomeEntryItem[] = [];

  for (const record of thoughtRecords) {
    if (record.status === 'incomplete') {
      incomplete.push(record);
    } else {
      items.push({
        kind: 'thought',
        dateKey: record.dateKey,
        createdAt: record.createdAt,
        record,
      });
    }
  }

  for (const entry of quickMoods) {
    items.push({
      kind: 'mood',
      dateKey: entry.dateKey,
      createdAt: entry.createdAt,
      entry,
    });
  }

  incomplete.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const todayKey = toDateKey(now);
  const yesterdayKey = shiftDateKey(todayKey, -1);
  const thisWeekStartKey = toDateKey(getMondayOfWeek(now));
  const lastWeekStartKey = shiftDateKey(thisWeekStartKey, -7);

  const result: GroupedHomeEntries = {
    incomplete,
    today: [],
    yesterday: [],
    thisWeek: [],
    lastWeek: [],
    older: [],
  };

  for (const item of items) {
    const dk = item.dateKey;
    if (dk === todayKey) {
      result.today.push(item);
    } else if (dk === yesterdayKey) {
      result.yesterday.push(item);
    } else if (dk >= thisWeekStartKey && dk < todayKey) {
      result.thisWeek.push(item);
    } else if (dk >= lastWeekStartKey && dk < thisWeekStartKey) {
      result.lastWeek.push(item);
    } else {
      result.older.push(item);
    }
  }

  return result;
}
