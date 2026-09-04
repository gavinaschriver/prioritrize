import { useEffect, useRef } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  /** Shown under the title — badges, due date, points. */
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  /** Buttons pinned to the bottom bar. */
  footer?: React.ReactNode;
}

/** The detail sheet every todo, task and daily opens into. Full-height on a
 *  phone, a centred card on a desktop. */
export function Modal({ open, onClose, title, subtitle, children, footer }: ModalProps) {
  const panel = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Let a field's own Escape handling (cancel an edit) win first.
      if (e.key === 'Escape' && !e.defaultPrevented) onClose();
    };
    document.addEventListener('keydown', onKey);
    // The page behind must not scroll while a full-screen sheet is over it.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        className="flex w-full sm:max-w-2xl max-h-full sm:max-h-[90vh] flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-start gap-3 border-b border-gray-200 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-base font-bold text-gray-800 break-words">{title}</div>
            {subtitle && <div className="mt-1">{subtitle}</div>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 -mr-1 px-2 text-xl leading-none text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-5">{children}</div>

        {footer && (
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 px-4 py-3">{footer}</div>
        )}
      </div>
    </div>
  );
}

/** A labelled block inside a detail sheet. */
export function ModalSection({
  label,
  children,
  action,
}: {
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
