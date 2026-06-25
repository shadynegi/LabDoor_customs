/** Legacy JSON base64 uploads — matches express.json 1MB body limit. Use Multer for larger files. */
export const DATA_URL_MAX_BYTES = 1 * 1024 * 1024;

const MAX_IMAGE_URL_LENGTH = 2048;

export function validateProductImageUrl(
  value: string | null | undefined,
  fieldName: string
): { ok: true; value: string } | { ok: false; error: string } {
  if (!value || !value.trim()) {
    return { ok: false, error: `${fieldName} is required` };
  }

  const trimmed = value.trim();

  if (trimmed.startsWith('data:')) {
    if (!trimmed.startsWith('data:image/')) {
      return { ok: false, error: `${fieldName} must be an image data URL` };
    }
    const base64Part = trimmed.split(',')[1] || '';
    const approxBytes = Math.ceil((base64Part.length * 3) / 4);
    if (approxBytes > DATA_URL_MAX_BYTES) {
      return {
        ok: false,
        error: `${fieldName} data URL exceeds 1MB — use file upload or a hosted image URL instead`,
      };
    }
    return { ok: true, value: trimmed };
  }

  if (trimmed.length > MAX_IMAGE_URL_LENGTH) {
    return { ok: false, error: `${fieldName} URL is too long` };
  }

  if (trimmed.startsWith('/')) {
    return { ok: true, value: trimmed };
  }

  try {
    const url = new URL(trimmed);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { ok: false, error: `${fieldName} must be http(s) or a site path` };
    }
    return { ok: true, value: trimmed };
  } catch {
    return { ok: false, error: `${fieldName} must be a valid URL or /assets path` };
  }
}

export function validateOptionalProductImageUrl(
  value: string | null | undefined,
  fieldName: string
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (!value || !value.trim()) {
    return { ok: true, value: null };
  }
  const result = validateProductImageUrl(value, fieldName);
  if (!result.ok) return result;
  return { ok: true, value: result.value };
}
