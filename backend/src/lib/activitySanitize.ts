import { sanitizeString } from '../utils/sanitize';

const MAX_URL = 500;
const MAX_NAME = 200;
const MAX_EMAIL = 255;
const MAX_METADATA_BYTES = 2048;

const METADATA_ALLOWLIST = new Set([
  'query',
  'filters',
  'sortBy',
  'source',
  'step',
  'productId',
  'quantity',
  'size',
  'cartTotal',
  'itemCount',
  'orderTotal',
  'resultCount',
]);

export function sanitizeActivityPayload(input: {
  sessionId?: string;
  userEmail?: string;
  actionType?: string;
  entityType?: string;
  entityId?: string | number | null;
  entityName?: string;
  metadata?: Record<string, unknown>;
  pageUrl?: string;
  referrer?: string;
}) {
  const metadata: Record<string, unknown> = {};
  if (input.metadata && typeof input.metadata === 'object') {
    for (const [key, value] of Object.entries(input.metadata)) {
      if (!METADATA_ALLOWLIST.has(key)) continue;
      if (typeof value === 'string') {
        metadata[key] = sanitizeString(value).slice(0, 200);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        metadata[key] = value;
      }
    }
  }

  let metadataJson = JSON.stringify(metadata);
  if (Buffer.byteLength(metadataJson, 'utf8') > MAX_METADATA_BYTES) {
    metadataJson = '{}';
  }

  return {
    sessionId: input.sessionId ? sanitizeString(input.sessionId).slice(0, 64) : null,
    userEmail: null,
    entityType: input.entityType ? sanitizeString(input.entityType).slice(0, 50) : null,
    entityId: input.entityId != null ? sanitizeString(String(input.entityId)).slice(0, 64) : null,
    entityName: input.entityName ? sanitizeString(input.entityName).slice(0, MAX_NAME) : null,
    pageUrl: input.pageUrl ? sanitizeString(input.pageUrl).slice(0, MAX_URL) : null,
    referrer: input.referrer ? sanitizeString(input.referrer).slice(0, MAX_URL) : null,
    metadataJson,
  };
}
