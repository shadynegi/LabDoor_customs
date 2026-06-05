import type { CSSProperties } from 'react';
import { BREAKPOINTS } from '../hooks/useResponsive';

/** Viewport widths used for responsive QA (common phones). */
export const MOBILE_DEVICE_WIDTHS = {
  iphoneSE: 320,
  galaxyS21: 360,
  iphoneSE3: 375,
  iphone14: 390,
  iphone15Pro: 393,
  pixel7: 412,
  galaxyA54: 412,
  iphone14ProMax: 430,
  largePhone: 480,
  tablet: BREAKPOINTS.mobile,
} as const;

export function gridCols(
  isMobile: boolean,
  mobile: string,
  desktop: string
): string {
  return isMobile ? mobile : desktop;
}

export function pagePadding(isMobile: boolean): CSSProperties {
  return {
    paddingLeft: isMobile ? 'max(12px, env(safe-area-inset-left))' : 24,
    paddingRight: isMobile ? 'max(12px, env(safe-area-inset-right))' : 24,
  };
}

export function stickyMobileCtaSpacer(isMobile: boolean): CSSProperties {
  return isMobile
    ? { paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }
    : {};
}
