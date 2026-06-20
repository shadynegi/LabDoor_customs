const MAX_VIDEO_URL_LENGTH = 2048;
/** Admin-uploaded MP4 data URLs — larger than product images. */
const DATA_URL_MAX_BYTES = 15 * 1024 * 1024;

export function validateOptionalProductVideo360Url(
  value: string | null | undefined,
  fieldName: string
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (!value || !value.trim()) {
    return { ok: true, value: null };
  }

  const trimmed = value.trim();

  if (trimmed.length > MAX_VIDEO_URL_LENGTH) {
    return { ok: false, error: `${fieldName} URL is too long` };
  }

  if (trimmed.startsWith('data:')) {
    if (!trimmed.startsWith('data:video/mp4')) {
      return { ok: false, error: `${fieldName} must be an MP4 video (data:video/mp4)` };
    }
    const base64Part = trimmed.split(',')[1] || '';
    const approxBytes = Math.ceil((base64Part.length * 3) / 4);
    if (approxBytes > DATA_URL_MAX_BYTES) {
      return {
        ok: false,
        error: `${fieldName} upload exceeds 15MB — use a hosted MP4 URL instead`,
      };
    }
    return { ok: true, value: trimmed };
  }

  if (trimmed.startsWith('/')) {
    if (!/\.mp4(\?|$)/i.test(trimmed)) {
      return { ok: false, error: `${fieldName} path must end with .mp4` };
    }
    return { ok: true, value: trimmed };
  }

  try {
    const url = new URL(trimmed);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { ok: false, error: `${fieldName} must be http(s) or a site path` };
    }
    if (!/\.mp4(\?|$)/i.test(url.pathname)) {
      return { ok: false, error: `${fieldName} URL must point to an .mp4 file` };
    }
    return { ok: true, value: trimmed };
  } catch {
    return { ok: false, error: `${fieldName} must be a valid URL or /assets path` };
  }
}
