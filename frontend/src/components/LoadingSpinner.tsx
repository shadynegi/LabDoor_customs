// Loading spinner component
import { motion } from 'framer-motion';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
}

export default function LoadingSpinner({ size = 'medium', message }: LoadingSpinnerProps) {
  const sizeMap = {
    small: 30,
    medium: 50,
    large: 70,
  };

  const spinnerSize = sizeMap[size];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '300px',
        gap: '20px',
      }}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: 'linear',
        }}
        style={{
          width: spinnerSize,
          height: spinnerSize,
          border: '4px solid var(--color-border)',
          borderTopColor: '#9c6649',
          borderRadius: '50%',
        }}
      />
      {message && (
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, fontWeight: 500 }}>
          {message}
        </p>
      )}
    </div>
  );
}

