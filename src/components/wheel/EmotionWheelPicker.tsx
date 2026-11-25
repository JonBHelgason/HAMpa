import { ArrowLeft, Check, List, PieChart, Search, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  CORE_EMOTIONS,
  getCoreEmotion,
  getEmotionById,
  searchEmotions,
  type CoreEmotionId,
} from '../../data/emotionWheel';

export interface SelectedEmotionValue {
  id: string;
  emotionId: string;
  intensity: number;
}

interface EmotionWheelPickerProps {
  selected: SelectedEmotionValue[];
  onToggleEmotion: (emotionId: string) => void;
  onRemoveEntry: (entryId: string) => void;
  onChangeIntensity: (entryId: string, intensity: number) => void;
  onCommitIntensity?: () => void;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function sectorPath(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startAngle: number,
  endAngle: number,
): string {
  const p1 = polarToCartesian(cx, cy, rOuter, startAngle);
  const p2 = polarToCartesian(cx, cy, rOuter, endAngle);
  const p3 = polarToCartesian(cx, cy, rInner, endAngle);
  const p4 = polarToCartesian(cx, cy, rInner, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

export function EmotionWheelPicker({
  selected,
  onToggleEmotion,
  onRemoveEntry,
  onChangeIntensity,
  onCommitIntensity,
}: EmotionWheelPickerProps) {
  const [mode, setMode] = useState<'wheel' | 'list'>('wheel');
  const [activeCoreId, setActiveCoreId] = useState<CoreEmotionId | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedIds = useMemo(
    () => new Set(selected.map((s) => s.emotionId)),
    [selected],
  );

  const countByCore = useMemo(() => {
    const counts = new Map<CoreEmotionId, number>();
    for (const item of selected) {
      const node = getEmotionById(item.emotionId);
      if (!node) continue;
      counts.set(node.coreId, (counts.get(node.coreId) ?? 0) + 1);
    }
    return counts;
  }, [selected]);

  const activeCore = activeCoreId ? getCoreEmotion(activeCoreId) : undefined;

  const filteredNodes = useMemo(
    () => searchEmotions(searchQuery),
    [searchQuery],
  );

  const filteredIds = useMemo(
    () => new Set(filteredNodes.map((n) => n.id)),
    [filteredNodes],
  );

  const sliceAngle = 360 / CORE_EMOTIONS.length;

  return (
    <div className="space-y-4">
      {/* Mode switcher */}
      <div className="flex items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="Valmáti tilfinninga"
          className="inline-flex w-full rounded-xl border bg-[var(--bg-subtle)] p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'wheel'}
            onClick={() => setMode('wheel')}
            className={`flex flex-1 min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-all ${
              mode === 'wheel'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <PieChart className="h-4 w-4" />
            <span>Tilfinningahjól</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'list'}
            onClick={() => setMode('list')}
            className={`flex flex-1 min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-all ${
              mode === 'list'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <List className="h-4 w-4" />
            <span>Sýna öll orð</span>
          </button>
        </div>
      </div>

      {/* Wheel Mode */}
      {mode === 'wheel' && !activeCore && (
        <div className="rounded-2xl border bg-[var(--bg-surface)] p-4">
          <p className="mb-2 text-center text-xs text-[var(--text-secondary)]">
            Pikkaðu á grunntilfinningu til að stækka geirann og velja nánari orð
          </p>
          <div className="mx-auto max-w-[330px]">
            <svg
              viewBox="0 0 360 360"
              className="h-auto w-full select-none"
              role="img"
              aria-label="Tilfinningahjól með 7 grunntilfinningum"
            >
              {CORE_EMOTIONS.map((core, index) => {
                const startAngle = index * sliceAngle;
                const endAngle = (index + 1) * sliceAngle;
                const midAngle = startAngle + sliceAngle / 2;
                const labelPos = polarToCartesian(180, 180, 108, midAngle);
                const badgePos = polarToCartesian(180, 180, 146, midAngle);
                const selectedCount = countByCore.get(core.id) ?? 0;

                return (
                  <g
                    key={core.id}
                    onClick={() => setActiveCoreId(core.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveCoreId(core.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`${core.label}${selectedCount > 0 ? `, ${selectedCount} valin` : ''}`}
                    className="cursor-pointer transition-opacity hover:opacity-90 focus:outline-none"
                  >
                    <path
                      d={sectorPath(180, 180, 44, 166, startAngle, endAngle)}
                      fill={core.wheelFill}
                      stroke="#2B2621"
                      strokeWidth={selectedCount > 0 ? 2.4 : 1.3}
                    />
                    <text
                      x={labelPos.x}
                      y={labelPos.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#1D1A17"
                      fontSize="13.5"
                      fontWeight="700"
                    >
                      {core.label}
                    </text>
                    {selectedCount > 0 && (
                      <g>
                        <circle
                          cx={badgePos.x}
                          cy={badgePos.y}
                          r={11}
                          fill={core.ringColor}
                          stroke="#FFFFFF"
                          strokeWidth={1.8}
                        />
                        <text
                          x={badgePos.x}
                          y={badgePos.y + 0.5}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#FFFFFF"
                          fontSize="11"
                          fontWeight="700"
                        >
                          {selectedCount}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
              <circle
                cx="180"
                cy="180"
                r="42"
                fill="var(--bg-surface)"
                stroke="var(--border)"
                strokeWidth="1.5"
              />
              <text
                x="180"
                y="176"
                textAnchor="middle"
                fill="var(--text-primary)"
                fontSize="11.5"
                fontWeight="700"
              >
                Veldu
              </text>
              <text
                x="180"
                y="191"
                textAnchor="middle"
                fill="var(--text-secondary)"
                fontSize="10.5"
              >
                geira
              </text>
            </svg>
          </div>
        </div>
      )}

      {/* Wheel Mode — Zoomed Sector */}
      {mode === 'wheel' && activeCore && (
        <div className="space-y-3 rounded-2xl border bg-[var(--bg-surface)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setActiveCoreId(null)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border bg-[var(--bg-subtle)] px-3 text-sm font-medium text-[var(--text-primary)] hover:opacity-90"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Til baka í hring</span>
            </button>

            {/* Quick sector switcher dots */}
            <div className="flex items-center gap-1.5" aria-label="Skipta um geira">
              {CORE_EMOTIONS.map((core) => {
                const isCurrent = core.id === activeCore.id;
                const count = countByCore.get(core.id) ?? 0;
                return (
                  <button
                    key={core.id}
                    type="button"
                    onClick={() => setActiveCoreId(core.id)}
                    title={core.label}
                    aria-label={core.label}
                    aria-pressed={isCurrent}
                    className={`relative h-7 w-7 rounded-full border transition-transform ${
                      isCurrent ? 'scale-115 ring-2 ring-[var(--text-primary)]' : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: core.wheelFill, borderColor: core.ringColor }}
                  >
                    {count > 0 && (
                      <span
                        className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                        style={{ backgroundColor: core.ringColor }}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Level 1: Core emotion pickable banner */}
          {(() => {
            const coreSelected = selectedIds.has(activeCore.id);
            return (
              <button
                type="button"
                onClick={() => onToggleEmotion(activeCore.id)}
                aria-pressed={coreSelected}
                className="flex w-full min-h-[48px] items-center justify-between rounded-xl border-2 px-4 py-2.5 text-left transition-all"
                style={{
                  backgroundColor: activeCore.wheelFill,
                  borderColor: coreSelected ? '#1E1B18' : activeCore.ringColor,
                  color: '#1D1A17',
                }}
              >
                <div>
                  <span className="block text-[11px] font-semibold uppercase tracking-wide opacity-75">
                    Grunntilfinning (1. hringur)
                  </span>
                  <span className="text-base font-bold">{activeCore.label}</span>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                    coreSelected
                      ? 'bg-[#1D1A17] text-white'
                      : 'bg-white/75 text-[#1D1A17]'
                  }`}
                >
                  {coreSelected ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Valin</span>
                    </>
                  ) : (
                    <span>Velja „{activeCore.label}“</span>
                  )}
                </span>
              </button>
            );
          })()}

          {/* Level 2 (Middle) -> Level 3 (Outer) radial layers */}
          <div className="space-y-2.5">
            <p className="text-xs text-[var(--text-secondary)]">
              Millihringur (vinstra megin) og nánari orð í ysta hring (hægra megin):
            </p>
            {activeCore.middle.map((mid) => {
              const midSelected = selectedIds.has(mid.id);
              return (
                <div
                  key={mid.id}
                  className="rounded-xl border p-2.5"
                  style={{
                    borderColor: `${activeCore.ringColor}66`,
                    backgroundColor: 'var(--bg-page)',
                  }}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() => onToggleEmotion(mid.id)}
                      aria-pressed={midSelected}
                      className="inline-flex min-h-[42px] shrink-0 items-center justify-between gap-2 rounded-lg border-2 px-3 py-1.5 text-sm font-bold transition-all sm:w-40"
                      style={{
                        backgroundColor: activeCore.wheelFill,
                        borderColor: midSelected ? '#1D1A17' : activeCore.ringColor,
                        color: '#1D1A17',
                      }}
                    >
                      <span>{mid.label}</span>
                      {midSelected && <Check className="h-4 w-4 shrink-0" />}
                    </button>

                    <div className="flex flex-wrap gap-1.5">
                      {mid.outer.map((out) => {
                        const outSelected = selectedIds.has(out.id);
                        return (
                          <button
                            key={out.id}
                            type="button"
                            onClick={() => onToggleEmotion(out.id)}
                            aria-pressed={outSelected}
                            className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${
                              outSelected
                                ? 'border-2 font-semibold shadow-sm'
                                : 'hover:opacity-90'
                            }`}
                            style={
                              outSelected
                                ? {
                                    backgroundColor: activeCore.ringColor,
                                    borderColor: '#1D1A17',
                                    color: '#FFFFFF',
                                  }
                                : {
                                    backgroundColor: 'var(--bg-surface)',
                                    borderColor: `${activeCore.ringColor}88`,
                                    color: 'var(--text-primary)',
                                  }
                            }
                          >
                            <span>{out.label}</span>
                            {outSelected && <Check className="h-3.5 w-3.5" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List Mode */}
      {mode === 'list' && (
        <div className="space-y-3 rounded-2xl border bg-[var(--bg-surface)] p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Leita að tilfinningu (t.d. kvíði, þakklæti)..."
              className="min-h-[44px] w-full rounded-xl border bg-[var(--bg-page)] pl-9 pr-9 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Hreinsa leit"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {CORE_EMOTIONS.map((core) => {
              const coreMatches = filteredIds.has(core.id);
              const matchingMids = core.middle.filter(
                (mid) =>
                  coreMatches ||
                  filteredIds.has(mid.id) ||
                  mid.outer.some((o) => filteredIds.has(o.id)),
              );
              if (!coreMatches && matchingMids.length === 0) return null;

              const coreSelected = selectedIds.has(core.id);
              return (
                <div key={core.id} className="space-y-2 rounded-xl border bg-[var(--bg-page)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleEmotion(core.id)}
                      aria-pressed={coreSelected}
                      className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border px-3 py-1 text-sm font-bold transition-all"
                      style={{
                        backgroundColor: core.wheelFill,
                        borderColor: coreSelected ? '#1D1A17' : core.ringColor,
                        color: '#1D1A17',
                      }}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: core.ringColor }}
                      />
                      <span>{core.label}</span>
                      {coreSelected && <Check className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  <div className="space-y-2 pl-1">
                    {matchingMids.map((mid) => {
                      const midSelected = selectedIds.has(mid.id);
                      const visibleOuters =
                        searchQuery.trim() === '' ||
                        coreMatches ||
                        filteredIds.has(mid.id)
                          ? mid.outer
                          : mid.outer.filter((o) => filteredIds.has(o.id));
                      return (
                        <div key={mid.id} className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onToggleEmotion(mid.id)}
                              aria-pressed={midSelected}
                              className={`inline-flex min-h-[36px] items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold transition-all ${
                                midSelected ? 'border-2' : ''
                              }`}
                              style={{
                                backgroundColor: midSelected
                                  ? core.ringColor
                                  : core.wheelFill,
                                borderColor: midSelected
                                  ? '#1D1A17'
                                  : core.ringColor,
                                color: midSelected ? '#FFFFFF' : '#1D1A17',
                              }}
                            >
                              <span>{mid.label}</span>
                              {midSelected && <Check className="h-3 w-3" />}
                            </button>

                            {visibleOuters.map((out) => {
                              const outSelected = selectedIds.has(out.id);
                              return (
                                <button
                                  key={out.id}
                                  type="button"
                                  onClick={() => onToggleEmotion(out.id)}
                                  aria-pressed={outSelected}
                                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all"
                                  style={
                                    outSelected
                                      ? {
                                          backgroundColor: core.ringColor,
                                          borderColor: '#1D1A17',
                                          color: '#FFFFFF',
                                        }
                                      : {
                                          backgroundColor: 'var(--bg-surface)',
                                          borderColor: `${core.ringColor}77`,
                                          color: 'var(--text-primary)',
                                        }
                                  }
                                >
                                  <span>{out.label}</span>
                                  {outSelected && <Check className="h-3 w-3" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {filteredNodes.length === 0 && (
              <p className="py-6 text-center text-sm text-[var(--text-secondary)]">
                Ekkert tilfinningaorð fannst fyrir „{searchQuery}“.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Selected Emotions Tray with 0-100% sliders */}
      {selected.length > 0 && (
        <div className="space-y-2.5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Valdar tilfinningar og styrkur ({selected.length})
          </h3>
          {selected.map((item) => {
            const node = getEmotionById(item.emotionId);
            const label = node?.label ?? item.emotionId;
            const pathHint =
              node && node.pathLabels.length > 1
                ? node.pathLabels.slice(0, -1).join(' · ')
                : null;
            const ringColor = node?.ringColor ?? 'var(--accent)';

            return (
              <div
                key={item.id}
                className="rounded-xl border bg-[var(--bg-surface)] p-3.5 shadow-2xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full"
                      style={{ backgroundColor: ringColor }}
                    />
                    <div>
                      <span className="text-sm font-semibold text-[var(--text-primary)]">
                        {label}
                      </span>
                      {pathHint && (
                        <span className="ml-2 text-xs text-[var(--text-secondary)]">
                          ({pathHint})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="min-w-[3.2rem] rounded-full bg-[var(--bg-subtle)] px-2.5 py-0.5 text-center text-xs font-bold tabular-nums text-[var(--text-primary)]">
                      {item.intensity}%
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveEntry(item.id)}
                      aria-label={`Fjarlægja ${label}`}
                      className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-3">
                  <span className="text-[11px] text-[var(--text-secondary)]">0%</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={item.intensity}
                    aria-label={`Styrkur fyrir ${label}`}
                    onChange={(e) =>
                      onChangeIntensity(item.id, Number(e.target.value))
                    }
                    onPointerUp={onCommitIntensity}
                    onBlur={onCommitIntensity}
                    className="hampa-slider flex-1"
                  />
                  <span className="text-[11px] text-[var(--text-secondary)]">100%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
