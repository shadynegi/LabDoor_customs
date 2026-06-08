import type { Request, Response } from 'express';
import { logger } from './logger';
import { syncOrderAfterRefund } from './refundSync';
import {
  syncWebhookPaymentCompleted,
  failPendingOrderByPayPalId,
} from './paymentReconciliation';
import {
  extractCaptureIdFromWebhookResource,
  extractCaptureAmountFromWebhookResource,
  extractRefundAmountFromWebhookResource,
} from './paypalWebhookUtils';
import { verifyPayPalWebhookSignature } from './paypalClient';
import {
  buildPayPalRefundDedupeKey,
  buildWebhookRefundDedupeKey,
} from './refundIdempotency';

type PayPalWebhookEvent = {
  event_type?: string;
  resource?: Record<string, unknown>;
};

function parseWebhookBody(req: Request): PayPalWebhookEvent | null {
  try {
    const raw = req.body as Buffer;
    if (!Buffer.isBuffer(raw)) {
      return req.body as PayPalWebhookEvent;
    }
    return JSON.parse(raw.toString('utf8')) as PayPalWebhookEvent;
  } catch {
    return null;
  }
}

export function createPayPalWebhookHandler(isProduction: boolean) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const webhookId = process.env.PAYPAL_WEBHOOK_ID;
      const webhookEvent = parseWebhookBody(req);

      if (!webhookEvent) {
        res.status(400).json({
          success: false,
          error: 'Invalid webhook payload',
        });
        return;
      }

      logger.info('📨 PayPal Webhook Event:', webhookEvent?.event_type);

      if (!webhookId) {
        if (isProduction) {
          logger.error('❌ PAYPAL_WEBHOOK_ID missing — rejecting webhook in production');
          res.status(503).json({
            success: false,
            error: 'Webhook verification not configured',
          });
          return;
        }
        logger.warn('⚠️ PAYPAL_WEBHOOK_ID not configured — skipping verification (development only)');
      } else {
        const verification = await verifyPayPalWebhookSignature(
          webhookEvent as Record<string, unknown>,
          req.headers
        );

        if (!verification.verified) {
          logger.error('❌ Webhook verification failed:', verification.error);
          res.status(401).json({
            success: false,
            error: 'Webhook verification failed',
          });
          return;
        }
      }

      let processingFailed = false;

      switch (webhookEvent?.event_type) {
        case 'PAYMENT.CAPTURE.COMPLETED': {
          logger.info('✅ Payment completed:', webhookEvent.resource?.id);
          const captureId = webhookEvent.resource?.id as string | undefined;
          const orderId = (
            webhookEvent.resource?.supplementary_data as
              | { related_ids?: { order_id?: string } }
              | undefined
          )?.related_ids?.order_id;
          const capturedAmount = extractCaptureAmountFromWebhookResource(
            webhookEvent.resource
          );

          if (!orderId || !captureId) {
            logger.error('Webhook PAYMENT.CAPTURE.COMPLETED missing orderId or captureId');
            processingFailed = true;
            break;
          }

          try {
            await syncWebhookPaymentCompleted(orderId, captureId, capturedAmount);
          } catch (dbError) {
            processingFailed = true;
            logger.error('Webhook capture completion failed:', dbError);
          }
          break;
        }

        case 'PAYMENT.CAPTURE.DENIED': {
          logger.info('❌ Payment denied:', webhookEvent.resource?.id);
          const deniedOrderId = (
            webhookEvent.resource?.supplementary_data as
              | { related_ids?: { order_id?: string } }
              | undefined
          )?.related_ids?.order_id;

          if (deniedOrderId) {
            try {
              const handled = await failPendingOrderByPayPalId(deniedOrderId);
              if (handled) {
                logger.info(`📦 Pending order ${deniedOrderId} cancelled and stock restored`);
              }
            } catch (dbError) {
              processingFailed = true;
              logger.error('Database update error:', dbError);
            }
          } else {
            processingFailed = true;
            logger.error('PAYMENT.CAPTURE.DENIED without resolvable order binding');
          }
          break;
        }

        case 'PAYMENT.CAPTURE.REFUNDED':
        case 'PAYMENT.CAPTURE.REVERSED': {
          logger.info(`💰 Payment ${webhookEvent?.event_type}:`, webhookEvent.resource?.id);
          const resource = webhookEvent.resource;
          const captureId = extractCaptureIdFromWebhookResource(resource);
          const refundAmount = extractRefundAmountFromWebhookResource(resource);
          const resourceId = resource?.id as string | undefined;
          const transmissionId = req.headers['paypal-transmission-id'] as string | undefined;
          const dedupeKey =
            webhookEvent.event_type === 'PAYMENT.CAPTURE.REFUNDED' && resourceId
              ? buildPayPalRefundDedupeKey(resourceId)
              : buildWebhookRefundDedupeKey(
                  transmissionId,
                  webhookEvent.event_type,
                  resourceId
                );

          if (captureId) {
            try {
              await syncOrderAfterRefund(captureId, {
                refundAmount: refundAmount ?? undefined,
                dedupeKey,
                source: 'webhook',
              });
            } catch (dbError) {
              processingFailed = true;
              logger.error('Database update error:', dbError);
            }
          } else {
            logger.warn(
              `Could not resolve capture ID for ${webhookEvent?.event_type}:`,
              resource?.id
            );
            processingFailed = true;
          }
          break;
        }

        case 'CHECKOUT.ORDER.APPROVED': {
          logger.info('👍 Checkout approved:', webhookEvent.resource?.id);
          const approvedOrderId = webhookEvent.resource?.id;
          if (approvedOrderId) {
            logger.info(
              `📦 Checkout approved for PayPal order: ${approvedOrderId}, awaiting capture`
            );
          }
          break;
        }

        case 'CHECKOUT.ORDER.COMPLETED': {
          logger.info('✅ Checkout completed:', webhookEvent.resource?.id);
          break;
        }

        default:
          logger.info('ℹ️ Unhandled event type:', webhookEvent?.event_type);
      }

      if (processingFailed) {
        res.status(500).json({
          success: false,
          error: 'Webhook processing failed',
        });
        return;
      }

      res.status(200).json({ received: true });
    } catch (error: unknown) {
      logger.error('Webhook error:', error);
      res.status(500).json({
        success: false,
        error: 'Webhook processing failed',
      });
    }
  };
}
