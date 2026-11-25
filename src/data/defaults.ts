export const DEFAULT_TAGS: string[] = [
  'Vinna',
  'Fjölskylda',
  'Svefn',
  'Heilsa',
  'Félagslíf',
  'Fjármál',
  'Heimili',
  'Álag',
];

export interface DefaultHabitTemplate {
  id: string;
  label: string;
}

export const DEFAULT_EVENING_HABITS: DefaultHabitTemplate[] = [
  { id: 'habit-utivera', label: 'Útivera / hreyfing' },
  { id: 'habit-hvild', label: 'Gaf mér stund til hvíldar' },
  { id: 'habit-gott', label: 'Gerði eitthvað gott fyrir sjálfan mig' },
];

export const DIARY_SCALES: Record<number, string> = {
  1: 'Mjög slæmt',
  2: 'Slæmt',
  3: 'Í lagi',
  4: 'Gott',
  5: 'Mjög gott',
};

export const ENERGY_SCALES: Record<number, string> = {
  1: 'Mjög lítil',
  2: 'Lítil',
  3: 'Í meðallagi',
  4: 'Góð',
  5: 'Mjög góð',
};

export const MOOD_SCALES: Record<number, string> = {
  1: 'Mjög þung',
  2: 'Þung',
  3: 'Hlutlaus',
  4: 'Góð',
  5: 'Mjög góð',
};
