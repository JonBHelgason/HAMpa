import { X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Hætta við',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-sm rounded-2xl border bg-[var(--bg-surface)] p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h2
            id="confirm-dialog-title"
            className="text-base font-semibold text-[var(--text-primary)]"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Loka"
            className="rounded-lg p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
          {description}
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[42px] rounded-xl border bg-[var(--bg-surface)] px-4 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-[42px] rounded-xl px-4 text-sm font-semibold transition-colors ${
              danger
                ? 'bg-[var(--danger)] text-white hover:opacity-90'
                : 'bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
