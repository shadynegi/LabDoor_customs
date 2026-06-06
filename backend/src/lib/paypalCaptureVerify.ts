import { PAYPAL_API, getPayPalAccessToken, parseJson, paypalFetch } from './paypalClient';
import { logger } from './logger';

export type CaptureVerifyResult =
  | { ok: true; captureId: string; amount: number }
  | { ok: false; error: string };

/** Verify a PayPal capture exists, is completed, and matches the order total. */
export async function verifyPayPalCaptureForOrder(
  captureId: string,
  expectedTotal: number,
  expectedPaypalOrderId?: string | null
): Promise<CaptureVerifyResult> {
  const trimmedId = captureId?.trim();
  if (!trimmedId || trimmedId.length < 5) {
    return { ok: false, error: 'Invalid PayPal capture ID' };
  }

  try {
    const accessToken = await getPayPalAccessToken();
    const captureRes = await paypalFetch(`${PAYPAL_API}/v2/payments/captures/${trimmedId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!captureRes.ok) {
      logger.warn('PayPal capture lookup failed:', trimmedId, captureRes.status);
      return { ok: false, error: 'PayPal capture not found or not accessible' };
    }

    const capture = await parseJson<Record<string, unknown>>(captureRes);
    const status = String(capture.status || '').toUpperCase();
    if (status !== 'COMPLETED') {
      return { ok: false, error: `PayPal capture status is ${status || 'unknown'}, expected COMPLETED` };
    }

    const amountObj = capture.amount as { value?: string } | undefined;
    const capturedAmount = parseFloat(String(amountObj?.value ?? ''));
    if (Number.isNaN(capturedAmount)) {
      return { ok: false, error: 'PayPal capture amount could not be read' };
    }

    const expected = Math.round(expectedTotal * 100) / 100;
    const actual = Math.round(capturedAmount * 100) / 100;
    if (Math.abs(actual - expected) > 0.01) {
      return {
        ok: false,
        error: `PayPal capture amount ($${actual.toFixed(2)}) does not match order total ($${expected.toFixed(2)})`,
      };
    }

    if (expectedPaypalOrderId?.trim()) {
      const supplementary = capture.supplementary_data as
        | { related_ids?: { order_id?: string } }
        | undefined;
      const relatedOrderId = supplementary?.related_ids?.order_id;
      if (relatedOrderId && relatedOrderId !== expectedPaypalOrderId.trim()) {
        return { ok: false, error: 'PayPal capture does not belong to this order PayPal ID' };
      }
    }

    return { ok: true, captureId: trimmedId, amount: actual };
  } catch (error) {
    logger.error('PayPal capture verification error:', error);
    return { ok: false, error: 'Failed to verify PayPal capture' };
  }
}
