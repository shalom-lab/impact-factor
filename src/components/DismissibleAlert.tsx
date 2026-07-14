import type { ReactNode } from 'react';

type DismissibleAlertProps = {
  variant: 'error' | 'info' | 'success';
  children: ReactNode;
  onDismiss: () => void;
};

export function DismissibleAlert({ variant, children, onDismiss }: DismissibleAlertProps) {
  return (
    <div className={`alert alert--${variant} alert--dismissible`} role="status">
      <div className="alert__body">{children}</div>
      <button type="button" className="alert__close" onClick={onDismiss} aria-label="关闭" title="关闭">
        ×
      </button>
    </div>
  );
}
