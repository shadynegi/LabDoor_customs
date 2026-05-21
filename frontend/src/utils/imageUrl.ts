export interface OptimizeImageOptions {
  width?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'origin';
}

/**
 * Append Supabase Storage transform params when URL is hosted on supabase.co.
 * Local / bundled assets are returned unchanged.
 */
export function optimizeImageUrl(
  src: string,
  options: OptimizeImageOptions = {}
): string {
  if (!src || src.startsWith('data:') || src.startsWith('blob:')) {
    return src;
  }

  const isSupabase =
    src.includes('.supabase.co/storage/') || src.includes('supabase.co/storage/v1/object/');

  if (!isSupabase) {
    return src;
  }

  const width = options.width ?? 800;
  const quality = options.quality ?? 80;
  const format = options.format ?? 'webp';

  try {
    const url = new URL(src);
    url.searchParams.set('width', String(width));
    url.searchParams.set('quality', String(quality));
    url.searchParams.set('format', format);
    return url.toString();
  } catch {
    return src;
  }
}
