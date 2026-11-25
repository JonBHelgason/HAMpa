import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Plus,
  Settings,
  Smile,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { getEmotionById } from '../data/emotionWheel';
import { db } from '../db/db';
import type { QuickMoodEntry, ThoughtRecord } from '../db/schema';
import { formatRelativeAge, formatShortIcelandicDate, formatTimeOfDay } from '../domain/dates';
import { groupHomeEntries, type HomeEntryItem } from '../domain/thoughtRecord';

interface HomePageProps {
  onNewThoughtRecord: () => void;
  onOpenThoughtRecord: (id: string, initialColumn?: 1 | 2 | 3 | 4) => void;
  onNewQuickMood: () => void;
  onOpenQuickMood: (id: string) => void;
  onOpenSettings: () => void;
}

function StatusBadge({ record }: { record: ThoughtRecord }) {
  if (record.status === 'draft') {
    return (
      <span className="rounded-full border bg-[var(--bg-subtle)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
        Uppkast
      </span>
    );
  }
  if (record.status === 'incomplete') {
    return (
      <span
        className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
        style={{
          backgroundColor: 'var(--warning-bg)',
          color: 'var(--warning-text)',
          borderColor: 'var(--warning-border)',
        }}
      >
        Óklárað
      </span>
    );
  }
  if (record.reappraisalSkipped) {
    return (
      <span className="rounded-full border bg-[var(--bg-subtle)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
        Endurmati sleppt
      </span>
    );
  }
  return (
    <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--accent)]">
      Lokið
    </span>
  );
}

function EmotionDots({
  emotions,
}: {
  emotions: Array<{ emotionId: string; intensity: number }>;
}) {
  if (emotions.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {emotions.slice(0, 4).map((em, idx) => {
        const node = getEmotionById(em.emotionId);
        return (
          <span
            key={`${em.emotionId}-${idx}`}
            className="inline-flex items-center gap-1 rounded-full border bg-[var(--bg-page)] px-2 py-0.5 text-[11px] text-[var(--text-primary)]"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: node?.ringColor ?? 'var(--accent)' }}
            />
            <span>{node?.label ?? em.emotionId}</span>
            <span className="text-[var(--text-secondary)] tabular-nums">
              {em.intensity}%
            </span>
          </span>
        );
      })}
      {emotions.length > 4 && (
        <span className="text-[11px] text-[var(--text-secondary)]">
          +{emotions.length - 4}
        </span>
      )}
    </div>
  );
}

export function HomePage({
  onNewThoughtRecord,
  onOpenThoughtRecord,
  onNewQuickMood,
  onOpenQuickMood,
  onOpenSettings,
}: HomePageProps) {
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

  const [showOlder, setShowOlder] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: 'thought'; id: string }
    | { kind: 'mood'; id: string }
    | null
  >(null);

  const grouped = groupHomeEntries(thoughtRecords, quickMoods);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'thought') {
      await db.thoughtRecords.delete(deleteTarget.id);
    } else {
      await db.quickMoods.delete(deleteTarget.id);
    }
    setDeleteTarget(null);
  };

  const renderEntryCard = (item: HomeEntryItem, showDate: boolean) => {
    if (item.kind === 'thought') {
      const r = item.record;
      const preview = r.situation.description.trim() || 'Engin lýsing á aðstæðum enn';
      return (
        <div
          key={`thought-${r.id}`}
          onClick={() => onOpenThoughtRecord(r.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenThoughtRecord(r.id);
            }
          }}
          className="group cursor-pointer rounded-2xl border bg-[var(--bg-surface)] p-4 transition-colors hover:border-[var(--accent)]/60"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge record={r} />
              <span className="text-xs text-[var(--text-secondary)]">
                {showDate ? `${formatShortIcelandicDate(r.dateKey)} · ` : ''}
                {formatTimeOfDay(r.createdAt)}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget({ kind: 'thought', id: r.id });
              }}
              aria-label="Eyða skráningu"
              className="rounded-lg p-1.5 text-[var(--text-secondary)] opacity-70 hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] hover:opacity-100"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--text-primary)]">
            {preview}
          </p>

          {(r.emotions.length > 0 || r.situation.tags.length > 0) && (
            <div className="mt-3 flex flex-col gap-2">
              <EmotionDots
                emotions={r.emotions.map((em) => ({
                  emotionId: em.emotionId,
                  intensity: em.intensityBefore,
                }))}
              />
              {r.situation.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {r.situation.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    const m = item.entry;
    return (
      <div
        key={`mood-${m.id}`}
        onClick={() => onOpenQuickMood(m.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenQuickMood(m.id);
          }
        }}
        className="cursor-pointer rounded-2xl border bg-[var(--bg-surface)] p-4 transition-colors hover:border-[var(--accent)]/60"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border bg-[var(--bg-subtle)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--text-primary)]">
              <Smile className="h-3 w-3 text-[var(--accent)]" />
              <span>Líðan</span>
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              {showDate ? `${formatShortIcelandicDate(m.dateKey)} · ` : ''}
              {formatTimeOfDay(m.createdAt)}
            </span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget({ kind: 'mood', id: m.id });
            }}
            aria-label="Eyða líðan"
            className="rounded-lg p-1.5 text-[var(--text-secondary)] opacity-70 hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] hover:opacity-100"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-2.5">
          <EmotionDots emotions={m.emotions} />
        </div>

        {m.note.trim() && (
          <p className="mt-2 line-clamp-2 text-sm text-[var(--text-secondary)]">
            {m.note}
          </p>
        )}
      </div>
    );
  };

  const renderSection = (
    title: string,
    entries: HomeEntryItem[],
    showDate = false,
  ) => {
    if (entries.length === 0) return null;
    return (
      <section className="space-y-2.5">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          {title}
        </h2>
        <div className="space-y-2.5">
          {entries.map((item) => renderEntryCard(item, showDate))}
        </div>
      </section>
    );
  };

  const hasAnyHistory =
    grouped.incomplete.length > 0 ||
    grouped.today.length > 0 ||
    grouped.yesterday.length > 0 ||
    grouped.thisWeek.length > 0 ||
    grouped.lastWeek.length > 0 ||
    grouped.older.length > 0;

  return (
    <div className="page-shell mx-auto max-w-2xl space-y-6 px-4 pt-5">
      {/* Header */}
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            HAMpa
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Hugsanaskrá, líðan og dagbók
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Stillingar"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
        >
          <Settings className="h-5 w-5" />
        </button>
      </header>

      {/* Primary Action CTAs */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <button
          type="button"
          onClick={onNewThoughtRecord}
          className="flex min-h-[54px] items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--accent-text)] shadow-sm transition-colors hover:bg-[var(--accent-hover)]"
        >
          <Plus className="h-5 w-5" />
          <span>Ný hugsanaskráning</span>
        </button>
        <button
          type="button"
          onClick={onNewQuickMood}
          className="flex min-h-[54px] items-center justify-center gap-2 rounded-2xl border bg-[var(--bg-surface)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-subtle)]"
        >
          <Smile className="h-5 w-5 text-[var(--accent)]" />
          <span>Skrá líðan</span>
        </button>
      </div>

      {/* Incomplete records pinned at top */}
      {grouped.incomplete.length > 0 && (
        <section
          aria-label="Ókláraðar skráningar"
          className="space-y-2.5 rounded-2xl border p-4"
          style={{
            backgroundColor: 'var(--warning-bg)',
            borderColor: 'var(--warning-border)',
          }}
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle
              className="mt-0.5 h-5 w-5 shrink-0"
              style={{ color: 'var(--warning-text)' }}
            />
            <div>
              <h2
                className="text-sm font-bold"
                style={{ color: 'var(--warning-text)' }}
              >
                Óklárað ({grouped.incomplete.length})
              </h2>
              <p
                className="text-xs leading-relaxed"
                style={{ color: 'var(--warning-text)' }}
              >
                Þessar skráningar bíða endurmats — best er að endurmeta hugsanir
                sem fyrst á meðan aðstæðurnar eru ferskar.
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {grouped.incomplete.map((r) => (
              <div
                key={r.id}
                onClick={() => onOpenThoughtRecord(r.id, 4)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenThoughtRecord(r.id, 4);
                  }
                }}
                className="cursor-pointer rounded-xl border bg-[var(--bg-surface)] p-3.5 shadow-2xs transition-colors hover:border-[var(--accent)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: 'var(--warning-text)' }}
                  >
                    {formatRelativeAge(r.createdAt)} ·{' '}
                    {formatShortIcelandicDate(r.dateKey)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget({ kind: 'thought', id: r.id });
                    }}
                    aria-label="Eyða ókláraðri skráningu"
                    className="rounded-lg p-1 text-[var(--text-secondary)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <p className="mt-1.5 line-clamp-2 text-sm font-medium text-[var(--text-primary)]">
                  {r.situation.description}
                </p>

                {r.situation.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.situation.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between gap-2">
                  <EmotionDots
                    emotions={r.emotions.map((em) => ({
                      emotionId: em.emotionId,
                      intensity: em.intensityBefore,
                    }))}
                  />
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-text)]">
                    <span>Endurmeta</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Time-grouped previous records */}
      {hasAnyHistory ? (
        <div className="space-y-5">
          {renderSection('Í dag', grouped.today, false)}
          {renderSection('Í gær', grouped.yesterday, false)}
          {renderSection('Í vikunni', grouped.thisWeek, true)}
          {renderSection('Síðustu viku', grouped.lastWeek, true)}

          {grouped.older.length > 0 && (
            <section className="space-y-2.5">
              <button
                type="button"
                onClick={() => setShowOlder((v) => !v)}
                className="flex min-h-[44px] w-full items-center justify-between rounded-xl border bg-[var(--bg-surface)] px-4 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <span>Sýna eldri ({grouped.older.length})</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showOlder ? 'rotate-180' : ''}`}
                />
              </button>
              {showOlder && (
                <div className="space-y-2.5">
                  {grouped.older.map((item) => renderEntryCard(item, true))}
                </div>
              )}
            </section>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed bg-[var(--bg-surface)]/60 px-6 py-10 text-center">
          <p className="text-base font-semibold text-[var(--text-primary)]">
            Velkomin(n) í HAMpa
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
            Hér birtast hugsanaskráningar og líðanarskráningar þínar. Öll gögn
            eru geymd eingöngu á þínu tæki.
          </p>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eyða skráningu?"
        description="Ertu viss um að þú viljir eyða þessari skráningu? Þessu er ekki hægt að afturkalla."
        confirmLabel="Eyða"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
