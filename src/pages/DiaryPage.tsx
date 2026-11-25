import {
  ChevronLeft,
  ChevronRight,
  Footprints,
  Moon,
  Settings2,
  Sun,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScalePicker } from '../components/ui/ScalePicker';
import { DIARY_SCALES, ENERGY_SCALES, MOOD_SCALES } from '../data/defaults';
import { db, ensureSettings, useAppSettings } from '../db/db';
import type { DiaryEntry, DiaryHabitCheck } from '../db/schema';
import {
  formatIcelandicDate,
  shiftDateKey,
  toDateKey,
} from '../domain/dates';

interface DiaryPageProps {
  selectedDateKey: string;
  onChangeDateKey: (dateKey: string) => void;
  onOpenSettings: () => void;
}

function isDiaryEntryEmpty(entry: DiaryEntry): boolean {
  const m = entry.morning;
  const hasMorning =
    m !== undefined &&
    (typeof m.sleepHours === 'number' ||
      typeof m.sleepQuality === 'number' ||
      typeof m.energy === 'number' ||
      typeof m.mood === 'number' ||
      (m.gratitude !== undefined && m.gratitude.trim().length > 0));

  const e = entry.evening;
  const hasEvening =
    e !== undefined &&
    (typeof e.mood === 'number' ||
      (e.foodAndDrink !== undefined && e.foodAndDrink.trim().length > 0) ||
      typeof e.steps === 'number' ||
      e.habits.some((h) => h.answer !== null));

  return !hasMorning && !hasEvening;
}

function formatSleepHours(hours?: number): string {
  if (typeof hours !== 'number') return 'Ekki skráð';
  return `${hours.toString().replace('.', ',')} klst.`;
}

interface DiaryDayEditorProps {
  dateKey: string;
  onOpenSettings: () => void;
}

function DiaryDayEditor({ dateKey, onOpenSettings }: DiaryDayEditorProps) {
  const settings = useAppSettings();

  const [loaded, setLoaded] = useState(false);
  const [entry, setEntry] = useState<DiaryEntry>(() => ({
    dateKey,
    updatedAt: new Date().toISOString(),
  }));
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>(
    'idle',
  );

  const latestRef = useRef<DiaryEntry>(entry);
  const persistedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    ensureSettings().catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    db.diaryEntries.get(dateKey).then((existing) => {
      if (!active) return;
      if (existing) {
        setEntry(existing);
        latestRef.current = existing;
        persistedRef.current = true;
      } else {
        const blank: DiaryEntry = {
          dateKey,
          updatedAt: new Date().toISOString(),
        };
        setEntry(blank);
        latestRef.current = blank;
        persistedRef.current = false;
      }
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [dateKey]);

  const writeEntryNow = useCallback(async (candidate: DiaryEntry) => {
    if (isDiaryEntryEmpty(candidate)) {
      if (persistedRef.current) {
        await db.diaryEntries.delete(candidate.dateKey);
        persistedRef.current = false;
      }
      return;
    }
    setSaveState('saving');
    await db.diaryEntries.put(candidate);
    persistedRef.current = true;
    setSaveState('saved');
  }, []);

  const scheduleSave = useCallback(
    (nextEntry: DiaryEntry, immediate = false) => {
      latestRef.current = nextEntry;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (immediate) {
        void writeEntryNow(nextEntry);
        return;
      }
      setSaveState('saving');
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void writeEntryNow(latestRef.current);
      }, 250);
    },
    [writeEntryNow],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const latest = latestRef.current;
      if (!isDiaryEntryEmpty(latest)) {
        void db.diaryEntries.put(latest);
      }
    };
  }, []);

  const updateEntry = useCallback(
    (updater: (prev: DiaryEntry) => DiaryEntry, immediate = false) => {
      setEntry((prev) => {
        const next: DiaryEntry = {
          ...updater(prev),
          dateKey,
          updatedAt: new Date().toISOString(),
        };
        scheduleSave(next, immediate);
        return next;
      });
    },
    [dateKey, scheduleSave],
  );

  // Combine active habits from settings with any historical answers saved on this day
  const displayHabits = useMemo(() => {
    const existingChecks = entry.evening?.habits ?? [];
    const existingMap = new Map(existingChecks.map((h) => [h.habitId, h]));
    const activeDefs = settings.eveningHabits.filter((h) => h.active);

    const rows: DiaryHabitCheck[] = [];
    const seen = new Set<string>();

    for (const def of activeDefs) {
      const saved = existingMap.get(def.id);
      rows.push({
        habitId: def.id,
        label: def.label,
        answer: saved ? saved.answer : null,
      });
      seen.add(def.id);
    }

    for (const saved of existingChecks) {
      if (!seen.has(saved.habitId) && saved.answer !== null) {
        rows.push(saved);
      }
    }

    return rows;
  }, [settings.eveningHabits, entry.evening?.habits]);

  const setHabitAnswer = (
    habitId: string,
    label: string,
    answer: boolean | null,
  ) => {
    updateEntry((prev) => {
      const prevHabits = prev.evening?.habits ?? [];
      const exists = prevHabits.some((h) => h.habitId === habitId);
      const updatedHabits = exists
        ? prevHabits.map((h) =>
            h.habitId === habitId ? { ...h, label, answer } : h,
          )
        : [...prevHabits, { habitId, label, answer }];
      return {
        ...prev,
        evening: {
          ...prev.evening,
          habits: updatedHabits,
        },
      };
    }, true);
  };

  if (!loaded) {
    return (
      <p className="py-4 text-sm text-[var(--text-secondary)]">
        Hleð dagbók...
      </p>
    );
  }

  const morning = entry.morning ?? {};
  const evening = entry.evening ?? { habits: [] };
  const sleepSliderValue =
    typeof morning.sleepHours === 'number' ? morning.sleepHours : 7.5;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end text-xs">
        {saveState === 'saving' && (
          <span className="text-[var(--text-secondary)]">Vista...</span>
        )}
        {saveState === 'saved' && (
          <span className="text-[var(--accent)]">Vistað sjálfkrafa</span>
        )}
      </div>

      {/* MORGUNN */}
      <section className="space-y-4 rounded-2xl border bg-[var(--bg-surface)] p-4">
        <div className="flex items-center gap-2">
          <Sun className="h-5 w-5 text-[#E59A2E]" />
          <h2 className="text-base font-bold text-[var(--text-primary)]">
            Morgunn
          </h2>
        </div>

        {/* Sleep Hours */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">
              Svefnlengd
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tabular-nums text-[var(--text-primary)]">
                {formatSleepHours(morning.sleepHours)}
              </span>
              {typeof morning.sleepHours === 'number' && (
                <button
                  type="button"
                  onClick={() =>
                    updateEntry(
                      (prev) => ({
                        ...prev,
                        morning: { ...prev.morning, sleepHours: undefined },
                      }),
                      true,
                    )
                  }
                  className="text-xs text-[var(--text-secondary)] underline hover:text-[var(--text-primary)]"
                >
                  Hreinsa
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const base =
                  typeof morning.sleepHours === 'number'
                    ? morning.sleepHours
                    : 7.5;
                const next = Math.max(0, Math.round((base - 0.5) * 2) / 2);
                updateEntry(
                  (prev) => ({
                    ...prev,
                    morning: { ...prev.morning, sleepHours: next },
                  }),
                  true,
                );
              }}
              className="min-h-[40px] rounded-xl border bg-[var(--bg-subtle)] px-3 text-sm font-semibold text-[var(--text-primary)]"
            >
              -0,5
            </button>
            <input
              type="range"
              min={0}
              max={14}
              step={0.5}
              value={sleepSliderValue}
              aria-label="Fjöldi svefntíma"
              onChange={(e) => {
                const val = Number(e.target.value);
                updateEntry((prev) => ({
                  ...prev,
                  morning: { ...prev.morning, sleepHours: val },
                }));
              }}
              onPointerUp={() => void writeEntryNow(latestRef.current)}
              onBlur={() => void writeEntryNow(latestRef.current)}
              className="hampa-slider flex-1"
            />
            <button
              type="button"
              onClick={() => {
                const base =
                  typeof morning.sleepHours === 'number'
                    ? morning.sleepHours
                    : 7;
                const next = Math.min(14, Math.round((base + 0.5) * 2) / 2);
                updateEntry(
                  (prev) => ({
                    ...prev,
                    morning: { ...prev.morning, sleepHours: next },
                  }),
                  true,
                );
              }}
              className="min-h-[40px] rounded-xl border bg-[var(--bg-subtle)] px-3 text-sm font-semibold text-[var(--text-primary)]"
            >
              +0,5
            </button>
          </div>
        </div>

        <ScalePicker
          label="Svefngæði"
          value={morning.sleepQuality}
          labels={DIARY_SCALES}
          onChange={(val) =>
            updateEntry(
              (prev) => ({
                ...prev,
                morning: { ...prev.morning, sleepQuality: val },
              }),
              true,
            )
          }
        />

        <ScalePicker
          label="Orka að morgni"
          value={morning.energy}
          labels={ENERGY_SCALES}
          onChange={(val) =>
            updateEntry(
              (prev) => ({
                ...prev,
                morning: { ...prev.morning, energy: val },
              }),
              true,
            )
          }
        />

        <ScalePicker
          label="Líðan að morgni"
          value={morning.mood}
          labels={MOOD_SCALES}
          onChange={(val) =>
            updateEntry(
              (prev) => ({
                ...prev,
                morning: { ...prev.morning, mood: val },
              }),
              true,
            )
          }
        />

        <div className="space-y-1.5">
          <label
            htmlFor="diary-gratitude"
            className="block text-sm font-medium text-[var(--text-primary)]"
          >
            Þakklæti
          </label>
          <textarea
            id="diary-gratitude"
            rows={2}
            value={morning.gratitude ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              updateEntry((prev) => ({
                ...prev,
                morning: { ...prev.morning, gratitude: val },
              }));
            }}
            placeholder="Eitt lítið eða stórt sem þú ert þakklát(ur) fyrir í dag..."
            className="w-full rounded-xl border bg-[var(--bg-page)] p-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)] focus:outline-none"
          />
        </div>
      </section>

      {/* KVÖLD */}
      <section className="space-y-4 rounded-2xl border bg-[var(--bg-surface)] p-4">
        <div className="flex items-center gap-2">
          <Moon className="h-5 w-5 text-[#8173CE]" />
          <h2 className="text-base font-bold text-[var(--text-primary)]">
            Kvöld
          </h2>
        </div>

        <ScalePicker
          label="Líðan að kvöldi"
          value={evening.mood}
          labels={MOOD_SCALES}
          onChange={(val) =>
            updateEntry(
              (prev) => ({
                ...prev,
                evening: {
                  habits: prev.evening?.habits ?? [],
                  ...prev.evening,
                  mood: val,
                },
              }),
              true,
            )
          }
        />

        <div className="space-y-1.5">
          <label
            htmlFor="diary-food"
            className="block text-sm font-medium text-[var(--text-primary)]"
          >
            Matur og drykkur
          </label>
          <textarea
            id="diary-food"
            rows={2}
            value={evening.foodAndDrink ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              updateEntry((prev) => ({
                ...prev,
                evening: {
                  habits: prev.evening?.habits ?? [],
                  ...prev.evening,
                  foodAndDrink: val,
                },
              }));
            }}
            placeholder="Stutt yfirlit yfir máltíðir, vatn, koffín..."
            className="w-full rounded-xl border bg-[var(--bg-page)] p-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)] focus:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="diary-steps"
            className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)]"
          >
            <Footprints className="h-4 w-4 text-[var(--accent)]" />
            <span>Skref dagsins</span>
          </label>
          <input
            id="diary-steps"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={typeof evening.steps === 'number' ? evening.steps : ''}
            onChange={(e) => {
              const raw = e.target.value.trim();
              const parsed = raw === '' ? undefined : Math.max(0, Math.round(Number(raw)));
              updateEntry((prev) => ({
                ...prev,
                evening: {
                  habits: prev.evening?.habits ?? [],
                  ...prev.evening,
                  steps: Number.isNaN(parsed) ? undefined : parsed,
                },
              }));
            }}
            placeholder="T.d. 6500"
            className="min-h-[44px] w-full rounded-xl border bg-[var(--bg-page)] px-3 text-sm tabular-nums text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)] focus:outline-none"
          />
        </div>

        {/* Custom Evening Habits Checklist */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">
              Kvöldvenjur (Já / Nei)
            </span>
            <button
              type="button"
              onClick={onOpenSettings}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline"
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span>Breyta venjulista</span>
            </button>
          </div>

          {displayHabits.length === 0 ? (
            <p className="rounded-xl border border-dashed p-3 text-xs text-[var(--text-secondary)]">
              Engar venjur skráðar. Þú getur bætt við venjum í Stillingum.
            </p>
          ) : (
            <div className="space-y-2">
              {displayHabits.map((habit) => (
                <div
                  key={habit.habitId}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-[var(--bg-page)] px-3 py-2"
                >
                  <span className="text-sm text-[var(--text-primary)]">
                    {habit.label}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setHabitAnswer(
                          habit.habitId,
                          habit.label,
                          habit.answer === true ? null : true,
                        )
                      }
                      aria-pressed={habit.answer === true}
                      className={`min-h-[36px] min-w-[48px] rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
                        habit.answer === true
                          ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-text)]'
                          : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      Já
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setHabitAnswer(
                          habit.habitId,
                          habit.label,
                          habit.answer === false ? null : false,
                        )
                      }
                      aria-pressed={habit.answer === false}
                      className={`min-h-[36px] min-w-[48px] rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
                        habit.answer === false
                          ? 'border-[var(--text-primary)] bg-[var(--bg-subtle)] text-[var(--text-primary)]'
                          : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      Nei
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function DiaryPage({
  selectedDateKey,
  onChangeDateKey,
  onOpenSettings,
}: DiaryPageProps) {
  const todayKey = toDateKey();
  const isToday = selectedDateKey === todayKey;

  return (
    <div className="page-shell mx-auto max-w-2xl space-y-4 px-4 pt-5">
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">
            Dagbók
          </h1>
          {!isToday && (
            <button
              type="button"
              onClick={() => onChangeDateKey(todayKey)}
              className="rounded-xl border bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--bg-subtle)]"
            >
              Í dag
            </button>
          )}
        </div>

        <div className="flex items-center justify-between rounded-2xl border bg-[var(--bg-surface)] p-1.5">
          <button
            type="button"
            onClick={() => onChangeDateKey(shiftDateKey(selectedDateKey, -1))}
            aria-label="Fyrri dagur"
            className="inline-flex min-h-[42px] min-w-[42px] items-center justify-center rounded-xl text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {formatIcelandicDate(selectedDateKey)}
          </span>
          <button
            type="button"
            onClick={() => onChangeDateKey(shiftDateKey(selectedDateKey, 1))}
            aria-label="Næsti dagur"
            className="inline-flex min-h-[42px] min-w-[42px] items-center justify-center rounded-xl text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </header>

      <DiaryDayEditor
        key={selectedDateKey}
        dateKey={selectedDateKey}
        onOpenSettings={onOpenSettings}
      />
    </div>
  );
}
