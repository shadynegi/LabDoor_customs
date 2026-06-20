import { logger } from './logger';

/** Extract PayPal capture ID from a refund/reversal webhook resource. */
export function extractCaptureIdFromWebhookResource(
  resource: Record<string, unknown> | undefined | null
): string | null {
  if (!resource) return null;

  const links = resource.links as Array<{ rel?: string; href?: string }> | undefined;
  if (links?.length) {
    const upLink = links.find((link) => link.rel === 'up' && link.href);
    if (upLink?.href) {
      const match = upLink.href.match(/\/captures\/([A-Z0-9]+)$/i);
      if (match?.[1]) return match[1];
    }
  }

  const supplementary = resource.supplementary_data as
    | { related_ids?: { order_id?: string } }
    | undefined;

  if (supplementary?.related_ids?.order_id) {
    logger.warn(
      'Webhook resource missing capture link; supplementary order_id present but capture ID unresolved'
    );
  }

  return null;
}

/** Parse capture ID + amount from a PayPal checkout order GET response. */
export function parseCaptureFromPayPalOrder(orderData: Record<string, unknown>): {
  captureId: string | null;
  capturedAmount: number | null;
} {
  const purchaseUnits = orderData.purchase_units as Array<Record<string, unknown>> | undefined;
  const unit = purchaseUnits?.[0];
  const payments = unit?.payments as Record<string, unknown> | undefined;
  const captures = payments?.captures as Array<Record<string, unknown>> | undefined;
  const capture = captures?.[0];

  if (!capture) {
    return { captureId: null, capturedAmount: null };
  }

  const captureId = typeof capture.id === 'string' ? capture.id : null;
  const amountObj = capture.amount as { value?: string } | undefined;
  const capturedAmount =
    amountObj?.value != null ? parseFloat(String(amountObj.value)) : null;

  return { captureId, capturedAmount };
}

/** Extract capture amount from a PAYMENT.CAPTURE.COMPLETED webhook resource. */
export function extractCaptureAmountFromWebhookResource(
  resource: Record<string, unknown> | undefined | null
): number | null {
  if (!resource) return null;
  const amountObj = resource.amount as { value?: string } | undefined;
  if (amountObj?.value == null) return null;
  const parsed = parseFloat(String(amountObj.value));
  return Number.isNaN(parsed) ? null : parsed;
}

/** Extract refund amount value from a refund/reversal webhook resource. */
export function extractRefundAmountFromWebhookResource(
  resource: Record<string, unknown> | undefined | null
): string | null {
  if (!resource) return null;
  const amountObj = resource.amount as { value?: string } | undefined;
  return amountObj?.value ?? null;
}
