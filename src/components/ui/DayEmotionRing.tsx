import type { DayEmotionSegment } from '../../domain/calendar';

interface DayEmotionRingProps {
  segments: DayEmotionSegment[];
  dayNumber: number;
  size?: number;
  selected?: boolean;
  isToday?: boolean;
  muted?: boolean;
}

export function DayEmotionRing({
  segments,
  dayNumber,
  size = 42,
  selected = false,
  isToday = false,
  muted = false,
}: DayEmotionRingProps) {
  const strokeWidth = 4.5;
  const center = size / 2;
  const radius = center - strokeWidth / 2 - 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedOffset = 0;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="pointer-events-none absolute inset-0 block"
        aria-hidden="true"
      >
        {selected && (
          <circle
            cx={center}
            cy={center}
            r={radius - 3}
            fill="var(--accent-soft)"
          />
        )}
        {segments.length === 0 ? (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={selected ? 2 : 1.5}
            opacity={muted ? 0.45 : 0.85}
          />
        ) : segments.length === 1 ? (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={segments[0].ringColor}
            strokeWidth={strokeWidth}
            opacity={muted ? 0.45 : 1}
          />
        ) : (
          <g transform={`rotate(-90 ${center} ${center})`}>
            {segments.map((seg) => {
              const segLen = seg.ratio * circumference;
              const dashArray = `${segLen} ${circumference - segLen}`;
              const dashOffset = -accumulatedOffset;
              accumulatedOffset += segLen;
              return (
                <circle
                  key={seg.coreId}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={seg.ringColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="butt"
                  opacity={muted ? 0.45 : 1}
                />
              );
            })}
          </g>
        )}
        {selected && (
          <circle
            cx={center}
            cy={center}
            r={center - 1}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
          />
        )}
      </svg>
      <span
        className={`relative z-10 text-xs font-semibold tabular-nums ${
          muted
            ? 'text-[var(--text-secondary)] opacity-55'
            : isToday
              ? 'text-[var(--accent)] font-bold'
              : 'text-[var(--text-primary)]'
        }`}
      >
        {dayNumber}
      </span>
    </div>
  );
}
