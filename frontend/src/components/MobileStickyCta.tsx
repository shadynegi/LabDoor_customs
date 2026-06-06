import type { CSSProperties, ReactNode } from 'react';

interface MobileStickyCtaProps {
  label: ReactNode;
  amount?: string;
  onClick: () => void;
  disabled?: boolean;
  secondaryLabel?: string;
  onSecondaryClick?: () => void;
  keyboardOffset?: number;
  ariaLabel?: string;
  /** Stack buttons vertically on narrow screens (cart page) */
  stacked?: boolean;
}

export function MobileStickyCta({
  label,
  amount,
  onClick,
  disabled = false,
  secondaryLabel,
  onSecondaryClick,
  keyboardOffset = 0,
  ariaLabel = 'Checkout actions',
  stacked = false,
}: MobileStickyCtaProps) {
  const wrapperStyle: CSSProperties = {
    bottom: keyboardOffset > 0 ? keyboardOffset : undefined,
    transform: keyboardOffset > 0 ? `translateY(-${keyboardOffset}px)` : undefined,
  };

  return (
    <div
      className={`mobile-sticky-cta${stacked ? ' mobile-sticky-cta--stacked' : ''}`}
      style={wrapperStyle}
      role="region"
      aria-label={ariaLabel}
    >
      {amount && (
        <div className="mobile-sticky-cta__total">
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>Total</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1f2937' }}>{amount}</div>
        </div>
      )}
      <div className="mobile-sticky-cta__actions">
        {secondaryLabel && onSecondaryClick && (
          <button
            type="button"
            onClick={onSecondaryClick}
            aria-label={secondaryLabel === 'Continue Shopping' ? 'Continue shopping' : secondaryLabel}
            className="mobile-sticky-cta__secondary"
          >
            {secondaryLabel === 'Continue Shopping' && stacked ? 'Shop' : secondaryLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className="mobile-sticky-cta__primary"
          style={{
            flex: amount && !stacked ? 'none' : 1,
            background: disabled
              ? '#9ca3af'
              : 'linear-gradient(135deg, #361906 0%, #9c6649 100%)',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {label}
        </button>
      </div>
    </div>
  );
}

export default MobileStickyCta;
