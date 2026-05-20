// hooks/useTouchGestures.ts
// Custom hook for touch gesture support (swipe, pan)

import { useState, useRef, useCallback } from 'react';

interface TouchState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isDragging: boolean;
  direction: 'left' | 'right' | 'up' | 'down' | null;
}

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

interface UseTouchGesturesOptions extends SwipeHandlers {
  threshold?: number; // Minimum distance to trigger swipe (default: 50px)
  preventScroll?: boolean; // Prevent vertical scroll during horizontal swipe
}

interface UseTouchGesturesReturn {
  touchState: TouchState;
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseUp: (e: React.MouseEvent) => void;
    onMouseLeave: (e: React.MouseEvent) => void;
  };
  deltaX: number;
  deltaY: number;
}

const initialTouchState: TouchState = {
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  isDragging: false,
  direction: null,
};

export function useTouchGestures(
  options: UseTouchGesturesOptions = {}
): UseTouchGesturesReturn {
  const {
    threshold = 50,
    preventScroll = false,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
  } = options;

  const [touchState, setTouchState] = useState<TouchState>(initialTouchState);
  const touchStartTime = useRef<number>(0);

  const handleStart = useCallback((x: number, y: number) => {
    touchStartTime.current = Date.now();
    setTouchState({
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
      isDragging: true,
      direction: null,
    });
  }, []);

  const handleMove = useCallback((x: number, y: number) => {
    setTouchState(prev => {
      if (!prev.isDragging) return prev;

      const deltaX = x - prev.startX;
      const deltaY = y - prev.startY;
      
      // Determine direction based on dominant axis
      let direction: TouchState['direction'] = null;
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        direction = deltaX > 0 ? 'right' : 'left';
      } else {
        direction = deltaY > 0 ? 'down' : 'up';
      }

      return {
        ...prev,
        currentX: x,
        currentY: y,
        direction,
      };
    });
  }, []);

  const handleEnd = useCallback(() => {
    setTouchState(prev => {
      if (!prev.isDragging) return initialTouchState;

      const deltaX = prev.currentX - prev.startX;
      const deltaY = prev.currentY - prev.startY;
      const duration = Date.now() - touchStartTime.current;

      // Calculate velocity (pixels per ms)
      const velocityX = Math.abs(deltaX) / duration;
      const velocityY = Math.abs(deltaY) / duration;

      // Lower threshold for fast swipes
      const effectiveThreshold = (velocityX > 0.5 || velocityY > 0.5) 
        ? threshold / 2 
        : threshold;

      // Trigger swipe handlers
      if (Math.abs(deltaX) > effectiveThreshold && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 0 && onSwipeRight) {
          onSwipeRight();
        } else if (deltaX < 0 && onSwipeLeft) {
          onSwipeLeft();
        }
      } else if (Math.abs(deltaY) > effectiveThreshold) {
        if (deltaY > 0 && onSwipeDown) {
          onSwipeDown();
        } else if (deltaY < 0 && onSwipeUp) {
          onSwipeUp();
        }
      }

      return initialTouchState;
    });
  }, [threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  // Touch event handlers
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY);
  }, [handleStart]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);

    // Prevent vertical scroll during horizontal swipe
    if (preventScroll && touchState.direction && 
        (touchState.direction === 'left' || touchState.direction === 'right')) {
      e.preventDefault();
    }
  }, [handleMove, preventScroll, touchState.direction]);

  const onTouchEnd = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  // Mouse event handlers (for desktop)
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    handleStart(e.clientX, e.clientY);
  }, [handleStart]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (touchState.isDragging) {
      handleMove(e.clientX, e.clientY);
    }
  }, [touchState.isDragging, handleMove]);

  const onMouseUp = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  const onMouseLeave = useCallback(() => {
    if (touchState.isDragging) {
      handleEnd();
    }
  }, [touchState.isDragging, handleEnd]);

  const deltaX = touchState.currentX - touchState.startX;
  const deltaY = touchState.currentY - touchState.startY;

  return {
    touchState,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onMouseLeave,
    },
    deltaX,
    deltaY,
  };
}

// Simpler hook for just detecting swipes
export function useSwipe(handlers: SwipeHandlers, threshold = 50) {
  return useTouchGestures({ ...handlers, threshold });
}
