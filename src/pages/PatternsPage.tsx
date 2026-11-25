import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDownRight, Brain, Tag, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { db } from '../db/db';
import type { ThoughtRecord } from '../db/schema';
import {
  computeDistortionPatterns,
  computeReappraisalComparison,
  computeTagPatterns,
  filterByTimeRange,
  type PatternTimeRange,
} from '../domain/patterns';

const RANGE_OPTIONS: Array<{ id: PatternTimeRange; label: string }> = [
  { id: '7d', label: '7 dagar' },
  { id: '30d', label: '30 dagar' },
  { id: 'all', label: 'Allt' },
];

export function PatternsPage() {
  const [range, setRange] = useState<PatternTimeRange>('30d');

  const allRecords = useLiveQuery(
    () => db.thoughtRecords.toArray(),
    [],
    [] as ThoughtRecord[],
  );

  const filtered = useMemo(
    () => filterByTimeRange(allRecords, range),
    [allRecords, range],
  );

  const tagPatterns = useMemo(() => computeTagPatterns(filtered), [filtered]);
  const distortionPatterns = useMemo(
    () => computeDistortionPatterns(filtered),
    [filtered],
  );
  const reappraisal = useMemo(
    () => computeReappraisalComparison(filtered),
    [filtered],
  );

  const hasData = filtered.length > 0;

  return (
    <div className="page-shell mx-auto max-w-2xl space-y-5 px-4 pt-5">
      <header className="space-y-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">
            Mynstur
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Yfirlit yfir merki, algengar hugsanavillur og árangur endurmats
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Tímabil"
          className="grid grid-cols-3 rounded-xl border bg-[var(--bg-subtle)] p-1"
        >
          {RANGE_OPTIONS.map((opt) => {
            const active = range === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setRange(opt.id)}
                className={`min-h-[38px] rounded-lg text-xs font-semibold transition-all ${
                  active
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </header>

      {!hasData ? (
        <div className="rounded-2xl border border-dashed bg-[var(--bg-surface)]/60 p-8 text-center">
          <TrendingUp className="mx-auto h-7 w-7 text-[var(--accent)]" />
          <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">
            Engar hugsanaskráningar á þessu tímabili ennþá
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
            Þegar þú bætir við fleiri skráningum birtast hér tengsl milli merkja,
            tilfinninga og hugsana.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 1. Tag Patterns */}
          <section className="space-y-3 rounded-2xl border bg-[var(--bg-surface)] p-4">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-[var(--accent)]" />
              <h2 className="text-sm font-bold text-[var(--text-primary)]">
                Aðstæður eftir merkjum
              </h2>
            </div>

            {tagPatterns.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">
                Engin merki hafa verið sett á skráningar á þessu tímabili.
              </p>
            ) : (
              <div className="space-y-3">
                {tagPatterns.map((tp) => (
                  <div
                    key={tp.tag}
                    className="space-y-2 rounded-xl border bg-[var(--bg-page)] p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[var(--text-primary)]">
                        #{tp.tag}
                      </span>
                      <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                        {tp.count}{' '}
                        {tp.count === 1 ? 'skráning' : 'skráningar'}
                      </span>
                    </div>

                    {tp.topEmotions.length > 0 && (
                      <div className="space-y-1.5">
                        {tp.topEmotions.map((em) => (
                          <div key={em.emotionId} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="inline-flex items-center gap-1.5 text-[var(--text-primary)]">
                                <span
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: em.ringColor }}
                                />
                                <span>{em.label}</span>
                                <span className="text-[var(--text-secondary)]">
                                  ({em.count}×)
                                </span>
                              </span>
                              <span className="font-semibold tabular-nums text-[var(--text-secondary)]">
                                Meðaltal {em.avgIntensity}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${em.avgIntensity}%`,
                                  backgroundColor: em.ringColor,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 2. Common Cognitive Distortions */}
          <section className="space-y-3 rounded-2xl border bg-[var(--bg-surface)] p-4">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-[var(--accent)]" />
              <h2 className="text-sm font-bold text-[var(--text-primary)]">
                Algengustu hugsanavillur
              </h2>
            </div>

            {distortionPatterns.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">
                Engar hugsanavillur hafa verið merktar í endurmati á þessu
                tímabili enn.
              </p>
            ) : (
              <div className="space-y-2.5">
                {distortionPatterns.map((dp) => (
                  <div key={dp.distortionId} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-[var(--text-primary)]">
                        {dp.name}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-[var(--text-secondary)]">
                        {dp.count}× ({dp.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                      <div
                        className="h-full rounded-full bg-[var(--accent)]"
                        style={{ width: `${dp.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 3. Before & After Reappraisal Comparison */}
          <section className="space-y-3 rounded-2xl border bg-[var(--bg-surface)] p-4">
            <div className="flex items-center gap-2">
              <ArrowDownRight className="h-4 w-4 text-[var(--accent)]" />
              <h2 className="text-sm font-bold text-[var(--text-primary)]">
                Árangur endurmats (fyrir og eftir)
              </h2>
            </div>

            {reappraisal.beliefCount === 0 && reappraisal.emotionCount === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">
                Þegar þú lýkur endurmati og metur trú og tilfinningar aftur
                birtist samanburðurinn hér.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 rounded-xl border bg-[var(--bg-page)] p-3.5">
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">
                    Trú á sjálfvirkar hugsanir
                  </span>
                  {reappraisal.beliefCount > 0 ? (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold tabular-nums text-[var(--text-primary)]">
                          {reappraisal.avgBeliefBefore}% →{' '}
                          {reappraisal.avgBeliefAfter}%
                        </span>
                        {reappraisal.beliefDelta !== null && (
                          <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-bold tabular-nums text-[var(--accent)]">
                            {reappraisal.beliefDelta > 0
                              ? `+${reappraisal.beliefDelta}`
                              : reappraisal.beliefDelta}
                            %
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Trú lækkaði í {reappraisal.beliefImprovedPct}% tilfella (
                        {reappraisal.beliefCount} metnar)
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-[var(--text-secondary)]">
                      Ekki metið enn
                    </p>
                  )}
                </div>

                <div className="space-y-1.5 rounded-xl border bg-[var(--bg-page)] p-3.5">
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">
                    Styrkur tilfinninga
                  </span>
                  {reappraisal.emotionCount > 0 ? (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold tabular-nums text-[var(--text-primary)]">
                          {reappraisal.avgEmotionBefore}% →{' '}
                          {reappraisal.avgEmotionAfter}%
                        </span>
                        {reappraisal.emotionDelta !== null && (
                          <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-bold tabular-nums text-[var(--accent)]">
                            {reappraisal.emotionDelta > 0
                              ? `+${reappraisal.emotionDelta}`
                              : reappraisal.emotionDelta}
                            %
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Styrkur lækkaði í {reappraisal.emotionImprovedPct}%
                        tilfella ({reappraisal.emotionCount} metnar)
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-[var(--text-secondary)]">
                      Ekki metið enn
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
