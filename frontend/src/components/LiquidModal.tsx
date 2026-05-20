// LiquidModal - A modal wrapper with liquid glass effect
import React, { ReactNode, CSSProperties } from 'react';
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
}

const LiquidModal: React.FC<LiquidModalProps> = ({
  isOpen,
  onClose,
  children,
  maxWidth = 500,
  className = '',
  contentStyle = {},
  overlayStyle = {},
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            ...overlayStyle,
          }}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
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
            <LiquidWeb
              options={{
                scale: 25,
                blur: 4,
                saturation: 180,
                aberration: 60,
                mode: 'prominent',
              }}
            >
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: 20,
                  padding: 32,
                  boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
                }}
              >
                {children}
              </div>
            </LiquidWeb>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LiquidModal;

