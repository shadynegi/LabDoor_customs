// StarRating component for displaying product ratings
import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number; // 0-5
  reviewCount?: number;
  size?: number;
  showCount?: boolean;
}

const StarRating: React.FC<StarRatingProps> = ({ 
  rating, 
  reviewCount = 0, 
  size = 16,
  showCount = true 
}) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ display: 'flex', gap: 2 }}>
        {/* Full stars */}
        {Array.from({ length: fullStars }).map((_, i) => (
          <Star
            key={`full-${i}`}
            size={size}
            fill="#fbbf24"
            color="#fbbf24"
            strokeWidth={1.5}
          />
        ))}
        
        {/* Half star */}
        {hasHalfStar && (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <Star
              size={size}
              fill="none"
              color="#e5e7eb"
              strokeWidth={1.5}
            />
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '50%',
              overflow: 'hidden'
            }}>
              <Star
                size={size}
                fill="#fbbf24"
                color="#fbbf24"
                strokeWidth={1.5}
              />
            </div>
          </div>
        )}
        
        {/* Empty stars */}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <Star
            key={`empty-${i}`}
            size={size}
            fill="none"
            color="#e5e7eb"
            strokeWidth={1.5}
          />
        ))}
      </div>
      
      {showCount && (
        <span style={{ 
          fontSize: size * 0.875, 
          color: '#6b7280',
          fontWeight: 500,
          marginLeft: 4
        }}>
          {rating.toFixed(1)} {reviewCount > 0 && `(${reviewCount})`}
        </span>
      )}
    </div>
  );
};

export default StarRating;

