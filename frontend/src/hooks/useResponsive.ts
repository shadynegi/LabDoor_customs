// useResponsive.ts - Responsive breakpoints hook for consistent mobile/tablet/desktop handling
import { useState, useEffect } from 'react';

export interface ResponsiveState {
  isMobile: boolean;      // < 768px
  isTablet: boolean;      // 768px - 1024px
  isDesktop: boolean;     // > 1024px
  isSmallMobile: boolean; // < 375px (iPhone SE, small Android)
  width: number;
  height: number;
}

// Breakpoint constants
export const BREAKPOINTS = {
  smallMobile: 375,
  mobile: 768,
  tablet: 1024,
  desktop: 1280,
} as const;

/**
 * Hook for responsive design with multiple breakpoints
 * @returns ResponsiveState object with boolean flags for each breakpoint
 */
export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(() => {
    const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const height = typeof window !== 'undefined' ? window.innerHeight : 768;
    
    return {
      isMobile: width < BREAKPOINTS.mobile,
      isTablet: width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet,
      isDesktop: width >= BREAKPOINTS.tablet,
      isSmallMobile: width < BREAKPOINTS.smallMobile,
      width,
      height,
    };
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setState({
        isMobile: width < BREAKPOINTS.mobile,
        isTablet: width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet,
        isDesktop: width >= BREAKPOINTS.tablet,
        isSmallMobile: width < BREAKPOINTS.smallMobile,
        width,
        height,
      });
    };

    // Debounce resize handler for performance
    let timeoutId: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, 100);
    };

    window.addEventListener('resize', debouncedResize);
    
    // Initial check
    handleResize();
    
    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(timeoutId);
    };
  }, []);

  return state;
}

/**
 * Get responsive value based on breakpoint
 * @param mobile - Value for mobile screens
 * @param tablet - Value for tablet screens (optional, defaults to desktop)
 * @param desktop - Value for desktop screens
 */
export function getResponsiveValue<T>(
  responsive: ResponsiveState,
  mobile: T,
  tablet: T | undefined,
  desktop: T
): T {
  if (responsive.isMobile) return mobile;
  if (responsive.isTablet) return tablet !== undefined ? tablet : desktop;
  return desktop;
}

/**
 * CSS clamp-like function for responsive values
 * @param min - Minimum value
 * @param preferred - Preferred value (usually viewport-based)
 * @param max - Maximum value
 */
export function responsiveClamp(min: number, preferred: number, max: number): number {
  return Math.max(min, Math.min(preferred, max));
}

export default useResponsive;
