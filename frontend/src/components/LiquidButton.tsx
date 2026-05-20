// LiquidButton - A button wrapper with liquid glass effect
import React, { CSSProperties, ReactNode } from 'react';
import { LiquidWeb } from 'liquid-web/react';

interface LiquidButtonProps {
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void;
  children: ReactNode;
  style?: CSSProperties;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  'aria-label'?: string;
  active?: boolean;
  liquidOptions?: {
    scale?: number;
    blur?: number;
    saturation?: number;
    aberration?: number;
    mode?: 'standard' | 'polar' | 'prominent' | 'shader';
  };
}

const LiquidButton: React.FC<LiquidButtonProps> = ({
  onClick,
  onMouseEnter,
  onMouseLeave,
  children,
  style = {},
  disabled = false,
  type = 'button',
  className,
  'aria-label': ariaLabel,
  active = false,
  liquidOptions,
}) => {
  const defaultOptions = {
    scale: 18,
    blur: 3,
    saturation: 150,
    aberration: 40,
    mode: 'standard' as const,
  };

  const finalOptions = liquidOptions ? { ...defaultOptions, ...liquidOptions } : defaultOptions;

  return (
    <LiquidWeb
      options={finalOptions}
      selector="div"
    >
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={disabled ? undefined : onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          ...style,
          cursor: disabled ? 'not-allowed' : style.cursor || 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
        className={className}
        aria-label={ariaLabel}
        aria-disabled={disabled}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick?.(e as any);
          }
        }}
        {...(active ? { 'data-active': 'true' } : {})}
      >
        {children}
      </div>
    </LiquidWeb>
  );
};

export default LiquidButton;

