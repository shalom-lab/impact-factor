import { useEffect, useRef } from 'react';
import clsx from 'clsx';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  /** 高亮展示的目标名（如文件名） */
  highlight?: string | null;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  highlight,
  confirmLabel = '确定',
  cancelLabel = '取消',
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    cancelRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) onCancel();
    }

    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div className="dialog-overlay" onClick={loading ? undefined : onCancel} role="presentation">
      <div
        className={clsx('dialog', { 'dialog--danger': variant === 'danger' })}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-message"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog__accent" aria-hidden />

        <button
          type="button"
          className="dialog__close"
          onClick={onCancel}
          disabled={loading}
          aria-label="关闭"
        >
          ×
        </button>

        <div className="dialog__header">
          <div className="dialog__icon" aria-hidden>
            {variant === 'danger' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M4 7h16" strokeLinecap="round" />
                <path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" strokeLinecap="round" />
                <path d="M6.5 7l.8 12.2A2 2 0 009.3 21h5.4a2 2 0 001.99-1.8L17.5 7" strokeLinecap="round" />
                <path d="M10 11v6M14 11v6" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
              </svg>
            )}
          </div>
          <div className="dialog__heading">
            <h2 id="dialog-title" className="dialog__title">
              {title}
            </h2>
            <p id="dialog-message" className="dialog__message">
              {message}
            </p>
          </div>
        </div>

        {highlight ? (
          <div className="dialog__target">
            <span className="dialog__target-icon" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" strokeLinejoin="round" />
                <path d="M14 3v5h5" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="dialog__target-name">{highlight}</span>
          </div>
        ) : null}

        <div className="dialog__actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn btn--ghost dialog__btn"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={clsx('btn dialog__btn', variant === 'danger' ? 'btn--danger-solid' : 'btn--primary')}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? '处理中…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
