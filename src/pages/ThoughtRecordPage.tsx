import {
  ArrowLeft,
  ArrowRight,
  Check,
  HelpCircle,
  Link2,
  Lock,
  Plus,
  SkipForward,
  Tag,
  Trash2,
  Unlink,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmotionWheelPicker } from '../components/wheel/EmotionWheelPicker';
import { DEFAULT_TAGS } from '../data/defaults';
import { COGNITIVE_DISTORTIONS } from '../data/distortions';
import { getEmotionById } from '../data/emotionWheel';
import { GUIDING_PROMPTS } from '../data/prompts';
import {
  db,
  ensureSettings,
  getVisibleTags,
  useAppSettings,
} from '../db/db';
import type { ThoughtRecord } from '../db/schema';
import { formatIcelandicDate, formatTimeOfDay } from '../domain/dates';
import {
  addThought,
  canUnlockColumn4,
  createEmptyThoughtRecord,
  isColumn1Complete,
  isColumn2Complete,
  isColumn3Complete,
  isRecordCompletelyEmpty,
  linkThoughts,
  recalculateStatus,
  removeThought,
  unlinkThought,
} from '../domain/thoughtRecord';

interface ThoughtRecordPageProps {
  recordId: string | null;
  initialColumn?: 1 | 2 | 3 | 4;
  onBack: () => void;
}

export function ThoughtRecordPage({
  recordId,
  initialColumn = 1,
  onBack,
}: ThoughtRecordPageProps) {
  const settings = useAppSettings();

  const [loaded, setLoaded] = useState(recordId === null);
  const [record, setRecord] = useState<ThoughtRecord>(() =>
    createEmptyThoughtRecord(),
  );
  const [activeCol, setActiveCol] = useState<1 | 2 | 3 | 4>(initialColumn);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>(
    'idle',
  );
  const [lockNotice, setLockNotice] = useState<string | null>(null);

  // Column 1 tag helpers
  const [newTagInput, setNewTagInput] = useState('');
  const [editingTags, setEditingTags] = useState(false);

  // Column 3 linking mode
  const [linkMode, setLinkMode] = useState(false);
  const [linkSelection, setLinkSelection] = useState<string[]>([]);

  // Column 4 distortion help toggles
  const [openDistortionHelp, setOpenDistortionHelp] = useState<string | null>(
    null,
  );

  // Confirmations
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);

  const latestRef = useRef<ThoughtRecord>(record);
  const persistedRef = useRef<boolean>(recordId !== null);
  const deletedRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    ensureSettings().catch(() => {});
  }, []);

  useEffect(() => {
    if (!recordId) return;
    let active = true;
    db.thoughtRecords.get(recordId).then((existing) => {
      if (!active) return;
      if (existing) {
        setRecord(existing);
        latestRef.current = existing;
        persistedRef.current = true;
        if (initialColumn === 4 && !canUnlockColumn4(existing)) {
          setActiveCol(1);
        }
      }
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [recordId, initialColumn]);

  const writeRecordNow = useCallback(async (candidate: ThoughtRecord) => {
    if (deletedRef.current) return;
    if (isRecordCompletelyEmpty(candidate)) {
      if (persistedRef.current) {
        await db.thoughtRecords.delete(candidate.id);
        persistedRef.current = false;
      }
      return;
    }
    setSaveState('saving');
    await db.thoughtRecords.put(candidate);
    persistedRef.current = true;
    setSaveState('saved');
  }, []);

  const scheduleAutosave = useCallback(
    (nextRecord: ThoughtRecord, immediate = false) => {
      latestRef.current = nextRecord;
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (immediate) {
        void writeRecordNow(nextRecord);
        return;
      }
      setSaveState('saving');
      debounceTimerRef.current = window.setTimeout(() => {
        debounceTimerRef.current = null;
        void writeRecordNow(latestRef.current);
      }, 250);
    },
    [writeRecordNow],
  );

  // Flush pending autosave on unmount (e.g., tapping bottom navigation)
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      const latest = latestRef.current;
      if (!deletedRef.current && !isRecordCompletelyEmpty(latest)) {
        void db.thoughtRecords.put(latest);
      }
    };
  }, []);

  const updateRecord = useCallback(
    (updater: (prev: ThoughtRecord) => ThoughtRecord, immediate = false) => {
      setRecord((prev) => {
        const draft = updater(prev);
        const withStatus: ThoughtRecord = {
          ...draft,
          updatedAt: new Date().toISOString(),
          status: recalculateStatus(draft),
        };
        scheduleAutosave(withStatus, immediate);
        return withStatus;
      });
    },
    [scheduleAutosave],
  );

  // Seed one ready thought box when opening Column 3 if empty
  useEffect(() => {
    if (loaded && activeCol === 3 && record.thoughts.length === 0) {
      setRecord((prev) => {
        if (prev.thoughts.length > 0) return prev;
        const seeded = addThought(prev, '', 50);
        latestRef.current = seeded;
        return seeded;
      });
    }
  }, [loaded, activeCol, record.thoughts.length]);

  const col1Done = isColumn1Complete(record);
  const col2Done = isColumn2Complete(record);
  const col3Done = isColumn3Complete(record);
  const col4Unlocked = canUnlockColumn4(record);

  const visibleTags = useMemo(() => {
    const base = getVisibleTags(settings);
    const seen = new Set(base.map((t) => t.toLowerCase()));
    const combined = [...base];
    for (const attached of record.situation.tags) {
      if (!seen.has(attached.toLowerCase())) {
        seen.add(attached.toLowerCase());
        combined.push(attached);
      }
    }
    return combined;
  }, [settings, record.situation.tags]);

  const handleColumnClick = (col: 1 | 2 | 3 | 4) => {
    if (col === 4 && !col4Unlocked) {
      const missing: string[] = [];
      if (!col1Done) missing.push('1. Aðstæður');
      if (!col2Done) missing.push('2. Tilfinning');
      if (!col3Done) missing.push('3. Hugsun');
      setLockNotice(
        `Endurmat opnast þegar þú hefur fyllt út: ${missing.join(', ')}.`,
      );
      return;
    }
    setLockNotice(null);
    setActiveCol(col);
  };

  // Column 1 handlers
  const toggleTag = (tag: string) => {
    updateRecord((prev) => {
      const has = prev.situation.tags.includes(tag);
      const tags = has
        ? prev.situation.tags.filter((t) => t !== tag)
        : [...prev.situation.tags, tag];
      return { ...prev, situation: { ...prev.situation, tags } };
    }, true);
  };

  const handleAddCustomTag = async () => {
    const trimmed = newTagInput.trim();
    if (!trimmed) return;
    const currentSettings = await ensureSettings();
    const isDefault = DEFAULT_TAGS.some(
      (d) => d.toLowerCase() === trimmed.toLowerCase(),
    );
    const matchedDefault = DEFAULT_TAGS.find(
      (d) => d.toLowerCase() === trimmed.toLowerCase(),
    );

    if (isDefault && matchedDefault) {
      await db.settings.put({
        ...currentSettings,
        hiddenDefaultTags: currentSettings.hiddenDefaultTags.filter(
          (h) => h !== matchedDefault,
        ),
      });
      if (!record.situation.tags.includes(matchedDefault)) {
        toggleTag(matchedDefault);
      }
    } else {
      const existsCustom = currentSettings.customTags.some(
        (c) => c.toLowerCase() === trimmed.toLowerCase(),
      );
      if (!existsCustom) {
        await db.settings.put({
          ...currentSettings,
          customTags: [...currentSettings.customTags, trimmed],
        });
      }
      if (!record.situation.tags.includes(trimmed)) {
        toggleTag(trimmed);
      }
    }
    setNewTagInput('');
  };

  const handleHideOrDeleteTag = async (tag: string) => {
    const currentSettings = await ensureSettings();
    const isDefault = DEFAULT_TAGS.includes(tag);
    if (isDefault) {
      if (!currentSettings.hiddenDefaultTags.includes(tag)) {
        await db.settings.put({
          ...currentSettings,
          hiddenDefaultTags: [...currentSettings.hiddenDefaultTags, tag],
        });
      }
    } else {
      await db.settings.put({
        ...currentSettings,
        customTags: currentSettings.customTags.filter((t) => t !== tag),
      });
    }
  };

  // Column 2 handlers
  const handleToggleEmotion = (emotionId: string) => {
    updateRecord((prev) => {
      const existing = prev.emotions.find((e) => e.emotionId === emotionId);
      if (existing) {
        return {
          ...prev,
          emotions: prev.emotions.filter((e) => e.id !== existing.id),
          thoughts: prev.thoughts.map((t) =>
            t.linkedEmotionId === existing.id
              ? { ...t, linkedEmotionId: undefined }
              : t,
          ),
        };
      }
      const newEntry = {
        id: crypto.randomUUID ? crypto.randomUUID() : `em-${Date.now()}`,
        emotionId,
        intensityBefore: 50,
      };
      return { ...prev, emotions: [...prev.emotions, newEntry] };
    }, true);
  };

  const handleRemoveEmotionEntry = (entryId: string) => {
    updateRecord((prev) => ({
      ...prev,
      emotions: prev.emotions.filter((e) => e.id !== entryId),
      thoughts: prev.thoughts.map((t) =>
        t.linkedEmotionId === entryId
          ? { ...t, linkedEmotionId: undefined }
          : t,
      ),
    }), true);
  };

  const handleChangeEmotionIntensityBefore = (
    entryId: string,
    intensity: number,
  ) => {
    updateRecord((prev) => ({
      ...prev,
      emotions: prev.emotions.map((e) =>
        e.id === entryId ? { ...e, intensityBefore: intensity } : e,
      ),
    }));
  };

  // Column 3 handlers
  const handleConfirmLink = () => {
    if (linkSelection.length < 2) return;
    updateRecord((prev) => linkThoughts(prev, linkSelection), true);
    setLinkSelection([]);
    setLinkMode(false);
  };

  // Column 4 handlers & completion
  const handleFinishRecord = async (skipped: boolean) => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const completed: ThoughtRecord = {
      ...latestRef.current,
      updatedAt: new Date().toISOString(),
      status: 'completed',
      reappraisalSkipped: skipped,
    };
    latestRef.current = completed;
    await db.thoughtRecords.put(completed);
    persistedRef.current = true;
    onBack();
  };

  const handleDeleteRecord = async () => {
    deletedRef.current = true;
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (persistedRef.current) {
      await db.thoughtRecords.delete(record.id);
    }
    onBack();
  };

  if (!loaded) {
    return (
      <div className="page-shell mx-auto max-w-2xl px-4 pt-6 text-sm text-[var(--text-secondary)]">
        Hleð hugsanaskráningu...
      </div>
    );
  }

  const activeThoughtGroups = record.thoughtGroups.filter((group) =>
    record.thoughts.some(
      (t) => t.groupId === group.id && t.text.trim().length > 0,
    ),
  );

  return (
    <div className="page-shell mx-auto max-w-2xl space-y-4 px-4 pt-4">
      {/* Top Bar */}
      <header className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={async () => {
            await writeRecordNow(latestRef.current);
            onBack();
          }}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border bg-[var(--bg-surface)] px-3 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Heim</span>
        </button>

        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-sm font-bold text-[var(--text-primary)]">
              Hugsanaskráning
            </span>
            {saveState === 'saving' && (
              <span className="text-[11px] text-[var(--text-secondary)]">
                · Vista...
              </span>
            )}
            {saveState === 'saved' && (
              <span className="text-[11px] text-[var(--accent)]">
                · Vistað
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--text-secondary)]">
            {formatIcelandicDate(record.dateKey)} ·{' '}
            {formatTimeOfDay(record.createdAt)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          aria-label="Eyða skráningu"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </header>

      {/* 4-Column Stepper */}
      <div
        role="tablist"
        aria-label="Dálkar hugsanaskráningar"
        className="grid grid-cols-4 gap-1.5"
      >
        {(
          [
            { col: 1, label: 'Aðstæður', done: col1Done, locked: false },
            { col: 2, label: 'Tilfinning', done: col2Done, locked: false },
            { col: 3, label: 'Hugsun', done: col3Done, locked: false },
            {
              col: 4,
              label: 'Endurmat',
              done: record.status === 'completed' && !record.reappraisalSkipped,
              locked: !col4Unlocked,
            },
          ] as const
        ).map(({ col, label, done, locked }) => {
          const isActive = activeCol === col;
          return (
            <button
              key={col}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleColumnClick(col)}
              className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl border px-1.5 py-1.5 text-center transition-all ${
                isActive
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text-primary)] shadow-2xs'
                  : locked
                    ? 'bg-[var(--bg-subtle)]/50 text-[var(--text-secondary)] opacity-75'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span className="flex items-center gap-1 text-xs font-bold">
                <span>{col}.</span>
                {locked ? (
                  <Lock className="h-3 w-3" />
                ) : done ? (
                  <Check className="h-3.5 w-3.5 text-[var(--accent)]" />
                ) : null}
              </span>
              <span className="truncate text-[11px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>

      {lockNotice && (
        <div
          className="flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium"
          style={{
            backgroundColor: 'var(--warning-bg)',
            borderColor: 'var(--warning-border)',
            color: 'var(--warning-text)',
          }}
        >
          <span>{lockNotice}</span>
          <button
            type="button"
            onClick={() => setLockNotice(null)}
            aria-label="Loka"
            className="p-0.5"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* COLUMN 1: AÐSTÆÐUR */}
      {activeCol === 1 && (
        <section className="space-y-4">
          <div className="space-y-2 rounded-2xl border bg-[var(--bg-surface)] p-4">
            <label
              htmlFor="situation-desc"
              className="block text-base font-bold text-[var(--text-primary)]"
            >
              1. Aðstæður <span className="text-xs font-normal text-[var(--text-secondary)]">(skylda)</span>
            </label>
            <p className="text-xs text-[var(--text-secondary)]">
              Hvað gerðist, hvar varst þú og með hverjum?
            </p>
            <textarea
              id="situation-desc"
              rows={4}
              value={record.situation.description}
              onChange={(e) => {
                const value = e.target.value;
                updateRecord((prev) => ({
                  ...prev,
                  situation: { ...prev.situation, description: value },
                }));
              }}
              placeholder="Lýstu aðstæðunum í stuttu máli..."
              className="w-full rounded-xl border bg-[var(--bg-page)] p-3 text-sm leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          <div className="space-y-3 rounded-2xl border bg-[var(--bg-surface)] p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Tag className="h-4 w-4 text-[var(--accent)]" />
                <h2 className="text-sm font-bold text-[var(--text-primary)]">
                  Merki (valfrjálst)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingTags((v) => !v)}
                className="text-xs font-medium text-[var(--accent)] hover:underline"
              >
                {editingTags ? 'Loka breytingum' : 'Eyða merkjum'}
              </button>
            </div>

            {editingTags && (
              <p className="text-xs text-[var(--text-secondary)]">
                Pikkaðu á × til að fela eða eyða merki. Gamlar skráningar halda
                merkinu áfram.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {visibleTags.map((tag) => {
                const selected = record.situation.tags.includes(tag);
                const isHiddenDefault =
                  settings.hiddenDefaultTags.includes(tag);
                return (
                  <div key={tag} className="inline-flex items-center">
                    <button
                      type="button"
                      onClick={() => toggleTag(tag)}
                      aria-pressed={selected}
                      className={`inline-flex min-h-[40px] items-center gap-1.5 border px-3 text-sm font-medium transition-all ${
                        editingTags ? 'rounded-l-xl' : 'rounded-xl'
                      } ${
                        selected
                          ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-text)]'
                          : 'bg-[var(--bg-page)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
                      }`}
                    >
                      <span>{tag}</span>
                      {isHiddenDefault && (
                        <span className="text-[10px] opacity-75">(falið)</span>
                      )}
                    </button>
                    {editingTags && !isHiddenDefault && (
                      <button
                        type="button"
                        onClick={() => handleHideOrDeleteTag(tag)}
                        aria-label={`Fela eða eyða merkinu ${tag}`}
                        className="inline-flex min-h-[40px] items-center rounded-r-xl border border-l-0 bg-[var(--danger-soft)] px-2 text-[var(--danger)] hover:opacity-85"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleAddCustomTag();
                  }
                }}
                placeholder="Nýtt merki (t.d. Kaffihús, Próf)..."
                className="min-h-[42px] flex-1 rounded-xl border bg-[var(--bg-page)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddCustomTag}
                className="inline-flex min-h-[42px] items-center gap-1 rounded-xl border bg-[var(--bg-subtle)] px-3.5 text-sm font-medium text-[var(--text-primary)] hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                <span>Bæta við</span>
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setActiveCol(2)}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-text)] hover:bg-[var(--accent-hover)]"
            >
              <span>Áfram í 2. Tilfinning</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* COLUMN 2: TILFINNING */}
      {activeCol === 2 && (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              2. Tilfinningar
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Veldu eina eða fleiri tilfinningar og stilltu styrk á skalanum
              0–100%.
            </p>
          </div>

          <EmotionWheelPicker
            selected={record.emotions.map((e) => ({
              id: e.id,
              emotionId: e.emotionId,
              intensity: e.intensityBefore,
            }))}
            onToggleEmotion={handleToggleEmotion}
            onRemoveEntry={handleRemoveEmotionEntry}
            onChangeIntensity={handleChangeEmotionIntensityBefore}
            onCommitIntensity={() => void writeRecordNow(latestRef.current)}
          />

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => setActiveCol(1)}
              className="inline-flex min-h-[48px] items-center gap-1.5 rounded-2xl border bg-[var(--bg-surface)] px-4 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Aðstæður</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCol(3)}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-text)] hover:bg-[var(--accent-hover)]"
            >
              <span>Áfram í 3. Hugsun</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* COLUMN 3: HUGSUN */}
      {activeCol === 3 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                3. Sjálfvirkar hugsanir
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Hvað fór í gegnum hugann og hversu mikið trúir þú því (0–100%)?
              </p>
            </div>

            {record.thoughts.length >= 2 && (
              <button
                type="button"
                onClick={() => {
                  setLinkMode((v) => !v);
                  setLinkSelection([]);
                }}
                className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors ${
                  linkMode
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
                }`}
              >
                <Link2 className="h-3.5 w-3.5" />
                <span>
                  {linkMode ? 'Hætta við tengingu' : 'Tengja hugsanir saman'}
                </span>
              </button>
            )}
          </div>

          {linkMode && (
            <div className="space-y-2.5 rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)]/50 p-3.5">
              <p className="text-xs font-medium text-[var(--text-primary)]">
                Veldu 2 eða fleiri hugsanir hér að neðan sem tilheyra sömu
                grunnhugsuninni — þá eru þær metnar saman með einni trú og einu
                endurmati.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={linkSelection.length < 2}
                  onClick={handleConfirmLink}
                  className="min-h-[38px] rounded-xl bg-[var(--accent)] px-3.5 text-xs font-semibold text-[var(--accent-text)] disabled:opacity-45"
                >
                  Tengja valdar ({linkSelection.length})
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {record.thoughtGroups.map((group) => {
              const groupThoughts = record.thoughts.filter(
                (t) => t.groupId === group.id,
              );
              if (groupThoughts.length === 0) return null;
              const isMergedGroup = groupThoughts.length > 1;

              return (
                <div
                  key={group.id}
                  className="space-y-3 rounded-2xl border bg-[var(--bg-surface)] p-4"
                >
                  {isMergedGroup && (
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--accent)]">
                      <Link2 className="h-3 w-3" />
                      <span>
                        Tengdar hugsanir ({groupThoughts.length} saman)
                      </span>
                    </div>
                  )}

                  <div className="space-y-3">
                    {groupThoughts.map((thought) => {
                      const isCheckedForLink = linkSelection.includes(
                        thought.id,
                      );
                      return (
                        <div
                          key={thought.id}
                          className={`space-y-2 rounded-xl border bg-[var(--bg-page)] p-3 ${
                            isCheckedForLink ? 'ring-2 ring-[var(--accent)]' : ''
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {linkMode && (
                              <input
                                type="checkbox"
                                checked={isCheckedForLink}
                                onChange={(e) => {
                                  setLinkSelection((prev) =>
                                    e.target.checked
                                      ? [...prev, thought.id]
                                      : prev.filter((id) => id !== thought.id),
                                  );
                                }}
                                aria-label="Velja hugsun til að tengja"
                                className="mt-2 h-5 w-5 accent-[var(--accent)]"
                              />
                            )}
                            <textarea
                              rows={2}
                              value={thought.text}
                              onChange={(e) => {
                                const text = e.target.value;
                                updateRecord((prev) => ({
                                  ...prev,
                                  thoughts: prev.thoughts.map((t) =>
                                    t.id === thought.id ? { ...t, text } : t,
                                  ),
                                }));
                              }}
                              placeholder="T.d. „Ég næ aldrei að klára þetta í tæka tíð“..."
                              className="w-full rounded-lg border bg-[var(--bg-surface)] p-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)] focus:outline-none"
                            />
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2">
                            {record.emotions.length > 0 ? (
                              <div className="flex items-center gap-1.5">
                                <label
                                  htmlFor={`em-link-${thought.id}`}
                                  className="text-[11px] text-[var(--text-secondary)]"
                                >
                                  Tengd tilfinning:
                                </label>
                                <select
                                  id={`em-link-${thought.id}`}
                                  value={thought.linkedEmotionId ?? ''}
                                  onChange={(e) => {
                                    const val = e.target.value || undefined;
                                    updateRecord((prev) => ({
                                      ...prev,
                                      thoughts: prev.thoughts.map((t) =>
                                        t.id === thought.id
                                          ? { ...t, linkedEmotionId: val }
                                          : t,
                                      ),
                                    }), true);
                                  }}
                                  className="min-h-[34px] rounded-lg border bg-[var(--bg-surface)] px-2 text-xs text-[var(--text-primary)]"
                                >
                                  <option value="">Engin valin</option>
                                  {record.emotions.map((em) => {
                                    const node = getEmotionById(em.emotionId);
                                    return (
                                      <option key={em.id} value={em.id}>
                                        {node?.label ?? em.emotionId} (
                                        {em.intensityBefore}%)
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>
                            ) : (
                              <span />
                            )}

                            <div className="flex items-center gap-1.5">
                              {isMergedGroup && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateRecord(
                                      (prev) => unlinkThought(prev, thought.id),
                                      true,
                                    )
                                  }
                                  className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border bg-[var(--bg-surface)] px-2.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                >
                                  <Unlink className="h-3.5 w-3.5" />
                                  <span>Aftengja</span>
                                </button>
                              )}
                              {record.thoughts.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateRecord(
                                      (prev) => removeThought(prev, thought.id),
                                      true,
                                    )
                                  }
                                  aria-label="Eyða hugsun"
                                  className="inline-flex min-h-[34px] items-center gap-1 rounded-lg p-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Shared belief slider for group */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[var(--text-primary)]">
                        Hversu mikið trúir þú þessu? (fyrir endurmat)
                      </span>
                      <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-0.5 text-xs font-bold tabular-nums text-[var(--text-primary)]">
                        {group.beliefBefore}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-[var(--text-secondary)]">
                        0%
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={group.beliefBefore}
                        aria-label="Trú á hugsun fyrir endurmat"
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          updateRecord((prev) => ({
                            ...prev,
                            thoughtGroups: prev.thoughtGroups.map((g) =>
                              g.id === group.id
                                ? { ...g, beliefBefore: val }
                                : g,
                            ),
                          }));
                        }}
                        onPointerUp={() =>
                          void writeRecordNow(latestRef.current)
                        }
                        onBlur={() => void writeRecordNow(latestRef.current)}
                        className="hampa-slider flex-1"
                      />
                      <span className="text-[11px] text-[var(--text-secondary)]">
                        100%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() =>
              updateRecord((prev) => addThought(prev, '', 50), true)
            }
            className="flex min-h-[46px] w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed bg-[var(--bg-surface)] px-4 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--bg-subtle)]"
          >
            <Plus className="h-4 w-4" />
            <span>Bæta við annarri hugsun</span>
          </button>

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => setActiveCol(2)}
              className="inline-flex min-h-[48px] items-center gap-1.5 rounded-2xl border bg-[var(--bg-surface)] px-4 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Tilfinning</span>
            </button>
            <button
              type="button"
              onClick={() => handleColumnClick(4)}
              className={`inline-flex min-h-[48px] items-center gap-2 rounded-2xl px-5 text-sm font-semibold transition-colors ${
                col4Unlocked
                  ? 'bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)]'
                  : 'border bg-[var(--bg-subtle)] text-[var(--text-secondary)]'
              }`}
            >
              {!col4Unlocked && <Lock className="h-4 w-4" />}
              <span>Áfram í 4. Endurmat</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* COLUMN 4: ENDURMAT */}
      {activeCol === 4 && (
        <section className="space-y-5">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              4. Endurmat
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Skoðaðu hverja hugsun með mildum, gagnrýnum augum og mettu trú og
              tilfinningar upp á nýtt.
            </p>
          </div>

          {activeThoughtGroups.map((group, idx) => {
            const groupThoughts = record.thoughts.filter(
              (t) => t.groupId === group.id && t.text.trim().length > 0,
            );
            const sliderBeliefAfter = group.beliefAfter ?? group.beliefBefore;
            const beliefDelta =
              typeof group.beliefAfter === 'number'
                ? group.beliefAfter - group.beliefBefore
                : null;

            return (
              <div
                key={group.id}
                className="space-y-4 rounded-2xl border bg-[var(--bg-surface)] p-4"
              >
                {/* Thought header */}
                <div className="space-y-1.5 rounded-xl bg-[var(--bg-page)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      {groupThoughts.length > 1
                        ? `Tengdar hugsanir (${idx + 1})`
                        : `Hugsun ${idx + 1}`}
                    </span>
                    <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-0.5 text-xs font-semibold text-[var(--text-primary)] tabular-nums">
                      Trú fyrir: {group.beliefBefore}%
                    </span>
                  </div>
                  {groupThoughts.map((t) => (
                    <p
                      key={t.id}
                      className="text-sm font-medium text-[var(--text-primary)]"
                    >
                      „{t.text}“
                    </p>
                  ))}
                </div>

                {/* Distortions */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    Hugsanavillur (valfrjálst)
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {COGNITIVE_DISTORTIONS.map((d) => {
                      const active = group.distortionIds.includes(d.id);
                      const helpOpen = openDistortionHelp === `${group.id}:${d.id}`;
                      return (
                        <div key={d.id} className="inline-flex items-center">
                          <button
                            type="button"
                            onClick={() => {
                              updateRecord((prev) => ({
                                ...prev,
                                thoughtGroups: prev.thoughtGroups.map((g) => {
                                  if (g.id !== group.id) return g;
                                  const has = g.distortionIds.includes(d.id);
                                  return {
                                    ...g,
                                    distortionIds: has
                                      ? g.distortionIds.filter((x) => x !== d.id)
                                      : [...g.distortionIds, d.id],
                                  };
                                }),
                              }), true);
                            }}
                            aria-pressed={active}
                            className={`min-h-[38px] rounded-l-xl border px-3 text-xs font-medium transition-colors ${
                              active
                                ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-text)]'
                                : 'bg-[var(--bg-page)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
                            }`}
                          >
                            {d.name}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setOpenDistortionHelp(
                                helpOpen ? null : `${group.id}:${d.id}`,
                              )
                            }
                            aria-label={`Útskýring á ${d.name}`}
                            className={`inline-flex min-h-[38px] items-center rounded-r-xl border border-l-0 px-2 ${
                              helpOpen
                                ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                                : 'bg-[var(--bg-page)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {openDistortionHelp?.startsWith(`${group.id}:`) && (() => {
                    const distId = openDistortionHelp.slice(
                      group.id.length + 1,
                    );
                    const def = COGNITIVE_DISTORTIONS.find(
                      (x) => x.id === distId,
                    );
                    if (!def) return null;
                    return (
                      <div className="rounded-xl border bg-[var(--bg-page)] p-3 text-xs leading-relaxed">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-[var(--text-primary)]">
                            {def.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => setOpenDistortionHelp(null)}
                            aria-label="Loka útskýringu"
                            className="text-[var(--text-secondary)]"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="mt-1 text-[var(--text-primary)]">
                          {def.shortDescription}
                        </p>
                        <p className="mt-1 italic text-[var(--text-secondary)]">
                          Dæmi: {def.example}
                        </p>
                      </div>
                    );
                  })()}
                </div>

                {/* Guiding Questions */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    Leiðandi spurningar (svaraðu því sem á við)
                  </h3>
                  {GUIDING_PROMPTS.map((p) => {
                    const value = group.promptAnswers[p.id] ?? '';
                    return (
                      <div key={p.id} className="space-y-1">
                        <label
                          htmlFor={`prompt-${group.id}-${p.id}`}
                          className="block text-xs font-medium leading-snug text-[var(--text-secondary)]"
                        >
                          {p.question}
                        </label>
                        <textarea
                          id={`prompt-${group.id}-${p.id}`}
                          rows={value.trim() ? 3 : 2}
                          value={value}
                          onChange={(e) => {
                            const ans = e.target.value;
                            updateRecord((prev) => ({
                              ...prev,
                              thoughtGroups: prev.thoughtGroups.map((g) =>
                                g.id === group.id
                                  ? {
                                      ...g,
                                      promptAnswers: {
                                        ...g.promptAnswers,
                                        [p.id]: ans,
                                      },
                                    }
                                  : g,
                              ),
                            }));
                          }}
                          placeholder={p.placeholder}
                          className="w-full rounded-xl border bg-[var(--bg-page)] p-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)] focus:outline-none"
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Balanced Thought */}
                <div className="space-y-1.5">
                  <label
                    htmlFor={`balanced-${group.id}`}
                    className="block text-sm font-semibold text-[var(--text-primary)]"
                  >
                    Ný, jafnvægari hugsun
                  </label>
                  <textarea
                    id={`balanced-${group.id}`}
                    rows={3}
                    value={group.balancedThought}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateRecord((prev) => ({
                        ...prev,
                        thoughtGroups: prev.thoughtGroups.map((g) =>
                          g.id === group.id
                            ? { ...g, balancedThought: val }
                            : g,
                        ),
                      }));
                    }}
                    placeholder="Skrifaðu raunsærri og mildari hugsun út frá því sem þú skoðaðir..."
                    className="w-full rounded-xl border bg-[var(--bg-page)] p-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>

                {/* Belief After Reappraisal */}
                <div className="space-y-2 rounded-xl border bg-[var(--bg-page)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                      Trú á upprunalegu hugsunina eftir endurmat
                    </span>
                    <div className="flex items-center gap-1.5 text-xs font-bold tabular-nums">
                      <span className="text-[var(--text-secondary)]">
                        {group.beliefBefore}% →
                      </span>
                      <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[var(--accent)]">
                        {typeof group.beliefAfter === 'number'
                          ? `${group.beliefAfter}%`
                          : 'Ekki metið'}
                      </span>
                      {beliefDelta !== null && beliefDelta !== 0 && (
                        <span
                          className={
                            beliefDelta < 0
                              ? 'text-[var(--accent)]'
                              : 'text-[var(--text-secondary)]'
                          }
                        >
                          ({beliefDelta > 0 ? `+${beliefDelta}` : beliefDelta}%)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      0%
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={sliderBeliefAfter}
                      aria-label="Trú á upprunalegu hugsunina eftir endurmat"
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        updateRecord((prev) => ({
                          ...prev,
                          thoughtGroups: prev.thoughtGroups.map((g) =>
                            g.id === group.id ? { ...g, beliefAfter: val } : g,
                          ),
                        }));
                      }}
                      onPointerUp={() => void writeRecordNow(latestRef.current)}
                      onBlur={() => void writeRecordNow(latestRef.current)}
                      className="hampa-slider flex-1"
                    />
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      100%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Re-rate Emotions */}
          <div className="space-y-3 rounded-2xl border bg-[var(--bg-surface)] p-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              Endurmeta styrk tilfinninganna
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Hversu sterkar eru tilfinningarnar núna eftir endurmatið?
            </p>
            <div className="space-y-3">
              {record.emotions.map((em) => {
                const node = getEmotionById(em.emotionId);
                const label = node?.label ?? em.emotionId;
                const sliderVal = em.intensityAfter ?? em.intensityBefore;
                const delta =
                  typeof em.intensityAfter === 'number'
                    ? em.intensityAfter - em.intensityBefore
                    : null;

                return (
                  <div
                    key={em.id}
                    className="space-y-2 rounded-xl border bg-[var(--bg-page)] p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{
                            backgroundColor: node?.ringColor ?? 'var(--accent)',
                          }}
                        />
                        <span className="text-sm font-semibold text-[var(--text-primary)]">
                          {label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-bold tabular-nums">
                        <span className="text-[var(--text-secondary)]">
                          {em.intensityBefore}% →
                        </span>
                        <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[var(--accent)]">
                          {typeof em.intensityAfter === 'number'
                            ? `${em.intensityAfter}%`
                            : 'Ekki metið'}
                        </span>
                        {delta !== null && delta !== 0 && (
                          <span
                            className={
                              delta < 0
                                ? 'text-[var(--accent)]'
                                : 'text-[var(--text-secondary)]'
                            }
                          >
                            ({delta > 0 ? `+${delta}` : delta}%)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-[var(--text-secondary)]">
                        0%
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={sliderVal}
                        aria-label={`Styrkur eftir endurmat fyrir ${label}`}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          updateRecord((prev) => ({
                            ...prev,
                            emotions: prev.emotions.map((x) =>
                              x.id === em.id ? { ...x, intensityAfter: val } : x,
                            ),
                          }));
                        }}
                        onPointerUp={() =>
                          void writeRecordNow(latestRef.current)
                        }
                        onBlur={() => void writeRecordNow(latestRef.current)}
                        className="hampa-slider flex-1"
                      />
                      <span className="text-[11px] text-[var(--text-secondary)]">
                        100%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Completion Actions */}
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={() => void handleFinishRecord(false)}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-text)] shadow-sm hover:bg-[var(--accent-hover)]"
            >
              <Check className="h-5 w-5" />
              <span>Ljúka skráningu</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSkipConfirm(true)}
              className="flex min-h-[46px] w-full items-center justify-center gap-1.5 rounded-2xl border bg-[var(--bg-surface)] px-4 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
            >
              <SkipForward className="h-4 w-4" />
              <span>Sleppa endurmati</span>
            </button>
          </div>
        </section>
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Eyða hugsanaskráningu?"
        description="Ertu viss um að þú viljir eyða þessari skráningu? Þessu er ekki hægt að afturkalla."
        confirmLabel="Eyða"
        danger
        onConfirm={handleDeleteRecord}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <ConfirmDialog
        open={showSkipConfirm}
        title="Sleppa endurmati?"
        description="Skráningin verður merkt sem lokið („endurmati sleppt“) og þú getur alltaf opnað hana aftur seinna."
        confirmLabel="Sleppa endurmati"
        onConfirm={() => {
          setShowSkipConfirm(false);
          void handleFinishRecord(true);
        }}
        onCancel={() => setShowSkipConfirm(false)}
      />
    </div>
  );
}
