import { logger } from './logger';

export interface PayPalRefundResult {
  success: boolean;
  refundId?: string;
  amount?: string;
  currency?: string;
  error?: string;
}

function getPayPalBaseUrl(): string {
  const mode = process.env.PAYPAL_MODE || 'sandbox';
  return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not configured');
  }

  const baseUrl = getPayPalBaseUrl();
  const authResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });

  const authData = (await authResponse.json()) as { access_token?: string };
  if (!authData.access_token) {
    throw new Error('Failed to authenticate with PayPal');
  }

  return authData.access_token;
}

/** Issue a full or partial refund for a PayPal capture. */
export async function refundPayPalCapture(
  captureId: string,
  amount?: string,
  currency?: string
): Promise<PayPalRefundResult> {
  try {
    const accessToken = await getPayPalAccessToken();
    const baseUrl = getPayPalBaseUrl();

    const payload: { amount?: { value: string; currency_code: string } } = {};
    if (amount && currency) {
      payload.amount = { value: amount, currency_code: currency };
    }

    const refundResponse = await fetch(`${baseUrl}/v2/payments/captures/${captureId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const refundData = (await refundResponse.json()) as {
      id?: string;
      status?: string;
      message?: string;
      amount?: { value?: string; currency_code?: string };
    };

    if (refundResponse.ok && refundData.id) {
      return {
        success: true,
        refundId: refundData.id,
        amount: refundData.amount?.value,
        currency: refundData.amount?.currency_code,
      };
    }

    logger.warn('PayPal refund failed:', refundData.message || refundResponse.status);
    return { success: false, error: 'Refund could not be processed' };
  } catch (error: unknown) {
    logger.error('PayPal refund error:', error);
    return { success: false, error: 'Refund could not be processed' };
  }
}
