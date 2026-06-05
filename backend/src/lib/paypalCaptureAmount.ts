import { PAYPAL_API, getPayPalAccessToken, parseJson, paypalFetch } from './paypalClient';
import { parseCaptureFromPayPalOrder } from './paypalWebhookUtils';
import { logger } from './logger';

/** Resolve captured amount from PayPal when webhook payload omits it. */
export async function fetchPayPalCapturedAmount(
  paypalOrderId: string,
  captureId?: string
): Promise<number | null> {
  try {
    if (captureId) {
      const accessToken = await getPayPalAccessToken();
      const captureRes = await paypalFetch(`${PAYPAL_API}/v2/payments/captures/${captureId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (captureRes.ok) {
        const capture = await parseJson<Record<string, unknown>>(captureRes);
        const amountObj = capture.amount as { value?: string } | undefined;
        if (amountObj?.value != null) {
          const parsed = parseFloat(String(amountObj.value));
          if (!Number.isNaN(parsed)) return parsed;
        }
      }
    }

    const accessToken = await getPayPalAccessToken();
    const orderRes = await paypalFetch(`${PAYPAL_API}/v2/checkout/orders/${paypalOrderId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!orderRes.ok) return null;

    const orderData = await parseJson<Record<string, unknown>>(orderRes);
    const { capturedAmount } = parseCaptureFromPayPalOrder(orderData);
    return capturedAmount;
  } catch (error) {
    logger.warn('Failed to fetch PayPal capture amount:', error);
    return null;
  }
}
