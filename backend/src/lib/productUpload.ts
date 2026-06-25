import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer, { type MulterError } from 'multer';
import type { Request, Response, NextFunction } from 'express';

export const IMAGE_MAX_BYTES = 20 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 15 * 1024 * 1024;

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif']);

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'video/mp4': '.mp4',
};

export function getUploadRoot(): string {
  const env = process.env.UPLOAD_DIR?.trim();
  if (env) return path.resolve(env);
  return path.resolve(process.cwd(), 'uploads');
}

export function getProductsUploadDir(): string {
  return path.join(getUploadRoot(), 'products');
}

export function ensureUploadDirs(): void {
  fs.mkdirSync(getProductsUploadDir(), { recursive: true });
}

export function publicUploadPath(filename: string): string {
  return `/uploads/products/${filename}`;
}

export function safeUploadExtension(originalname: string, mimetype: string): string {
  const fromName = path.extname(originalname).toLowerCase();
  if (IMAGE_EXTENSIONS.has(fromName) || fromName === '.mp4') {
    return fromName === '.jpeg' ? '.jpg' : fromName;
  }
  return MIME_TO_EXT[mimetype] || '';
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    ensureUploadDirs();
    cb(null, getProductsUploadDir());
  },
  filename(_req, file, cb) {
    const ext = safeUploadExtension(file.originalname, file.mimetype);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const productMediaUpload = multer({
  storage,
  limits: { fileSize: IMAGE_MAX_BYTES },
  fileFilter(_req, file, cb) {
    if (file.fieldname === 'video_360') {
      if (file.mimetype === 'video/mp4') {
        cb(null, true);
        return;
      }
      cb(new Error('360° video must be MP4'));
      return;
    }
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
      return;
    }
    cb(new Error('Only image files are allowed for image and background fields'));
  },
});

export const productMediaFields = productMediaUpload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'background', maxCount: 1 },
  { name: 'video_360', maxCount: 1 },
]);

export function handleProductMediaUpload(req: Request, res: Response, next: NextFunction): void {
  productMediaFields(req, res, (err: unknown) => {
    if (err) {
      const multerErr = err as MulterError;
      if (multerErr.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          success: false,
          error: `File too large (images max ${IMAGE_MAX_BYTES / (1024 * 1024)}MB, video max ${VIDEO_MAX_BYTES / (1024 * 1024)}MB)`,
        });
        return;
      }
      const message = err instanceof Error ? err.message : 'Upload failed';
      res.status(400).json({ success: false, error: message });
      return;
    }
    next();
  });
}

export function buildUploadedMediaUrls(
  files: Record<string, Express.Multer.File[]> | undefined
): { ok: true; urls: Record<string, string> } | { ok: false; error: string } {
  if (!files || Object.keys(files).length === 0) {
    return { ok: false, error: 'No files uploaded' };
  }

  const urls: Record<string, string> = {};

  for (const field of ['image', 'background', 'video_360'] as const) {
    const file = files[field]?.[0];
    if (!file) continue;

    if (field === 'video_360' && file.size > VIDEO_MAX_BYTES) {
      try {
        fs.unlinkSync(file.path);
      } catch {
        /* ignore cleanup errors */
      }
      return {
        ok: false,
        error: `360° video exceeds ${VIDEO_MAX_BYTES / (1024 * 1024)}MB`,
      };
    }

    urls[field] = publicUploadPath(file.filename);
  }

  if (Object.keys(urls).length === 0) {
    return { ok: false, error: 'No valid files uploaded' };
  }

  return { ok: true, urls };
}
