// StarRatingInput - Interactive star rating selection component
import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { motion } from 'framer-motion';

interface StarRatingInputProps {
  value: number;
  onChange: (rating: number) => void;
  size?: number;
  disabled?: boolean;
  showLabel?: boolean;
}

const ratingLabels: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
};

const StarRatingInput: React.FC<StarRatingInputProps> = ({
  value,
  onChange,
  size = 32,
  disabled = false,
  showLabel = true,
}) => {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  
  const displayValue = hoverValue ?? value;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
      <div 
        style={{ 
          display: 'flex', 
          gap: 4,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
        onMouseLeave={() => setHoverValue(null)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <motion.button
            key={star}
            type="button"
            onClick={() => !disabled && onChange(star)}
            onMouseEnter={() => !disabled && setHoverValue(star)}
            whileHover={!disabled ? { scale: 1.15 } : {}}
            whileTap={!disabled ? { scale: 0.95 } : {}}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: disabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            disabled={disabled}
            aria-label={`Rate ${star} stars`}
          >
            <Star
              size={size}
              fill={star <= displayValue ? '#fbbf24' : 'none'}
              color={star <= displayValue ? '#fbbf24' : '#d1d5db'}
              strokeWidth={1.5}
              style={{
                transition: 'all 0.15s ease',
                filter: star <= displayValue ? 'drop-shadow(0 1px 2px rgba(251,191,36,0.3))' : 'none',
              }}
            />
          </motion.button>
        ))}
      </div>
      
      {showLabel && displayValue > 0 && (
        <motion.span
          key={displayValue}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: displayValue >= 4 ? '#059669' : displayValue >= 3 ? '#d97706' : '#dc2626',
          }}
        >
          {ratingLabels[displayValue]}
        </motion.span>
      )}
    </div>
  );
};

export default StarRatingInput;
