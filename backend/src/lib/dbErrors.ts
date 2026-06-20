/** Postgres connection errors worth retrying (transient pool/network). */
const RETRYABLE_PG_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'CONNECT_TIMEOUT',
  'CONNECTION_ENDED',
  '57P01', // admin_shutdown
  '57P03', // cannot_connect_now
  '08006', // connection_failure
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '57014', // query_canceled (statement timeout)
]);

/** Transient pool/network/DNS failures (sleep, Wi‑Fi drop, pooler blip). */
export function isTransientDbError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const err = error as Error & { code?: string; errno?: string | number };
  const code = err.code ?? (typeof err.errno === 'string' ? err.errno : undefined);
  if (code && (RETRYABLE_PG_CODES.has(code) || RETRYABLE_PG_CODES.has(String(err.errno)))) {
    return true;
  }

  const msg = err.message;
  return (
    msg.includes('ECONNRESET') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('EAI_AGAIN') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('CONNECT_TIMEOUT') ||
    msg.includes('getaddrinfo') ||
    msg.includes('57P01') ||
    msg.includes('57P03') ||
    msg.includes('08006') ||
    msg.includes('08001') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('Connection terminated') ||
    msg.includes('CONNECTION_ENDED') ||
    msg.includes('statement timeout') ||
    msg.includes('timed out')
  );
}
