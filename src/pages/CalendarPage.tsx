import { useLiveQuery } from 'dexie-react-hooks';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Moon,
  Smile,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { DayEmotionRing } from '../components/ui/DayEmotionRing';
import { DIARY_SCALES, ENERGY_SCALES, MOOD_SCALES } from '../data/defaults';
import { getEmotionById } from '../data/emotionWheel';
import { db } from '../db/db';
import type { DiaryEntry, QuickMoodEntry, ThoughtRecord } from '../db/schema';
import { computeDayEmotionBlend } from '../domain/calendar';
import {
  ICELANDIC_WEEKDAYS_SHORT,
  formatIcelandicDate,
  formatIcelandicMonthYear,
  formatShortIcelandicDate,
  formatTimeOfDay,
  getMonthGrid,
  getWeekDateKeys,
  parseDateKey,
  shiftDateKey,
  toDateKey,
} from '../domain/dates';

interface CalendarPageProps {
  onOpenThoughtRecord: (id: string) => void;
  onOpenQuickMood: (id: string) => void;
  onOpenDiary: (dateKey: string) => void;
}

export function CalendarPage({
  onOpenThoughtRecord,
  onOpenQuickMood,
  onOpenDiary,
}: CalendarPageProps) {
  const todayKey = toDateKey();
  const [viewMode, setViewMode] = useState<'week' | 'month'>('month');
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);
  const [anchorDateKey, setAnchorDateKey] = useState<string>(todayKey);

  const thoughtRecords = useLiveQuery(
    () => db.thoughtRecords.toArray(),
    [],
    [] as ThoughtRecord[],
  );
  const quickMoods = useLiveQuery(
    () => db.quickMoods.toArray(),
    [],
    [] as QuickMoodEntry[],
  );
  const diaryEntries = useLiveQuery(
    () => db.diaryEntries.toArray(),
    [],
    [] as DiaryEntry[],
  );

  const diaryByDate = useMemo(
    () => new Map(diaryEntries.map((d) => [d.dateKey, d])),
    [diaryEntries],
  );

  const anchorDate = parseDateKey(anchorDateKey);
  const anchorYear = anchorDate.getFullYear();
  const anchorMonth = anchorDate.getMonth();

  const weekKeys = useMemo(
    () => getWeekDateKeys(anchorDateKey),
    [anchorDateKey],
  );
  const monthCells = useMemo(
    () => getMonthGrid(anchorYear, anchorMonth),
    [anchorYear, anchorMonth],
  );

  const navigatePeriod = (dir: -1 | 1) => {
    if (viewMode === 'week') {
      const next = shiftDateKey(anchorDateKey, dir * 7);
      setAnchorDateKey(next);
      return;
    }
    const nextMonthDate = new Date(anchorYear, anchorMonth + dir, 1);
    setAnchorDateKey(toDateKey(nextMonthDate));
  };

  const jumpToday = () => {
    setAnchorDateKey(todayKey);
    setSelectedDateKey(todayKey);
  };

  const periodTitle =
    viewMode === 'month'
      ? formatIcelandicMonthYear(anchorYear, anchorMonth)
      : `${formatShortIcelandicDate(weekKeys[0])} – ${formatShortIcelandicDate(weekKeys[6])}`;

  const selectedDayBlend = useMemo(
    () => computeDayEmotionBlend(thoughtRecords, quickMoods, selectedDateKey),
    [thoughtRecords, quickMoods, selectedDateKey],
  );

  const selectedDayThoughts = useMemo(
    () =>
      thoughtRecords
        .filter((r) => r.dateKey === selectedDateKey)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [thoughtRecords, selectedDateKey],
  );

  const selectedDayMoods = useMemo(
    () =>
      quickMoods
        .filter((m) => m.dateKey === selectedDateKey)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [quickMoods, selectedDateKey],
  );

  const selectedDiary = diaryByDate.get(selectedDateKey);

  return (
    <div className="page-shell mx-auto max-w-2xl space-y-5 px-4 pt-5">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">
          Dagatal
        </h1>
        <div className="flex items-center gap-2">
          {selectedDateKey !== todayKey && (
            <button
              type="button"
              onClick={jumpToday}
              className="min-h-[38px] rounded-xl border bg-[var(--bg-surface)] px-3 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--bg-subtle)]"
            >
              Í dag
            </button>
          )}
          <div className="inline-flex rounded-xl border bg-[var(--bg-subtle)] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`min-h-[36px] rounded-lg px-3 text-xs font-semibold transition-colors ${
                viewMode === 'week'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xs'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              Vika
            </button>
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`min-h-[36px] rounded-lg px-3 text-xs font-semibold transition-colors ${
                viewMode === 'month'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xs'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              Mánuður
            </button>
          </div>
        </div>
      </header>

      {/* Calendar Card */}
      <section className="space-y-3 rounded-2xl border bg-[var(--bg-surface)] p-3.5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigatePeriod(-1)}
            aria-label={viewMode === 'week' ? 'Fyrri vika' : 'Fyrri mánuður'}
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-bold text-[var(--text-primary)]">
            {periodTitle}
          </span>
          <button
            type="button"
            onClick={() => navigatePeriod(1)}
            aria-label={viewMode === 'week' ? 'Næsta vika' : 'Næsti mánuður'}
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-[var(--text-secondary)]">
          {ICELANDIC_WEEKDAYS_SHORT.map((day) => (
            <div key={day} className="py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Grid */}
        {viewMode === 'week' ? (
          <div className="grid grid-cols-7 gap-1">
            {weekKeys.map((dk) => {
              const d = parseDateKey(dk);
              const segments = computeDayEmotionBlend(
                thoughtRecords,
                quickMoods,
                dk,
              );
              const hasDiary = diaryByDate.has(dk);
              const isSelected = dk === selectedDateKey;
              return (
                <button
                  key={dk}
                  type="button"
                  onClick={() => setSelectedDateKey(dk)}
                  aria-label={formatIcelandicDate(dk)}
                  aria-pressed={isSelected}
                  className="flex flex-col items-center gap-1 rounded-xl py-1.5 hover:bg-[var(--bg-subtle)]/50"
                >
                  <DayEmotionRing
                    segments={segments}
                    dayNumber={d.getDate()}
                    size={44}
                    selected={isSelected}
                    isToday={dk === todayKey}
                  />
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      hasDiary ? 'bg-[var(--accent)]' : 'bg-transparent'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-y-1">
            {monthCells.map((cell) => {
              const segments = computeDayEmotionBlend(
                thoughtRecords,
                quickMoods,
                cell.dateKey,
              );
              const hasDiary = diaryByDate.has(cell.dateKey);
              const isSelected = cell.dateKey === selectedDateKey;
              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  onClick={() => setSelectedDateKey(cell.dateKey)}
                  aria-label={formatIcelandicDate(cell.dateKey)}
                  aria-pressed={isSelected}
                  className="flex flex-col items-center gap-0.5 rounded-xl py-1 hover:bg-[var(--bg-subtle)]/50"
                >
                  <DayEmotionRing
                    segments={segments}
                    dayNumber={cell.dayNumber}
                    size={40}
                    selected={isSelected}
                    isToday={cell.dateKey === todayKey}
                    muted={!cell.inCurrentMonth}
                  />
                  <span
                    className={`h-1 w-1 rounded-full ${
                      hasDiary ? 'bg-[var(--accent)]' : 'bg-transparent'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* SELECTED DAY VIEW */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-[var(--text-primary)]">
            {formatIcelandicDate(selectedDateKey)}
          </h2>
          <button
            type="button"
            onClick={() => onOpenDiary(selectedDateKey)}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border bg-[var(--bg-surface)] px-3 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--bg-subtle)]"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Opna dagbók</span>
          </button>
        </div>

        {/* Sleep & Mood Side-by-Side */}
        <div className="grid grid-cols-2 gap-3">
          {/* Sleep column */}
          <div className="space-y-2 rounded-2xl border bg-[var(--bg-surface)] p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
              <Moon className="h-3.5 w-3.5 text-[#8173CE]" />
              <span>Svefn</span>
            </div>
            {selectedDiary?.morning &&
            (typeof selectedDiary.morning.sleepHours === 'number' ||
              typeof selectedDiary.morning.sleepQuality === 'number') ? (
              <div className="space-y-1">
                {typeof selectedDiary.morning.sleepHours === 'number' && (
                  <p className="text-lg font-bold tabular-nums text-[var(--text-primary)]">
                    {selectedDiary.morning.sleepHours
                      .toString()
                      .replace('.', ',')}{' '}
                    klst.
                  </p>
                )}
                {typeof selectedDiary.morning.sleepQuality === 'number' && (
                  <p className="text-xs text-[var(--text-secondary)]">
                    Gæði: {selectedDiary.morning.sleepQuality}/5 ·{' '}
                    {DIARY_SCALES[selectedDiary.morning.sleepQuality]}
                  </p>
                )}
                {typeof selectedDiary.morning.energy === 'number' && (
                  <p className="text-xs text-[var(--text-secondary)]">
                    Orka: {selectedDiary.morning.energy}/5 ·{' '}
                    {ENERGY_SCALES[selectedDiary.morning.energy]}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-secondary)]">
                Engin svefnskráning
              </p>
            )}
          </div>

          {/* Mood column */}
          <div className="space-y-2 rounded-2xl border bg-[var(--bg-surface)] p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
              <Smile className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span>Líðan</span>
            </div>

            {selectedDayBlend.length === 0 &&
            typeof selectedDiary?.morning?.mood !== 'number' &&
            typeof selectedDiary?.evening?.mood !== 'number' ? (
              <p className="text-xs text-[var(--text-secondary)]">
                Engin líðan skráð
              </p>
            ) : (
              <div className="space-y-1.5">
                {typeof selectedDiary?.morning?.mood === 'number' && (
                  <p className="text-xs text-[var(--text-primary)]">
                    Morgunn: <strong>{selectedDiary.morning.mood}/5</strong> (
                    {MOOD_SCALES[selectedDiary.morning.mood]})
                  </p>
                )}
                {typeof selectedDiary?.evening?.mood === 'number' && (
                  <p className="text-xs text-[var(--text-primary)]">
                    Kvöld: <strong>{selectedDiary.evening.mood}/5</strong> (
                    {MOOD_SCALES[selectedDiary.evening.mood]})
                  </p>
                )}
                {selectedDayBlend.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {selectedDayBlend.map((seg) => (
                      <span
                        key={seg.coreId}
                        className="inline-flex items-center gap-1 rounded-full border bg-[var(--bg-page)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-primary)]"
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: seg.ringColor }}
                        />
                        <span>{seg.label}</span>
                        <span className="text-[var(--text-secondary)] tabular-nums">
                          {Math.round(seg.ratio * 100)}%
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Thought records on selected day */}
        {selectedDayThoughts.length > 0 && (
          <div className="space-y-2">
            <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Hugsanaskráningar ({selectedDayThoughts.length})
            </h3>
            {selectedDayThoughts.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onOpenThoughtRecord(r.id)}
                className="w-full rounded-2xl border bg-[var(--bg-surface)] p-3.5 text-left transition-colors hover:border-[var(--accent)]"
              >
                <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
                  <span>{formatTimeOfDay(r.createdAt)}</span>
                  <span className="font-medium">
                    {r.status === 'incomplete'
                      ? 'Óklárað'
                      : r.status === 'draft'
                        ? 'Uppkast'
                        : r.reappraisalSkipped
                          ? 'Endurmati sleppt'
                          : 'Lokið'}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-[var(--text-primary)]">
                  {r.situation.description.trim() ||
                    'Engin lýsing á aðstæðum'}
                </p>
                {r.emotions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.emotions.map((em) => {
                      const node = getEmotionById(em.emotionId);
                      return (
                        <span
                          key={em.id}
                          className="inline-flex items-center gap-1 rounded-full border bg-[var(--bg-page)] px-2 py-0.5 text-[11px]"
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{
                              backgroundColor:
                                node?.ringColor ?? 'var(--accent)',
                            }}
                          />
                          <span>{node?.label ?? em.emotionId}</span>
                          <span className="text-[var(--text-secondary)]">
                            {em.intensityBefore}%
                          </span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Quick moods on selected day */}
        {selectedDayMoods.length > 0 && (
          <div className="space-y-2">
            <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Skrá líðan ({selectedDayMoods.length})
            </h3>
            {selectedDayMoods.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onOpenQuickMood(m.id)}
                className="w-full rounded-2xl border bg-[var(--bg-surface)] p-3.5 text-left transition-colors hover:border-[var(--accent)]"
              >
                <div className="text-xs text-[var(--text-secondary)]">
                  {formatTimeOfDay(m.createdAt)}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {m.emotions.map((em) => {
                    const node = getEmotionById(em.emotionId);
                    return (
                      <span
                        key={em.id}
                        className="inline-flex items-center gap-1 rounded-full border bg-[var(--bg-page)] px-2 py-0.5 text-[11px]"
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            backgroundColor:
                              node?.ringColor ?? 'var(--accent)',
                          }}
                        />
                        <span>{node?.label ?? em.emotionId}</span>
                        <span className="text-[var(--text-secondary)]">
                          {em.intensity}%
                        </span>
                      </span>
                    );
                  })}
                </div>
                {m.note.trim() && (
                  <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
                    {m.note}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Diary details */}
        {selectedDiary && (
          <div className="space-y-2 rounded-2xl border bg-[var(--bg-surface)] p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Dagbókarfærsla
              </h3>
              <button
                type="button"
                onClick={() => onOpenDiary(selectedDateKey)}
                className="text-xs font-semibold text-[var(--accent)] hover:underline"
              >
                Breyta
              </button>
            </div>
            {selectedDiary.morning?.gratitude?.trim() && (
              <p className="text-sm text-[var(--text-primary)]">
                <strong className="font-semibold">Þakklæti:</strong>{' '}
                {selectedDiary.morning.gratitude}
              </p>
            )}
            {selectedDiary.evening?.foodAndDrink?.trim() && (
              <p className="text-sm text-[var(--text-primary)]">
                <strong className="font-semibold">Matur og drykkur:</strong>{' '}
                {selectedDiary.evening.foodAndDrink}
              </p>
            )}
            {typeof selectedDiary.evening?.steps === 'number' && (
              <p className="text-sm text-[var(--text-primary)]">
                <strong className="font-semibold">Skref:</strong>{' '}
                {selectedDiary.evening.steps.toLocaleString('is-IS')}
              </p>
            )}
            {selectedDiary.evening?.habits.some((h) => h.answer !== null) && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selectedDiary.evening.habits
                  .filter((h) => h.answer !== null)
                  .map((h) => (
                    <span
                      key={h.habitId}
                      className="rounded-lg border bg-[var(--bg-page)] px-2.5 py-1 text-xs text-[var(--text-primary)]"
                    >
                      {h.label}: <strong>{h.answer ? 'Já' : 'Nei'}</strong>
                    </span>
                  ))}
              </div>
            )}
          </div>
        )}

        {selectedDayThoughts.length === 0 &&
          selectedDayMoods.length === 0 &&
          !selectedDiary && (
            <div className="rounded-2xl border border-dashed bg-[var(--bg-surface)]/60 p-6 text-center text-sm text-[var(--text-secondary)]">
              Engar færslur skráðar þennan dag.
            </div>
          )}
      </section>
    </div>
  );
}
