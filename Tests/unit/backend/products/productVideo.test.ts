import { describe, it, expect } from 'vitest';
import { validateOptionalProductVideo360Url } from '../../../../backend/src/lib/productVideo';

describe('productVideo validation', () => {
  it('accepts empty optional video', () => {
    expect(validateOptionalProductVideo360Url('', '360° video')).toEqual({
      ok: true,
      value: null,
    });
  });

  it('accepts hosted mp4 URL', () => {
    const result = validateOptionalProductVideo360Url(
      'https://cdn.example.com/spin.mp4',
      '360° video'
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain('.mp4');
    }
  });

  it('rejects non-mp4 data URL', () => {
    const result = validateOptionalProductVideo360Url(
      'data:video/webm;base64,abc',
      '360° video'
    );
    expect(result.ok).toBe(false);
  });
});
