import type { CSSProperties } from 'react';

/** Full viewport min-height — prefers dynamic viewport on mobile (iOS Safari). */
export const MIN_HEIGHT_SCREEN = '100dvh' as const;

export function gridCols(
  isMobile: boolean,
  mobile: string,
  desktop: string
): string {
  return isMobile ? mobile : desktop;
}

/** Horizontal padding that respects safe-area insets (notch / home indicator sides). */
export function safeHorizontalPad(): CSSProperties {
  return {
    paddingLeft: 'max(var(--page-padding-x), env(safe-area-inset-left, 0px))',
    paddingRight: 'max(var(--page-padding-x), env(safe-area-inset-right, 0px))',
  };
}

/** Sticky storefront header — clears Dynamic Island / notch. */
export function stickyHeaderPad(isMobile: boolean): CSSProperties {
  return {
    paddingTop: isMobile
      ? 'max(10px, env(safe-area-inset-top, 0px))'
      : 'max(16px, env(safe-area-inset-top, 0px))',
    paddingLeft: isMobile
      ? 'max(12px, env(safe-area-inset-left, 0px))'
      : 'max(24px, env(safe-area-inset-left, 0px))',
    paddingRight: isMobile
      ? 'max(12px, env(safe-area-inset-right, 0px))'
      : 'max(24px, env(safe-area-inset-right, 0px))',
  };
}
