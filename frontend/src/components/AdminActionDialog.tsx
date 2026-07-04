import { useEffect, useId, useRef, useState } from 'react';

export interface AdminActionDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'confirm' | 'prompt';
  inputLabel?: string;
  inputPlaceholder?: string;
  secondInputLabel?: string;
  secondInputPlaceholder?: string;
  minLength?: number;
  secondaryMinLength?: number;
  inputRequired?: boolean;
  secondaryRequired?: boolean;
  onConfirm: (values: { primary?: string; secondary?: string }) => void;
  onCancel: () => void;
}

export default function AdminActionDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'confirm',
  inputLabel,
  inputPlaceholder,
  secondInputLabel,
  secondInputPlaceholder,
  minLength = 1,
  secondaryMinLength = 1,
  inputRequired = true,
  secondaryRequired = true,
  onConfirm,
  onCancel,
}: AdminActionDialogProps) {
  const titleId = useId();
  const descId = useId();
  const primaryRef = useRef<HTMLInputElement>(null);
  const [primary, setPrimary] = useState('');
  const [secondary, setSecondary] = useState('');

  useEffect(() => {
    if (open) {
      setPrimary('');
      setSecondary('');
      setTimeout(() => primaryRef.current?.focus(), 0);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (variant === 'prompt') {
      if (inputRequired && primary.trim().length < minLength) return;
      if (secondInputLabel && secondaryRequired && secondary.trim().length < secondaryMinLength) return;
    }
    onConfirm({ primary: primary.trim() || undefined, secondary: secondary.trim() || undefined });
  };

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        style={{
          background: 'white',
          borderRadius: 16,
          padding: 24,
          maxWidth: 440,
          width: '100%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#1f2937' }}>
          {title}
        </h2>
        <p id={descId} style={{ margin: '0 0 20px', color: '#6b7280', fontSize: 14, lineHeight: 1.5 }}>
          {message}
        </p>
        <form onSubmit={handleSubmit}>
          {variant === 'prompt' && inputLabel && (
            <label style={{ display: 'block', marginBottom: 16 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
                {inputLabel}
              </span>
              <input
                ref={primaryRef}
                id="admin-dialog-primary"
                name="primary"
                type="text"
                aria-label={inputLabel}
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
                placeholder={inputPlaceholder}
                required={inputRequired}
                minLength={inputRequired ? minLength : undefined}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
            </label>
          )}
          {variant === 'prompt' && secondInputLabel && (
            <label style={{ display: 'block', marginBottom: 16 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
                {secondInputLabel}
              </span>
              <input
                id="admin-dialog-secondary"
                name="secondary"
                type="text"
                aria-label={secondInputLabel}
                onChange={(e) => setSecondary(e.target.value)}
                placeholder={secondInputPlaceholder}
                required={secondaryRequired}
                minLength={secondaryRequired ? secondaryMinLength : undefined}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
            </label>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '10px 16px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                background: 'white',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {cancelLabel}
            </button>
            <button
              type="submit"
              style={{
                padding: '10px 16px',
                border: 'none',
                borderRadius: 8,
                background: '#9c6649',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
