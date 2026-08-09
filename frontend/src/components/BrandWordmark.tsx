// src/components/BrandWordmark.tsx
import type { CSSProperties, MouseEventHandler } from 'react';

interface BrandWordmarkProps {
  /** Rendered height in px (width scales to preserve aspect ratio). */
  height?: number;
  /**
   * Color of the wordmark. Defaults to `currentColor` so it inherits the
   * parent's text color — pass `var(--color-text-primary)` to have it flip
   * with the light/dark theme, or `#fff` to force white on a dark surface.
   */
  color?: string;
  style?: CSSProperties;
  className?: string;
  /** Accessible label / tooltip. */
  title?: string;
  onMouseEnter?: MouseEventHandler<SVGSVGElement>;
  onMouseLeave?: MouseEventHandler<SVGSVGElement>;
}

/**
 * "LABDOOR CUSTOMS" wordmark, drawn as inline SVG text so it stays crisp at
 * any size and adapts to the active theme via `currentColor` — no separate
 * light/dark raster assets required. Two-line lockup: LABDOOR over a spaced
 * CUSTOMS subline.
 */
export default function BrandWordmark({
  height = 48,
  color = 'currentColor',
  style,
  className,
  title = 'Lab Door Customs',
  onMouseEnter,
  onMouseLeave,
}: BrandWordmarkProps) {
  // viewBox aspect ratio 420:120 (3.5:1) — width derives from height.
  const width = (height * 420) / 120;
  const fontStack =
    "'Helvetica Neue', 'Segoe UI', Arial, sans-serif";

  return (
    <svg
      viewBox="0 0 420 120"
      width={width}
      height={height}
      role="img"
      aria-label={title}
      className={className}
      style={{ display: 'block', color, ...style }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <title>{title}</title>
      <text
        x="210"
        y="56"
        textAnchor="middle"
        fill="currentColor"
        style={{
          fontFamily: fontStack,
          fontSize: 46,
          fontWeight: 300,
          letterSpacing: 6,
        }}
      >
        LABDOOR
      </text>
      <text
        x="210"
        y="94"
        textAnchor="middle"
        fill="currentColor"
        style={{
          fontFamily: fontStack,
          fontSize: 20,
          fontWeight: 400,
          letterSpacing: 15,
        }}
      >
        CUSTOMS
      </text>
    </svg>
  );
}
