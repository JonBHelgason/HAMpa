import { ArrowLeft, Check, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmotionWheelPicker } from '../components/wheel/EmotionWheelPicker';
import { db } from '../db/db';
import type { QuickMoodEntry } from '../db/schema';
import { formatIcelandicDate, formatTimeOfDay, toDateKey } from '../domain/dates';
import { createId } from '../domain/thoughtRecord';

interface QuickMoodPageProps {
  entryId: string | null;
  onBack: () => void;
}

export function QuickMoodPage({ entryId, onBack }: QuickMoodPageProps) {
  const [loaded, setLoaded] = useState(entryId === null);
  const [entry, setEntry] = useState<QuickMoodEntry>(() => {
    const now = new Date();
    const iso = now.toISOString();
    return {
      id: createId(),
      dateKey: toDateKey(now),
      createdAt: iso,
      updatedAt: iso,
      emotions: [],
      note: '',
    };
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!entryId) return;
    let active = true;
    db.quickMoods.get(entryId).then((existing) => {
      if (!active) return;
      if (existing) {
        setEntry(existing);
      }
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [entryId]);

  const handleToggleEmotion = (emotionId: string) => {
    setErrorMsg(null);
    setEntry((prev) => {
      const exists = prev.emotions.find((e) => e.emotionId === emotionId);
      const emotions = exists
        ? prev.emotions.filter((e) => e.emotionId !== emotionId)
        : [...prev.emotions, { id: createId(), emotionId, intensity: 50 }];
      return { ...prev, emotions, updatedAt: new Date().toISOString() };
    });
  };

  const handleRemoveEmotion = (id: string) => {
    setEntry((prev) => ({
      ...prev,
      emotions: prev.emotions.filter((e) => e.id !== id),
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleChangeIntensity = (id: string, intensity: number) => {
    setEntry((prev) => ({
      ...prev,
      emotions: prev.emotions.map((e) =>
        e.id === id ? { ...e, intensity } : e,
      ),
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleSave = async () => {
    if (entry.emotions.length === 0) {
      setErrorMsg('Veldu að minnsta kosti eina tilfinningu áður en þú vistar.');
      return;
    }
    const updated: QuickMoodEntry = {
      ...entry,
      updatedAt: new Date().toISOString(),
    };
    await db.quickMoods.put(updated);
    onBack();
  };

  const handleDelete = async () => {
    if (entryId) {
      await db.quickMoods.delete(entryId);
    }
    onBack();
  };

  if (!loaded) {
    return (
      <div className="page-shell mx-auto max-w-2xl px-4 pt-6 text-sm text-[var(--text-secondary)]">
        Hleð líðanarskráningu...
      </div>
    );
  }

  return (
    <div className="page-shell mx-auto max-w-2xl space-y-5 px-4 pt-4">
      {/* Header */}
      <header className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border bg-[var(--bg-surface)] px-3 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Til baka</span>
        </button>

        <div className="text-center">
          <h1 className="text-base font-bold text-[var(--text-primary)]">
            Skrá líðan
          </h1>
          <p className="text-[11px] text-[var(--text-secondary)]">
            {formatIcelandicDate(entry.dateKey)} ·{' '}
            {formatTimeOfDay(entry.createdAt)}
          </p>
        </div>

        {entryId ? (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            aria-label="Eyða líðan"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : (
          <div className="w-[44px]" />
        )}
      </header>

      <p className="text-sm text-[var(--text-secondary)]">
        Fljótleg skráning á líðan þinni núna. Birtist í dagatalinu en krefst
        ekki endurmats.
      </p>

      <EmotionWheelPicker
        selected={entry.emotions}
        onToggleEmotion={handleToggleEmotion}
        onRemoveEntry={handleRemoveEmotion}
        onChangeIntensity={handleChangeIntensity}
      />

      {/* Optional short note */}
      <div className="space-y-1.5 rounded-2xl border bg-[var(--bg-surface)] p-4">
        <label
          htmlFor="quick-mood-note"
          className="block text-sm font-semibold text-[var(--text-primary)]"
        >
          Stutt athugasemd (valfrjálst)
        </label>
        <textarea
          id="quick-mood-note"
          rows={3}
          value={entry.note}
          onChange={(e) =>
            setEntry((prev) => ({
              ...prev,
              note: e.target.value,
              updatedAt: new Date().toISOString(),
            }))
          }
          placeholder="T.d. hvað var í gangi rétt áður..."
          className="w-full rounded-xl border bg-[var(--bg-page)] p-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)] focus:outline-none"
        />
      </div>

      {errorMsg && (
        <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-4 py-2.5 text-sm font-medium text-[var(--danger)]">
          {errorMsg}
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent-text)] shadow-sm hover:bg-[var(--accent-hover)]"
      >
        <Check className="h-5 w-5" />
        <span>Vista líðan</span>
      </button>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Eyða líðanarskráningu?"
        description="Ertu viss um að þú viljir eyða þessari skráningu?"
        confirmLabel="Eyða"
        danger
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
