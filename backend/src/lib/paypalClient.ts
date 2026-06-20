import { withRetry } from './db';
import { logger } from './logger';

export const PAYPAL_API =
  process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

const PAYPAL_HTTP_TIMEOUT_MS = parseInt(process.env.PAYPAL_HTTP_TIMEOUT_MS || '10000', 10);

let cachedPayPalToken: { token: string; expiresAt: number } | null = null;

interface PayPalAuthResponse {
  access_token: string;
  expires_in?: number;
}

/** PayPal HTTP with AbortController timeout (10s default). */
export async function paypalFetch(
  url: string,
  init: RequestInit = {}
): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PAYPAL_HTTP_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('PayPal request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function parseJson<T = unknown>(res: globalThis.Response): Promise<T> {
  return (await res.json()) as T;
}

async function fetchPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID || '';
  const secret = process.env.PAYPAL_SECRET || '';
  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');

  const response = await paypalFetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errorData = await response.text();
    logger.error('PayPal Auth Error:', errorData);
    throw new Error(`PayPal Auth Failed: ${response.status}`);
  }

  const data = await parseJson<PayPalAuthResponse>(response);
  if (!data.access_token) throw new Error('No access token returned from PayPal');

  cachedPayPalToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 32400) * 1000,
  };

  return data.access_token;
}

export async function getPayPalAccessToken(): Promise<string> {
  if (cachedPayPalToken && cachedPayPalToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedPayPalToken.token;
  }

  return withRetry(fetchPayPalAccessToken, { retries: 3, baseMs: 200 });
}

export async function verifyPayPalWebhookSignature(
  webhookEvent: Record<string, unknown>,
  headers: Record<string, string | string[] | undefined>
): Promise<{ verified: boolean; error?: string }> {
  try {
    const accessToken = await getPayPalAccessToken();
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
      return { verified: false, error: 'PAYPAL_WEBHOOK_ID not configured' };
    }

    const transmissionId = headers['paypal-transmission-id'] as string;
    const transmissionTime = headers['paypal-transmission-time'] as string;
    const certUrl = headers['paypal-cert-url'] as string;
    const authAlgo = headers['paypal-auth-algo'] as string;
    const transmissionSig = headers['paypal-transmission-sig'] as string;

    if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
      logger.warn('⚠️ Missing PayPal webhook headers');
      return { verified: false, error: 'Missing required PayPal headers' };
    }

    const verifyResponse = await paypalFetch(
      `${PAYPAL_API}/v1/notifications/verify-webhook-signature`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          auth_algo: authAlgo,
          cert_url: certUrl,
          transmission_id: transmissionId,
          transmission_sig: transmissionSig,
          transmission_time: transmissionTime,
          webhook_id: webhookId,
          webhook_event: webhookEvent,
        }),
      }
    );

    if (!verifyResponse.ok) {
      const errorText = await verifyResponse.text();
      logger.error('PayPal verification API error:', errorText);
      return { verified: false, error: 'PayPal verification API error' };
    }

    const verifyResult = await verifyResponse.json() as { verification_status: string };

    if (verifyResult.verification_status === 'SUCCESS') {
      logger.info('✅ PayPal webhook signature verified');
      return { verified: true };
    }

    logger.warn('⚠️ PayPal webhook verification failed:', verifyResult.verification_status);
    return { verified: false, error: `Verification status: ${verifyResult.verification_status}` };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Webhook verification error:', error);
    return { verified: false, error: message };
  }
}
