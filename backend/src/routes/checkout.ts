import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { clientErrorMessage, respond500 } from '../lib/safeError';
import { sanitizeCustomerInfoLoose } from '../utils/sanitizeCustomer';
import { POLICY_ACCEPTANCE_REQUIRED_MESSAGE } from '../lib/returnPolicy';
import {
  validateCartItems,
  resolveCouponDiscount,
  calculateCheckoutPricing,
  calculateVolumeDiscount,
  createPendingOrderAtomic,
  cancelPendingOrderAndRestoreStock,
  amountsMatch,
  type CheckoutCartItemInput,
} from '../lib/checkoutPricing';
import {
  buildCreatePaymentKey,
  claimIdempotencyKey,
  completeIdempotencyKey,
  failIdempotencyKey,
  reclaimFailedIdempotencyKey,
} from '../lib/paymentIdempotency';
import { reserveCouponForOrder } from '../lib/couponReservation';
import { buildWhatsAppOrderUrl, formatWhatsAppOrderMessage } from '../lib/whatsappCheckout';

const router = Router();
const PLACE_ORDER_OP = 'place_order';

interface PlaceOrderRequest {
  items: CheckoutCartItemInput[];
  customerInfo?: {
    fullName?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  coupon_code?: string;
  policy_accepted?: boolean;
  amount?: string;
}

router.post('/place-order', async (req: Request, res: Response) => {
  let idempotencyKey: string | undefined;
  let createdServerOrderId: string | undefined;

  try {
    const body = req.body as PlaceOrderRequest;
    const { items, coupon_code } = body;
    const customerInfo = body.customerInfo
      ? sanitizeCustomerInfoLoose(body.customerInfo as Record<string, unknown>)
      : undefined;

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: items',
      });
    }

    if (!customerInfo?.email || !customerInfo?.fullName) {
      return res.status(400).json({
        success: false,
        error: 'Customer name and email are required',
      });
    }

    if (body.policy_accepted !== true) {
      return res.status(400).json({
        success: false,
        error: 'Policy acceptance required',
        message: POLICY_ACCEPTANCE_REQUIRED_MESSAGE,
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerInfo.email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
      });
    }

    const cartValidation = await validateCartItems(items);
    if (!cartValidation.ok) {
      return res.status(400).json({
        success: false,
        error: cartValidation.error,
        message: cartValidation.message,
      });
    }

    const lineItems = cartValidation.lineItems;
    const rawSubtotal = lineItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalItemCount = lineItems.reduce((sum, item) => sum + item.quantity, 0);
    const volumePreview = calculateVolumeDiscount(rawSubtotal, totalItemCount);
    const couponSubtotal = Math.max(0, rawSubtotal - volumePreview.amount);

    let couponDiscount = 0;
    let couponId: string | undefined;
    let resolvedCouponCode: string | undefined;
    try {
      const couponResult = await resolveCouponDiscount(
        coupon_code,
        couponSubtotal,
        customerInfo.email,
        lineItems.map((item) => ({
          product_id: item.product_id,
          price: item.price,
          quantity: item.quantity,
        }))
      );
      couponDiscount = couponResult.discount;
      couponId = couponResult.couponId;
      resolvedCouponCode = couponResult.couponCode;
    } catch (couponError: unknown) {
      const message = couponError instanceof Error ? couponError.message : 'Invalid coupon';
      return res.status(400).json({
        success: false,
        error: message,
      });
    }

    const pricing = calculateCheckoutPricing(rawSubtotal, totalItemCount, couponDiscount);

    if (body.amount) {
      const clientTotal = parseFloat(body.amount);
      if (!amountsMatch(pricing.total, clientTotal)) {
        return res.status(400).json({
          success: false,
          error: 'Amount mismatch',
          message: `Server total (${pricing.total.toFixed(2)}) does not match client total (${clientTotal.toFixed(2)})`,
        });
      }
    }

    idempotencyKey = buildCreatePaymentKey(
      req.headers['x-idempotency-key'] as string | undefined,
      customerInfo.email,
      items.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
      coupon_code
    );

    const claim = await claimIdempotencyKey(idempotencyKey, PLACE_ORDER_OP);
    if (claim.type === 'completed') {
      logger.info(`Returning cached place-order result for ${idempotencyKey}`);
      return res.json({ ...claim.response, cached: true });
    }
    if (claim.type === 'in_progress') {
      return res.status(409).json({
        success: false,
        error: 'Order placement already in progress',
        message: 'A duplicate order request was detected. Please wait.',
      });
    }
    if (claim.type === 'failed') {
      const reclaimed = await reclaimFailedIdempotencyKey(idempotencyKey, PLACE_ORDER_OP, 30);
      if (!reclaimed) {
        return res.status(409).json({
          success: false,
          error: 'Previous order attempt failed',
          message: claim.error,
        });
      }
    }

    const pending = await createPendingOrderAtomic({
      customerInfo,
      lineItems,
      pricing,
      couponId,
    });
    createdServerOrderId = pending.order.id as string;

    if (couponId && pricing.couponDiscount > 0) {
      try {
        await reserveCouponForOrder(
          couponId,
          pending.order.id as string,
          customerInfo.email,
          pricing.couponDiscount
        );
      } catch (couponReserveError: unknown) {
        await cancelPendingOrderAndRestoreStock(createdServerOrderId).catch((err) =>
          logger.error('Rollback after coupon reservation failure:', err)
        );
        const message =
          couponReserveError instanceof Error ? couponReserveError.message : 'Coupon unavailable';
        return res.status(400).json({
          success: false,
          error: message,
        });
      }
    }

    const whatsappMessage = formatWhatsAppOrderMessage({
      orderId: pending.order.id as string,
      orderNumber: pending.orderNumber,
      customer: customerInfo,
      lineItems,
      pricing,
      couponCode: resolvedCouponCode,
    });
    const whatsappUrl = buildWhatsAppOrderUrl(whatsappMessage);

    const responsePayload = {
      success: true,
      serverOrderId: pending.order.id,
      orderNumber: pending.orderNumber,
      total: pricing.total,
      whatsappUrl,
      paymentStatus: 'pending',
      orderStatus: 'pending',
      discount: pricing.discount,
      volumeDiscount: pricing.volumeDiscount,
      couponDiscount: pricing.couponDiscount,
      idempotencyKey,
    };

    await completeIdempotencyKey(idempotencyKey, PLACE_ORDER_OP, responsePayload, {
      serverOrderId: pending.order.id as string,
    });

    res.json(responsePayload);
  } catch (error: unknown) {
    logger.error('Place order error:', error);
    if (createdServerOrderId) {
      await cancelPendingOrderAndRestoreStock(createdServerOrderId).catch((err) =>
        logger.error('Rollback after place-order error:', err)
      );
    }
    if (idempotencyKey) {
      await failIdempotencyKey(idempotencyKey, PLACE_ORDER_OP).catch(() => {});
    }
    respond500(res, error, clientErrorMessage(error, 'Failed to place order'));
  }
});

export default router;
