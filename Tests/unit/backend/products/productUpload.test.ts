import { describe, expect, it } from 'vitest';
import {
  buildUploadedMediaUrls,
  publicUploadPath,
  safeUploadExtension,
} from '../../../../backend/src/lib/productUpload';

describe('productUpload helpers', () => {
  it('maps MIME types to safe extensions', () => {
    expect(safeUploadExtension('photo.jpg', 'image/jpeg')).toBe('.jpg');
    expect(safeUploadExtension('photo.jpeg', 'image/jpeg')).toBe('.jpg');
    expect(safeUploadExtension('unknown', 'image/png')).toBe('.png');
    expect(safeUploadExtension('clip.bin', 'video/mp4')).toBe('.mp4');
  });

  it('builds public upload paths', () => {
    expect(publicUploadPath('abc.png')).toBe('/uploads/products/abc.png');
  });

  it('returns uploaded field URLs', () => {
    const result = buildUploadedMediaUrls({
      image: [
        {
          fieldname: 'image',
          originalname: 'shoe.png',
          encoding: '7bit',
          mimetype: 'image/png',
          destination: '/tmp',
          filename: 'uuid.png',
          path: '/tmp/uuid.png',
          size: 100,
        } as Express.Multer.File,
      ],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.urls.image).toBe('/uploads/products/uuid.png');
    }
  });

  it('rejects empty uploads', () => {
    expect(buildUploadedMediaUrls(undefined).ok).toBe(false);
    expect(buildUploadedMediaUrls({}).ok).toBe(false);
  });
});
