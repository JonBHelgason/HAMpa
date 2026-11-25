interface ScalePickerProps {
  label: string;
  value?: number;
  labels: Record<number, string>;
  onChange: (nextValue: number | undefined) => void;
}

export function ScalePicker({
  label,
  value,
  labels,
  onChange,
}: ScalePickerProps) {
  const activeText = value ? labels[value] : undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-[var(--text-primary)]">
          {label}
        </span>
        <span className="text-xs font-medium text-[var(--text-secondary)]">
          {activeText ?? 'Ekki skráð'}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((num) => {
          const isSelected = value === num;
          return (
            <button
              key={num}
              type="button"
              onClick={() => onChange(isSelected ? undefined : num)}
              aria-pressed={isSelected}
              title={labels[num]}
              className={`min-h-[44px] rounded-xl border text-sm font-semibold transition-all ${
                isSelected
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-text)] shadow-sm'
                  : 'border-[var(--border)] bg-[var(--bg-subtle)]/60 text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
              }`}
            >
              {num}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between text-[11px] text-[var(--text-secondary)]">
        <span>{labels[1]}</span>
        <span>{labels[5]}</span>
      </div>
    </div>
  );
}
