// LiquidModal - A modal wrapper with liquid glass effect
import { type ReactNode, type CSSProperties, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LiquidWeb } from 'liquid-web/react';

interface LiquidModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number | string;
  className?: string;
  contentStyle?: CSSProperties;
  overlayStyle?: CSSProperties;
  /** Accessible name for the dialog (required for screen readers when no visible title) */
  ariaLabel?: string;
  /** Skip LiquidWeb glass effect — use for forms with many controls (better FPS on mobile) */
  plain?: boolean;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const LiquidModal: React.FC<LiquidModalProps> = ({
  isOpen,
  onClose,
  children,
  maxWidth = 500,
  className = '',
  contentStyle = {},
  overlayStyle = {},
  ariaLabel = 'Dialog',
  plain = false,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const dialog = dialogRef.current;
    const focusables = dialog
      ? Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      : [];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    const focusTimer = window.setTimeout(() => first?.focus(), 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || focusables.length === 0) return;

      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
      } else if (document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  const panelInner = (
    <div
      style={
        plain
          ? {
              background: '#ffffff',
              borderRadius: 20,
              padding: 'clamp(16px, 4vw, 32px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
              border: '1px solid #e5e7eb',
            }
          : {
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: 20,
              padding: 'clamp(16px, 4vw, 32px)',
              boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
            }
      }
    >
      {children}
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: plain ? 0.15 : 0.2 }}
          onClick={onClose}
          role="presentation"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: plain ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0,0,0,0.5)',
            backdropFilter: plain ? undefined : 'blur(8px)',
            WebkitBackdropFilter: plain ? undefined : 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))',
            ...overlayStyle,
          }}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            initial={plain ? { opacity: 0, y: 12 } : { scale: 0.9, y: 20 }}
            animate={plain ? { opacity: 1, y: 0 } : { scale: 1, y: 0 }}
            exit={plain ? { opacity: 0, y: 12 } : { scale: 0.9, y: 20 }}
            transition={{ duration: plain ? 0.15 : 0.2 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              position: 'relative',
              ...contentStyle,
            }}
            className={className}
          >
            {plain ? (
              panelInner
            ) : (
              <LiquidWeb
                options={{
                  scale: 25,
                  blur: 4,
                  saturation: 180,
                  aberration: 60,
                  mode: 'prominent',
                }}
              >
                {panelInner}
              </LiquidWeb>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LiquidModal;
