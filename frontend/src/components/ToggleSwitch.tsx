import type { KeyboardEvent } from 'react';

export interface ToggleSwitchProps {
  /** When true, switch is ON (thumb right, green track). */
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  loading?: boolean;
  id?: string;
  /** Visible state text shown beside the switch (not color-only). */
  label?: string;
  ariaLabel?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export default function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  loading = false,
  id,
  label,
  ariaLabel,
  size = 'md',
  className = '',
}: ToggleSwitchProps) {
  const isDisabled = disabled || loading;

  const handleToggle = () => {
    if (isDisabled) return;
    onChange(!checked);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (isDisabled) return;
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      onChange(!checked);
    }
  };

  const stateText = label ?? (checked ? 'Out of stock' : 'In stock');

  return (
    <div className={`toggle-switch toggle-switch--${size} ${className}`.trim()}>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel ?? `Out of stock: ${checked ? 'on' : 'off'}`}
        aria-busy={loading || undefined}
        disabled={isDisabled}
        className={`toggle-switch__control${loading ? ' toggle-switch__control--loading' : ''}`}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
      >
        <span className="toggle-switch__thumb" aria-hidden="true" />
      </button>
      <span
        className={`toggle-switch__label${checked ? ' toggle-switch__label--on' : ''}`}
        aria-hidden="true"
      >
        {stateText}
      </span>
    </div>
  );
}
