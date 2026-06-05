import type { ReactNode } from 'react';

interface MobileStickyCtaProps {
  label: ReactNode;
  amount?: string;
  onClick: () => void;
  disabled?: boolean;
  secondaryLabel?: string;
  onSecondaryClick?: () => void;
}

export function MobileStickyCta({
  label,
  amount,
  onClick,
  disabled = false,
  secondaryLabel,
  onSecondaryClick,
}: MobileStickyCtaProps) {
  return (
    <div className="mobile-sticky-cta" role="region" aria-label="Checkout actions">
      {amount && (
        <div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>Total</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1f2937' }}>{amount}</div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flex: 1, justifyContent: amount ? 'flex-end' : 'stretch' }}>
        {secondaryLabel && onSecondaryClick && (
          <button
            type="button"
            onClick={onSecondaryClick}
            style={{
              padding: '12px 16px',
              background: 'white',
              color: '#374151',
              border: '2px solid #d1d5db',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {secondaryLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          style={{
            flex: amount ? 'none' : 1,
            padding: '12px 20px',
            minHeight: 44,
            background: disabled
              ? '#9ca3af'
              : 'linear-gradient(135deg, #361906 0%, #9c6649 100%)',
            color: 'white',
            border: 'none',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 700,
            cursor: disabled ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </button>
      </div>
    </div>
  );
}

export default MobileStickyCta;
