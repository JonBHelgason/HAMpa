export const ICELANDIC_WEEKDAYS_SHORT = [
  'Mán',
  'Þri',
  'Mið',
  'Fim',
  'Fös',
  'Lau',
  'Sun',
] as const;

export const ICELANDIC_MONTHS = [
  'janúar',
  'febrúar',
  'mars',
  'apríl',
  'maí',
  'júní',
  'júlí',
  'ágúst',
  'september',
  'október',
  'nóvember',
  'desember',
] as const;

export const ICELANDIC_WEEKDAYS_FULL = [
  'sunnudagur',
  'mánudagur',
  'þriðjudagur',
  'miðvikudagur',
  'fimmtudagur',
  'föstudagur',
  'laugardagur',
] as const;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Format a local Date into YYYY-MM-DD without UTC conversion drift. */
export function toDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}-${month}-${day}`;
}

export function parseDateKey(dateKey: string): Date {
  const [yStr, mStr, dStr] = dateKey.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const base = parseDateKey(dateKey);
  base.setDate(base.getDate() + deltaDays);
  return toDateKey(base);
}

export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = Sun, 1 = Mon...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function getWeekDateKeys(anchorDateKey: string): string[] {
  const monday = getMondayOfWeek(parseDateKey(anchorDateKey));
  const mondayKey = toDateKey(monday);
  return Array.from({ length: 7 }, (_, i) => shiftDateKey(mondayKey, i));
}

export interface MonthGridCell {
  dateKey: string;
  dayNumber: number;
  inCurrentMonth: boolean;
}

export function getMonthGrid(year: number, monthIndex: number): MonthGridCell[] {
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const startMonday = getMondayOfWeek(firstDay);
  const totalDays = lastDay.getDate();
  const firstWeekdayOffset = (firstDay.getDay() + 6) % 7; // Mon=0..Sun=6
  const totalCells = Math.ceil((firstWeekdayOffset + totalDays) / 7) * 7;

  const startKey = toDateKey(startMonday);
  const cells: MonthGridCell[] = [];
  for (let i = 0; i < totalCells; i++) {
    const cellKey = shiftDateKey(startKey, i);
    const cellDate = parseDateKey(cellKey);
    cells.push({
      dateKey: cellKey,
      dayNumber: cellDate.getDate(),
      inCurrentMonth:
        cellDate.getFullYear() === year && cellDate.getMonth() === monthIndex,
    });
  }
  return cells;
}

export function formatIcelandicDate(dateKey: string): string {
  const d = parseDateKey(dateKey);
  const weekday = ICELANDIC_WEEKDAYS_FULL[d.getDay()];
  const month = ICELANDIC_MONTHS[d.getMonth()];
  const capWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${capWeekday}, ${d.getDate()}. ${month} ${d.getFullYear()}`;
}

export function formatShortIcelandicDate(dateKey: string): string {
  const d = parseDateKey(dateKey);
  const month = ICELANDIC_MONTHS[d.getMonth()];
  return `${d.getDate()}. ${month}`;
}

export function formatIcelandicMonthYear(year: number, monthIndex: number): string {
  const month = ICELANDIC_MONTHS[monthIndex];
  return `${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`;
}

export function formatTimeOfDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function formatRelativeAge(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diffMs = Math.max(0, now.getTime() - then.getTime());
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Rétt í þessu';
  if (mins < 60) return `Fyrir ${mins} mín.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Fyrir ${hours} klst.`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Fyrir 1 degi';
  return `Fyrir ${days} dögum`;
}
