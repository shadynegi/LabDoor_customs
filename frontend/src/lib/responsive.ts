export function gridCols(
  isMobile: boolean,
  mobile: string,
  desktop: string
): string {
  return isMobile ? mobile : desktop;
}
