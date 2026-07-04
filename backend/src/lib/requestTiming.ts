import type { Request } from 'express';

const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || '60000', 10);
const SLOW_REQUEST_TIMEOUT_MS = parseInt(
  process.env.SLOW_REQUEST_TIMEOUT_MS ||
    process.env.CATALOG_REQUEST_TIMEOUT_MS ||
    '180000',
  10
);

/** Path without query string — stable for logs after Express routing. */
export function getRequestPath(req: Pick<Request, 'originalUrl' | 'path'>): string {
  const fromOriginal = req.originalUrl?.split('?')[0];
  return fromOriginal && fromOriginal.length > 0 ? fromOriginal : req.path;
}

function isCatalogReadPath(path: string, method: string): boolean {
  if (method !== 'GET') return false;
  if (
    path === '/api/products' ||
    path === '/api/products/filters' ||
    path === '/api/products/sitemap-urls'
  ) {
    return true;
  }
  return /^\/api\/products\/[^/]+$/.test(path);
}

export function isSlowApiRequest(req: Pick<Request, 'method' | 'originalUrl' | 'path'>): boolean {
  const path = getRequestPath(req);
  if (isCatalogReadPath(path, req.method)) return true;
  if (path === '/api/admin/analytics') return true;
  if (path === '/api/activity/batch' || path === '/api/activity/log') return true;
  return false;
}

export function getRequestTimeoutMs(req: Pick<Request, 'method' | 'originalUrl' | 'path'>): number {
  return isSlowApiRequest(req) ? SLOW_REQUEST_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
}

export function getDefaultRequestTimeoutMs(): number {
  return REQUEST_TIMEOUT_MS;
}

export function getSlowRequestTimeoutMs(): number {
  return SLOW_REQUEST_TIMEOUT_MS;
}
