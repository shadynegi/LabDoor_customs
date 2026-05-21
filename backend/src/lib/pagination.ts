import type { Request } from 'express';

export const MAX_PAGE_LIMIT = 100;
export const DEFAULT_PAGE_LIMIT = 20;

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

type PaginationResult =
  | { ok: true; params: PaginationParams }
  | { ok: false; status: number; error: string };

function parsePositiveInt(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Parse page + limit query params. Rejects ?limit>100 before clamping.
 */
export function parsePagination(query: Request['query']): PaginationResult {
  const rawLimit = query.limit;

  if (rawLimit !== undefined && rawLimit !== '') {
    const requested = parseInt(String(rawLimit), 10);
    if (Number.isNaN(requested) || requested < 1) {
      return { ok: false, status: 400, error: 'Invalid limit parameter' };
    }
    if (requested > MAX_PAGE_LIMIT) {
      return {
        ok: false,
        status: 400,
        error: `limit must not exceed ${MAX_PAGE_LIMIT}`,
      };
    }
  }

  const limit = Math.min(
    MAX_PAGE_LIMIT,
    Math.max(1, parsePositiveInt(rawLimit, DEFAULT_PAGE_LIMIT))
  );

  const page = Math.max(1, parsePositiveInt(query.page, 1));
  const rawOffset = query.offset;
  const offset =
    rawOffset !== undefined && rawOffset !== ''
      ? Math.max(0, parseInt(String(rawOffset), 10) || 0)
      : (page - 1) * limit;

  return { ok: true, params: { page, limit, offset } };
}

export function paginationMeta(total: number, params: PaginationParams) {
  const totalPages = Math.max(1, Math.ceil(total / params.limit));
  return {
    page: params.page,
    limit: params.limit,
    offset: params.offset,
    total,
    totalPages,
    hasMore: params.page < totalPages,
  };
}
