import {
  ArrowLeft,
  Check,
  Download,
  Monitor,
  Moon,
  Plus,
  RotateCcw,
  Sun,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DEFAULT_TAGS } from '../data/defaults';
import {
  downloadBackupFile,
  exportBackup,
  parseAndValidateBackup,
  restoreBackup,
  type BackupSummary,
} from '../db/backup';
import {
  db,
  ensureSettings,
  getVisibleTags,
  useAppSettings,
} from '../db/db';
import type { HampaBackupV1, ThemePreference } from '../db/schema';
import { formatIcelandicDate, toDateKey } from '../domain/dates';
import { applyTheme } from '../domain/theme';
import { createId } from '../domain/thoughtRecord';

interface SettingsPageProps {
  onBack: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const settings = useAppSettings();

  const [newTag, setNewTag] = useState('');
  const [newHabit, setNewHabit] = useState('');
  const [statusMessage, setStatusMessage] = useState<{
    type: 'ok' | 'error';
    text: string;
  } | null>(null);

  const [pendingRestore, setPendingRestore] = useState<{
    backup: HampaBackupV1;
    summary: BackupSummary;
  } | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    ensureSettings().catch(() => {});
  }, []);

  const handleThemeChange = async (theme: ThemePreference) => {
    const current = await ensureSettings();
    await db.settings.put({ ...current, theme });
    applyTheme(theme);
  };

  const handleAddTag = async () => {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    const current = await ensureSettings();
    const matchedDefault = DEFAULT_TAGS.find(
      (d) => d.toLowerCase() === trimmed.toLowerCase(),
    );
    if (matchedDefault) {
      await db.settings.put({
        ...current,
        hiddenDefaultTags: current.hiddenDefaultTags.filter(
          (h) => h !== matchedDefault,
        ),
      });
    } else if (
      !current.customTags.some(
        (c) => c.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      await db.settings.put({
        ...current,
        customTags: [...current.customTags, trimmed],
      });
    }
    setNewTag('');
  };

  const handleHideOrDeleteTag = async (tag: string) => {
    const current = await ensureSettings();
    if (DEFAULT_TAGS.includes(tag)) {
      if (!current.hiddenDefaultTags.includes(tag)) {
        await db.settings.put({
          ...current,
          hiddenDefaultTags: [...current.hiddenDefaultTags, tag],
        });
      }
    } else {
      await db.settings.put({
        ...current,
        customTags: current.customTags.filter((t) => t !== tag),
      });
    }
  };

  const handleRestoreDefaultTag = async (tag: string) => {
    const current = await ensureSettings();
    await db.settings.put({
      ...current,
      hiddenDefaultTags: current.hiddenDefaultTags.filter((t) => t !== tag),
    });
  };

  const handleAddHabit = async () => {
    const trimmed = newHabit.trim();
    if (!trimmed) return;
    const current = await ensureSettings();
    await db.settings.put({
      ...current,
      eveningHabits: [
        ...current.eveningHabits,
        { id: `habit-${createId()}`, label: trimmed, active: true },
      ],
    });
    setNewHabit('');
  };

  const handleRemoveHabit = async (habitId: string) => {
    const current = await ensureSettings();
    await db.settings.put({
      ...current,
      eveningHabits: current.eveningHabits.filter((h) => h.id !== habitId),
    });
  };

  const handleRenameHabit = async (habitId: string, label: string) => {
    const current = await ensureSettings();
    await db.settings.put({
      ...current,
      eveningHabits: current.eveningHabits.map((h) =>
        h.id === habitId ? { ...h, label } : h,
      ),
    });
  };

  const handleExport = async () => {
    const backup = await exportBackup(db);
    downloadBackupFile(backup, toDateKey());
    setStatusMessage({
      type: 'ok',
      text: 'Afrit sótt sem JSON-skrá.',
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    const parsed = parseAndValidateBackup(text);
    if (!parsed.ok) {
      setStatusMessage({ type: 'error', text: parsed.error });
      return;
    }
    setStatusMessage(null);
    setConfirmReplace(false);
    setPendingRestore({ backup: parsed.backup, summary: parsed.summary });
  };

  const handleConfirmRestore = async (mode: 'merge' | 'replace') => {
    if (!pendingRestore) return;
    await restoreBackup(db, pendingRestore.backup, mode);
    const updated = await ensureSettings();
    applyTheme(updated.theme);
    setPendingRestore(null);
    setConfirmReplace(false);
    setStatusMessage({
      type: 'ok',
      text:
        mode === 'merge'
          ? 'Afrit sameinað við núverandi gögn.'
          : 'Allt endurheimt úr afriti.',
    });
  };

  const visibleTags = getVisibleTags(settings);

  return (
    <div className="page-shell mx-auto max-w-2xl space-y-5 px-4 pt-4">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border bg-[var(--bg-surface)] px-3 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Til baka</span>
        </button>
        <h1 className="text-lg font-bold text-[var(--text-primary)]">
          Stillingar
        </h1>
        <div className="w-[82px]" />
      </header>

      {statusMessage && (
        <div
          className={`flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-xs font-medium ${
            statusMessage.type === 'error'
              ? 'border-[var(--danger)]/30 bg-[var(--danger-soft)] text-[var(--danger)]'
              : 'border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent)]'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            aria-label="Loka"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Theme */}
      <section className="space-y-3 rounded-2xl border bg-[var(--bg-surface)] p-4">
        <h2 className="text-sm font-bold text-[var(--text-primary)]">Útlit</h2>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: 'system', label: 'Kerfi', Icon: Monitor },
              { id: 'light', label: 'Ljóst', Icon: Sun },
              { id: 'dark', label: 'Dökkt', Icon: Moon },
            ] as const
          ).map(({ id, label, Icon }) => {
            const active = settings.theme === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => void handleThemeChange(id)}
                aria-pressed={active}
                className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold ${
                  active
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-text)]'
                    : 'bg-[var(--bg-page)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Tags */}
      <section className="space-y-3 rounded-2xl border bg-[var(--bg-surface)] p-4">
        <div>
          <h2 className="text-sm font-bold text-[var(--text-primary)]">
            Merki (Dálkur 1)
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Þú getur bætt við merkjum og eytt eða falið hvaða merki sem er.
            Gamlar skráningar halda sínum merkjum.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-xl border bg-[var(--bg-page)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)]"
            >
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => void handleHideOrDeleteTag(tag)}
                aria-label={`Eyða eða fela ${tag}`}
                className="rounded p-0.5 text-[var(--text-secondary)] hover:text-[var(--danger)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>

        {settings.hiddenDefaultTags.length > 0 && (
          <div className="space-y-1.5 rounded-xl bg-[var(--bg-page)] p-3">
            <p className="text-[11px] font-medium text-[var(--text-secondary)]">
              Falin sjálfgefin merki (pikkaðu til að endurheimta):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {settings.hiddenDefaultTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => void handleRestoreDefaultTag(tag)}
                  className="inline-flex items-center gap-1 rounded-lg border bg-[var(--bg-surface)] px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--accent)]"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>{tag}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleAddTag();
              }
            }}
            placeholder="Nýtt merki..."
            className="min-h-[42px] flex-1 rounded-xl border bg-[var(--bg-page)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void handleAddTag()}
            className="inline-flex min-h-[42px] items-center gap-1 rounded-xl border bg-[var(--bg-subtle)] px-3.5 text-xs font-semibold text-[var(--text-primary)]"
          >
            <Plus className="h-4 w-4" />
            <span>Bæta við</span>
          </button>
        </div>
      </section>

      {/* Evening Habits */}
      <section className="space-y-3 rounded-2xl border bg-[var(--bg-surface)] p-4">
        <div>
          <h2 className="text-sm font-bold text-[var(--text-primary)]">
            Kvöldvenjur í dagbók
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Sérsníddu já/nei atriðin í kvöldhluta dagbókarinnar. Fyrri dagar
            halda sínum eldri svörum.
          </p>
        </div>

        <div className="space-y-2">
          {settings.eveningHabits
            .filter((h) => h.active)
            .map((habit) => (
              <div key={habit.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={habit.label}
                  onChange={(e) =>
                    void handleRenameHabit(habit.id, e.target.value)
                  }
                  aria-label={`Heiti venju ${habit.label}`}
                  className="min-h-[42px] flex-1 rounded-xl border bg-[var(--bg-page)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void handleRemoveHabit(habit.id)}
                  aria-label={`Fjarlægja ${habit.label}`}
                  className="inline-flex min-h-[42px] min-w-[42px] items-center justify-center rounded-xl border bg-[var(--bg-page)] text-[var(--text-secondary)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newHabit}
            onChange={(e) => setNewHabit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleAddHabit();
              }
            }}
            placeholder="Ný venja (t.d. Lyf, Útivera)..."
            className="min-h-[42px] flex-1 rounded-xl border bg-[var(--bg-page)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void handleAddHabit()}
            className="inline-flex min-h-[42px] items-center gap-1 rounded-xl border bg-[var(--bg-subtle)] px-3.5 text-xs font-semibold text-[var(--text-primary)]"
          >
            <Plus className="h-4 w-4" />
            <span>Bæta við</span>
          </button>
        </div>
      </section>

      {/* Backup & Restore */}
      <section className="space-y-3 rounded-2xl border bg-[var(--bg-surface)] p-4">
        <div>
          <h2 className="text-sm font-bold text-[var(--text-primary)]">
            Afrit og endurheimt
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Öll gögn eru geymd eingöngu í þessum vafra. Taktu reglulega afrit
            til að geta flutt eða endurheimt gögnin — bæði HAMpa-afrit og eldri
            JSON-afrit úr Hugsanaskrá virka.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void handleExport()}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-text)] hover:bg-[var(--accent-hover)]"
          >
            <Download className="h-4 w-4" />
            <span>Sækja afrit (JSON)</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border bg-[var(--bg-page)] px-4 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
          >
            <Upload className="h-4 w-4" />
            <span>Endurheimta úr afriti</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => void handleFileChange(e)}
            className="hidden"
          />
        </div>
      </section>

      {/* Restore Preview Modal */}
      {pendingRestore && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="restore-modal-title"
        >
          <div className="w-full max-w-md space-y-4 rounded-2xl border bg-[var(--bg-surface)] p-5 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <h2
                id="restore-modal-title"
                className="text-base font-bold text-[var(--text-primary)]"
              >
                Endurheimta úr afriti
              </h2>
              <button
                type="button"
                onClick={() => setPendingRestore(null)}
                aria-label="Loka"
                className="rounded-lg p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1.5 rounded-xl border bg-[var(--bg-page)] p-3.5 text-xs text-[var(--text-primary)]">
              {pendingRestore.summary.sourceLabel && (
                <p className="mb-1">
                  <span className="inline-block rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--accent)]">
                    {pendingRestore.summary.sourceLabel}
                  </span>
                </p>
              )}
              <p>
                <strong>Dagsetning afrits:</strong>{' '}
                {formatIcelandicDate(
                  toDateKey(new Date(pendingRestore.summary.exportedAt)),
                )}
              </p>
              <p>
                <strong>Hugsanaskráningar:</strong>{' '}
                {pendingRestore.summary.thoughtRecordsCount}
              </p>
              <p>
                <strong>Líðanarskráningar:</strong>{' '}
                {pendingRestore.summary.quickMoodsCount}
              </p>
              <p>
                <strong>Dagbókarfærslur:</strong>{' '}
                {pendingRestore.summary.diaryEntriesCount}
              </p>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => void handleConfirmRestore('merge')}
                className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-text)] hover:bg-[var(--accent-hover)]"
              >
                <Check className="h-4 w-4" />
                <span>Sameina við núverandi gögn (mælt með)</span>
              </button>

              {!confirmReplace ? (
                <button
                  type="button"
                  onClick={() => setConfirmReplace(true)}
                  className="flex min-h-[46px] w-full items-center justify-center rounded-xl border border-[var(--danger)]/40 bg-[var(--danger-soft)] px-4 text-sm font-semibold text-[var(--danger)]"
                >
                  Yfirskrifa allt...
                </button>
              ) : (
                <div className="space-y-2 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger-soft)] p-3">
                  <p className="text-xs font-medium text-[var(--danger)]">
                    Þetta eyðir öllum núverandi gögnum í þessum vafra og setur
                    afritið í staðinn. Ertu viss?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmReplace(false)}
                      className="flex-1 min-h-[40px] rounded-lg border bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-primary)]"
                    >
                      Hætta við
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleConfirmRestore('replace')}
                      className="flex-1 min-h-[40px] rounded-lg bg-[var(--danger)] text-xs font-semibold text-white"
                    >
                      Já, yfirskrifa allt
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
