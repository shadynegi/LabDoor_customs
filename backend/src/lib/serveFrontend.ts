import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';

function resolveFrontendDist(): string {
  const candidates = [
    process.env.FRONTEND_DIST_PATH?.trim(),
    path.resolve(__dirname, '../../frontend/dist'),
    path.resolve(__dirname, '../../../frontend/dist'),
    path.resolve(process.cwd(), 'frontend/dist'),
    path.resolve(process.cwd(), '../frontend/dist'),
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.html'))) {
      return dir;
    }
  }

  return candidates[0] || path.resolve(process.cwd(), 'frontend/dist');
}

export function getFrontendDistPath(): string {
  return resolveFrontendDist();
}

export function isFrontendDistAvailable(): boolean {
  return fs.existsSync(path.join(getFrontendDistPath(), 'index.html'));
}

export function shouldServeFrontend(): boolean {
  if (process.env.SERVE_FRONTEND === 'false') return false;
  if (process.env.SERVE_FRONTEND === 'true') {
    return isFrontendDistAvailable();
  }
  if (process.env.NODE_ENV === 'production') {
    return isFrontendDistAvailable();
  }
  return false;
}

/**
 * Serve Vite build output and SPA fallback. Mount after all /api routes.
 * Returns true when static hosting is active.
 */
export function mountFrontend(app: Express, isProduction: boolean): boolean {
  if (!shouldServeFrontend()) {
    if (process.env.SERVE_FRONTEND === 'true' && !isFrontendDistAvailable()) {
      logger.warn('SERVE_FRONTEND=true but frontend/dist/index.html was not found');
    }
    return false;
  }

  const dist = getFrontendDistPath();
  logger.info({ dist }, 'Serving storefront static files');

  app.use(
    express.static(dist, {
      index: false,
      maxAge: isProduction ? '1d' : 0,
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    })
  );

  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(dist, 'index.html'), (err) => {
      if (err) next(err);
    });
  });

  return true;
}
