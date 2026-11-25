export type ThoughtRecordStatus = 'draft' | 'incomplete' | 'completed';

export interface EmotionEntry {
  id: string;
  emotionId: string;
  intensityBefore: number;
  intensityAfter?: number;
}

export interface AutomaticThought {
  id: string;
  text: string;
  groupId: string;
  linkedEmotionId?: string;
}

export interface ThoughtGroup {
  id: string;
  beliefBefore: number;
  beliefAfter?: number;
  distortionIds: string[];
  promptAnswers: Record<string, string>;
  balancedThought: string;
}

export interface ThoughtRecord {
  id: string;
  dateKey: string;
  createdAt: string;
  updatedAt: string;
  status: ThoughtRecordStatus;
  reappraisalSkipped?: boolean;
  situation: {
    description: string;
    tags: string[];
  };
  emotions: EmotionEntry[];
  thoughts: AutomaticThought[];
  thoughtGroups: ThoughtGroup[];
}

export interface QuickMoodEmotion {
  id: string;
  emotionId: string;
  intensity: number;
}

export interface QuickMoodEntry {
  id: string;
  dateKey: string;
  createdAt: string;
  updatedAt: string;
  emotions: QuickMoodEmotion[];
  note: string;
}

export interface DiaryMorning {
  sleepHours?: number;
  sleepQuality?: number;
  energy?: number;
  mood?: number;
  gratitude?: string;
}

export interface DiaryHabitCheck {
  habitId: string;
  label: string;
  answer: boolean | null;
}

export interface DiaryEvening {
  mood?: number;
  foodAndDrink?: string;
  steps?: number;
  habits: DiaryHabitCheck[];
}

export interface DiaryEntry {
  dateKey: string;
  updatedAt: string;
  morning?: DiaryMorning;
  evening?: DiaryEvening;
}

export interface EveningHabitDef {
  id: string;
  label: string;
  active: boolean;
}

export type ThemePreference = 'system' | 'light' | 'dark';

export interface AppSettings {
  id: 'main';
  theme: ThemePreference;
  customTags: string[];
  hiddenDefaultTags: string[];
  eveningHabits: EveningHabitDef[];
}

export interface HampaBackupV1 {
  app: 'HAMpa';
  schemaVersion: 1;
  exportedAt: string;
  data: {
    thoughtRecords: ThoughtRecord[];
    quickMoods: QuickMoodEntry[];
    diaryEntries: DiaryEntry[];
    settings: AppSettings;
  };
}
