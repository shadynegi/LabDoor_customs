// src/pages/PaymentSuccess.tsx
import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Package, Truck, Mail, Download, ArrowRight, CreditCard, ShieldCheck, Loader2 } from 'lucide-react';
import { useCart } from './CartContext';
import { apiFetch } from '../config';
import { toast } from 'sonner';
import { getFriendlyError } from '../utils/errorMessages';
import { logError } from '../lib/logger';
import { useResponsive } from '../hooks/useResponsive';
import { trackPurchaseComplete } from '../utils/activityTracker';

// Payment progress steps
type PaymentStep = 'verifying' | 'capturing' | 'saving' | 'complete' | 'error' | 'processing';

interface CheckoutFormData {
  email?: string;
  fullName?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

interface PendingOrderContext {
  serverOrderId?: string;
  orderNumber?: string;
  accessToken?: string;
  paypalOrderId?: string;
  idempotencyKey?: string;
  total?: number;
  items?: unknown;
  formData?: CheckoutFormData;
  coupon?: { id?: string; discount_amount?: number } | null;
}

const PENDING_ORDER_KEY = 'pendingOrder';

function persistPendingOrder(order: PendingOrderContext): void {
  try {
    sessionStorage.setItem(PENDING_ORDER_KEY, JSON.stringify(order));
  } catch (error) {
    logError('Failed to persist pending order for capture retry:', error);
  }
}

const PAYMENT_STEPS = [
  { id: 'verifying', label: 'Verifying Payment', icon: ShieldCheck },
  { id: 'capturing', label: 'Processing Transaction', icon: CreditCard },
  { id: 'saving', label: 'Saving Order', icon: Package },
  { id: 'complete', label: 'Order Complete', icon: CheckCircle2 },
];

// Payment Progress Component
function PaymentProgress({ currentStep, isMobile }: { currentStep: PaymentStep; isMobile: boolean }) {
  const stepIndex = PAYMENT_STEPS.findIndex(s => s.id === currentStep);

  const stepLabel = PAYMENT_STEPS[stepIndex]?.label ?? 'Processing';

  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-label={`Payment progress: ${stepLabel}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'white',
        borderRadius: 20,
        padding: isMobile ? 24 : 40,
        maxWidth: 500,
        margin: '0 auto',
        boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
        textAlign: 'center',
      }}
    >
      <motion.div
        aria-hidden="true"
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          border: '4px solid #e5e7eb',
          borderTopColor: '#9c6649',
          margin: '0 auto 24px',
        }}
      />

      <h2 style={{
        fontSize: isMobile ? 24 : 28,
        fontWeight: 800,
        color: '#1f2937',
        marginBottom: 12,
      }}>
        Processing Your Order
      </h2>

      <p style={{
        fontSize: 16,
        color: '#6b7280',
        marginBottom: 32,
      }}>
        Please wait while we complete your payment
      </p>

      {/* Progress Steps */}
      <div style={{ textAlign: 'left' }}>
        {PAYMENT_STEPS.map((step, index) => {
          const StepIcon = step.icon;
          const isCompleted = index < stepIndex;
          const isCurrent = step.id === currentStep;

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '12px 16px',
                marginBottom: 8,
                background: isCurrent ? '#f5e0d5' : isCompleted ? '#f0fdf4' : '#f9fafb',
                borderRadius: 12,
                border: isCurrent ? '2px solid #9c6649' : isCompleted ? '2px solid #10b981' : '2px solid transparent',
              }}
            >
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: isCompleted 
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : isCurrent 
                    ? 'linear-gradient(135deg, #361906 0%, #9c6649 100%)'
                    : '#e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {isCurrent ? (
                  <Loader2 size={20} color="white" style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <StepIcon size={20} color={isCompleted || isCurrent ? 'white' : '#9ca3af'} />
                )}
              </div>
              <div>
                <div style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: isCompleted ? '#059669' : isCurrent ? '#361906' : '#9ca3af',
                }}>
                  {step.label}
                </div>
                {isCurrent && (
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    Please wait...
                  </div>
                )}
                {isCompleted && (
                  <div style={{ fontSize: 12, color: '#10b981' }}>
                    Completed
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </motion.div>
  );
}

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('verifying');
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [processingMessage, setProcessingMessage] = useState<string | null>(null);
  const [reconciliationContext, setReconciliationContext] = useState<{
    paypalOrderId: string;
    accessToken?: string;
    serverOrderId?: string;
    orderNumber?: string;
  } | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const { isMobile } = useResponsive();

  const token = searchParams.get('token');
  const payerId = searchParams.get('PayerID');
  const capturedRef = useRef(false);

  const handleRetryCapture = () => {
    setCaptureError(null);
    setProcessingMessage(null);
    setReconciliationContext(null);
    setIsLoading(true);
    setPaymentStep('verifying');
    capturedRef.current = false;
    setRetryAttempt((n) => n + 1);
  };

  useEffect(() => {
    if (paymentStep !== 'processing' || !reconciliationContext?.paypalOrderId) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 15;

    const pollOrderStatus = async () => {
      if (cancelled) return;
      if (attempts >= maxAttempts) {
        setPaymentStep('error');
        setCaptureError(
          'Your payment was received but order confirmation is taking longer than expected. Check /orders or contact support — your cart was not cleared.'
        );
        setProcessingMessage(null);
        setReconciliationContext(null);
        return;
      }
      attempts += 1;

      try {
        const headers: Record<string, string> = {};
        if (reconciliationContext.accessToken) {
          headers['X-Order-Access-Token'] = reconciliationContext.accessToken;
        }
        const contextRes = await apiFetch(
          `/paypal/checkout-context/${encodeURIComponent(reconciliationContext.paypalOrderId)}`,
          { headers }
        );
        const context = await contextRes.json();

        if (cancelled) return;

        if (contextRes.ok && context.alreadyCompleted) {
          const completedDetails = {
            orderNumber: context.orderNumber || reconciliationContext.orderNumber,
            serverOrderId: context.serverOrderId || reconciliationContext.serverOrderId,
            total: context.total,
            completedAt: new Date().toISOString(),
          };
          setOrderDetails(completedDetails);
          if (reconciliationContext.accessToken && completedDetails.orderNumber) {
            sessionStorage.setItem(
              'labdoor_tracked_orders',
              JSON.stringify([
                {
                  orderNumber: completedDetails.orderNumber,
                  token: reconciliationContext.accessToken,
                },
                ...JSON.parse(sessionStorage.getItem('labdoor_tracked_orders') || '[]').filter(
                  (o: { orderNumber: string }) => o.orderNumber !== completedDetails.orderNumber
                ),
              ])
            );
          }
          capturedRef.current = true;
          const itemCount = Array.isArray(context.items)
            ? context.items.length
            : 0;
          trackPurchaseComplete(
            completedDetails.serverOrderId || reconciliationContext.serverOrderId || '',
            completedDetails.total ?? context.total ?? 0,
            itemCount
          );
          clearCart();
          sessionStorage.removeItem('pendingOrder');
          sessionStorage.removeItem('checkoutRecovery');
          sessionStorage.removeItem('paypalReturnCode');
          localStorage.removeItem('pendingOrder');
          setProcessingMessage(null);
          setReconciliationContext(null);
          setPaymentStep('complete');
          window.history.replaceState({}, '', '/payment/success');
        }
      } catch (error) {
        logError('Payment reconciliation poll failed:', error);
      }
    };

    void pollOrderStatus();
    const intervalId = window.setInterval(pollOrderStatus, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [paymentStep, reconciliationContext, clearCart]);

  useEffect(() => {
    let cancelled = false;

    const capturePayment = async () => {
      if (capturedRef.current) return;
      setCaptureError(null);

      const lastOrder = localStorage.getItem('lastCompletedOrder');
      if (lastOrder) {
        try {
          const parsedOrder = JSON.parse(lastOrder);
          const completedAt = new Date(parsedOrder.completedAt);
          const hoursSinceCompletion = (Date.now() - completedAt.getTime()) / (1000 * 60 * 60);

          if (hoursSinceCompletion < 24) {
            setOrderDetails(parsedOrder);
            setPaymentStep('complete');
            setIsLoading(false);
            window.history.replaceState({}, '', '/payment/success');
            return;
          }
          localStorage.removeItem('lastCompletedOrder');
        } catch (e) {
          logError('Error parsing last order:', e);
          localStorage.removeItem('lastCompletedOrder');
        }
      }

      if (!token) {
        setPaymentStep('error');
        setCaptureError(
          'PayPal did not return a payment reference. Use the tracking link from your confirmation email or look up your order at /orders.'
        );
        setIsLoading(false);
        return;
      }

      try {
        // Step 1: Verifying payment
        setPaymentStep('verifying');
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief UI pause

        const pendingOrderRaw =
          sessionStorage.getItem('pendingOrder') || localStorage.getItem('pendingOrder');
        let pendingOrder: PendingOrderContext | null = pendingOrderRaw
          ? JSON.parse(pendingOrderRaw)
          : null;

        const recoveryRaw = sessionStorage.getItem('checkoutRecovery');
        if (recoveryRaw) {
          try {
            const recovery = JSON.parse(recoveryRaw);
            pendingOrder = {
              ...(pendingOrder || {}),
              formData: recovery.formData ?? pendingOrder?.formData,
              items: recovery.items ?? pendingOrder?.items,
            };
          } catch {
            sessionStorage.removeItem('checkoutRecovery');
          }
        }

        const urlCode = searchParams.get('code');
        if (urlCode) {
          sessionStorage.setItem('paypalReturnCode', urlCode);
        }
        const checkoutCode = urlCode || sessionStorage.getItem('paypalReturnCode');
        const legacyAid = searchParams.get('aid');

        if (checkoutCode && (!pendingOrder || !pendingOrder.accessToken)) {
          const exchangeRes = await apiFetch(
            `/paypal/checkout-exchange/${encodeURIComponent(checkoutCode)}`
          );
          const exchange = await exchangeRes.json();

          if (exchangeRes.ok && exchange.accessToken) {
            pendingOrder = {
              ...(pendingOrder || {}),
              formData: pendingOrder?.formData,
              items: pendingOrder?.items,
              serverOrderId: exchange.serverOrderId || pendingOrder?.serverOrderId,
              orderNumber: exchange.orderNumber || pendingOrder?.orderNumber,
              accessToken: exchange.accessToken,
              paypalOrderId: token || exchange.paypalOrderId || pendingOrder?.paypalOrderId,
              total: exchange.total ?? pendingOrder?.total,
              coupon: exchange.couponId
                ? {
                    id: exchange.couponId,
                    discount_amount: exchange.discount_amount,
                  }
                : pendingOrder?.coupon ?? null,
            };
            persistPendingOrder(pendingOrder);
          } else if (!legacyAid && !pendingOrder?.accessToken) {
            setPaymentStep('error');
            const exchangeError =
              exchange.error ||
              exchange.message ||
              'This return link has expired or was already used.';
            setCaptureError(
              `${exchangeError} Try looking up your order at /orders or contact support.`
            );
            toast.error('Checkout session expired', {
              description: legacyAid
                ? undefined
                : 'Your PayPal return link could not be restored. Use order lookup or contact support.',
              duration: 10000,
            });
            setIsLoading(false);
            return;
          }
        }

        if (!pendingOrder && token && legacyAid) {
          const contextRes = await apiFetch(`/paypal/checkout-context/${token}`, {
            headers: { 'X-Order-Access-Token': legacyAid },
          });
          const context = await contextRes.json();

          if (contextRes.ok && context.alreadyCompleted) {
            setOrderDetails({
              orderNumber: context.orderNumber,
              serverOrderId: context.serverOrderId,
              completedAt: new Date().toISOString(),
            });
            setPaymentStep('complete');
            setIsLoading(false);
            return;
          }

          if (contextRes.ok && context.serverOrderId) {
            pendingOrder = {
              serverOrderId: context.serverOrderId,
              orderNumber: context.orderNumber,
              accessToken: legacyAid,
              paypalOrderId: token || undefined,
              total: context.total,
              coupon: context.couponId
                ? {
                    id: context.couponId,
                    discount_amount: context.discount_amount,
                  }
                : null,
            };
            persistPendingOrder(pendingOrder);
          }
        }

        if (!pendingOrder) {
          setPaymentStep('error');
          setCaptureError(
            'We could not restore your checkout session. Use the tracking link from your confirmation email or look up your order at /orders.'
          );
          setIsLoading(false);
          return;
        }

        if (!pendingOrder.serverOrderId) {
          setPaymentStep('error');
          throw new Error('Missing server order binding');
        }

        persistPendingOrder(pendingOrder);

        // Step 2: Capturing payment (bound to server order)
        setPaymentStep('capturing');
        const captureIdempotencyKey =
          token || pendingOrder.paypalOrderId || '';

        const response = await apiFetch(`/paypal/capture-payment/${token}`, {
          method: 'POST',
          headers: {
            'X-Idempotency-Key': captureIdempotencyKey,
          },
          body: JSON.stringify({
            serverOrderId: pendingOrder.serverOrderId,
            accessToken: pendingOrder.accessToken,
            couponId: pendingOrder.coupon?.id,
            discount_amount: pendingOrder.coupon?.discount_amount,
          }),
        });

        if (response.status === 409) {
          const errData = await response.json().catch(() => ({}));
          setReconciliationContext({
            paypalOrderId: token || pendingOrder.paypalOrderId || '',
            accessToken: pendingOrder.accessToken,
            serverOrderId: pendingOrder.serverOrderId,
            orderNumber: pendingOrder.orderNumber,
          });
          setProcessingMessage(
            errData.message ||
              errData.error ||
              'Payment received — your order is still being confirmed. This usually resolves within a minute.'
          );
          setPaymentStep('processing');
          setIsLoading(false);
          return;
        }

        if (!response.ok) {
          setPaymentStep('error');
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.message || errData.error || 'Payment capture failed');
        }

        const data = await response.json();

        // Step 3: Order already saved server-side — use capture response
        setPaymentStep('saving');

        const serverOrder = data.order;
        const shippingAddress = serverOrder?.shipping_address || pendingOrder.formData;
        const completedDetails = {
          ...pendingOrder,
          ...data,
          orderNumber: data.orderNumber || pendingOrder.orderNumber,
          customer_email: serverOrder?.customer_email || pendingOrder.formData?.email,
          customer_name: serverOrder?.customer_name || pendingOrder.formData?.fullName,
          items: serverOrder?.items || pendingOrder.items,
          shipping_address: serverOrder?.shipping_address,
          formData: pendingOrder.formData || (shippingAddress?.address ? {
            fullName: serverOrder?.customer_name,
            email: serverOrder?.customer_email,
            address: shippingAddress.address,
            city: shippingAddress.city,
            state: shippingAddress.state,
            zipCode: shippingAddress.zipCode,
            country: shippingAddress.country,
          } : undefined),
          total: serverOrder?.total ?? pendingOrder.total,
          captureId: data.captureId,
          orderId: data.captureId,
          orderDate: new Date().toISOString(),
        };
        setOrderDetails(completedDetails);

        if (pendingOrder.accessToken && (data.orderNumber || pendingOrder.orderNumber)) {
          sessionStorage.setItem(
            'labdoor_tracked_orders',
            JSON.stringify([
              {
                orderNumber: data.orderNumber || pendingOrder.orderNumber,
                token: pendingOrder.accessToken,
              },
              ...JSON.parse(sessionStorage.getItem('labdoor_tracked_orders') || '[]').filter(
                (o: { orderNumber: string }) =>
                  o.orderNumber !== (data.orderNumber || pendingOrder.orderNumber)
              ),
            ])
          );
        }

        if (cancelled) return;

        capturedRef.current = true;
        const pendingItems = pendingOrder.items;
        const itemCount = Array.isArray(completedDetails.items)
          ? completedDetails.items.length
          : (Array.isArray(pendingItems) ? pendingItems.length : 0);
        trackPurchaseComplete(
          pendingOrder.serverOrderId || completedDetails.orderNumber || '',
          completedDetails.total ?? pendingOrder.total ?? 0,
          itemCount
        );
        clearCart();
        sessionStorage.removeItem('pendingOrder');
        sessionStorage.removeItem('checkoutRecovery');
        sessionStorage.removeItem('paypalReturnCode');
        localStorage.removeItem('pendingOrder');

        const { accessToken: _omitToken, ...persistDetails } = completedDetails;
        localStorage.setItem('lastCompletedOrder', JSON.stringify({
          ...persistDetails,
          captureId: data.captureId,
          completedAt: new Date().toISOString(),
        }));

        setPaymentStep('complete');
        window.history.replaceState({}, '', '/payment/success');
        await new Promise(resolve => setTimeout(resolve, 500));
        if (!cancelled) setIsLoading(false);
      } catch (error) {
        if (cancelled) return;
        setPaymentStep('error');
        logError('Payment capture error:', error);
        const friendlyError = getFriendlyError(error);
        setCaptureError(friendlyError.message);
        toast.error(friendlyError.message, {
          description: friendlyError.description + ' Please contact support with your order details.',
          duration: 10000,
        });
        setIsLoading(false);
      }
    };

    capturePayment();
    return () => {
      cancelled = true;
    };
  }, [token, payerId, navigate, clearCart, searchParams, retryAttempt]);

  const displayEmail =
    orderDetails?.customer_email ||
    orderDetails?.formData?.email ||
    orderDetails?.order?.customer_email;

  const getItemName = (item: { product_name?: string; name?: string }) =>
    item.product_name || item.name || 'Item';

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #f5e0d5 0%, #9c6649 55%, #361906 100%)',
          padding: 20,
        }}
      >
        <PaymentProgress currentStep={paymentStep} isMobile={isMobile} />
      </div>
    );
  }

  if (paymentStep === 'processing' && processingMessage) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #f5e0d5 0%, #9c6649 55%, #361906 100%)',
          padding: 20,
        }}
      >
        <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 520, textAlign: 'center' }}>
          <Loader2
            size={48}
            color="#9c6649"
            style={{ margin: '0 auto 16px', animation: 'spin 1s linear infinite' }}
          />
          <h2 style={{ margin: '0 0 12px', color: '#92400e' }}>Payment received — order processing</h2>
          <p style={{ color: '#6b7280', marginBottom: 24 }}>{processingMessage}</p>
          <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: 24 }}>
            We are confirming your order. Your cart is unchanged until confirmation completes.
            {reconciliationContext?.orderNumber && (
              <> Order reference: <strong>{reconciliationContext.orderNumber}</strong></>
            )}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => navigate('/orders')}
              style={{ padding: '12px 20px', background: '#9c6649', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
            >
              View orders
            </button>
            <button
              type="button"
              onClick={() => navigate('/contact')}
              style={{ padding: '12px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
            >
              Contact support
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (captureError) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #f5e0d5 0%, #9c6649 55%, #361906 100%)',
          padding: 20,
        }}
      >
        <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 480, textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 12px', color: '#991b1b' }}>Payment could not be completed</h2>
          <p style={{ color: '#6b7280', marginBottom: 24 }}>{captureError}</p>
          <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: 24 }}>
            If PayPal charged you, check your email for confirmation or contact support with your PayPal receipt.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleRetryCapture}
              style={{ padding: '12px 20px', background: '#9c6649', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => navigate('/contact')}
              style={{ padding: '12px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
            >
              Contact support
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f5e0d5 0%, #9c6649 55%, #361906 100%)',
        padding: isMobile ? '20px' : '40px 20px',
      }}
    >
      <div
        style={{
          maxWidth: 800,
          margin: '0 auto',
        }}
      >
        {/* Success Animation */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', duration: 0.6 }}
          style={{
            width: isMobile ? 100 : 120,
            height: isMobile ? 100 : 120,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 32px',
            boxShadow: '0 20px 60px rgba(16, 185, 129, 0.3)',
          }}
        >
          <CheckCircle2 size={isMobile ? 50 : 60} color="white" strokeWidth={2} />
        </motion.div>

        {/* Success Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            background: 'white',
            borderRadius: 16,
            padding: isMobile ? 24 : 40,
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            textAlign: 'center',
            marginBottom: 24,
          }}
        >
          <h1
            style={{
              fontSize: isMobile ? 28 : 36,
              fontWeight: 800,
              color: '#1f2937',
              marginBottom: 12,
            }}
          >
            Payment Successful! 🎉
          </h1>
          <p
            style={{
              fontSize: 16,
              color: '#6b7280',
              marginBottom: 24,
            }}
          >
            Thank you for your order.{displayEmail ? (
              <> We&apos;ve sent a confirmation email to <strong>{displayEmail}</strong></>
            ) : (
              <> Check your email for confirmation details.</>
            )}
          </p>

          {/* Order ID */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 20px',
              background: '#f3f4f6',
              borderRadius: 8,
              marginBottom: 32,
            }}
          >
            <Package size={18} color="#6b7280" />
            <span style={{ fontSize: 14, color: '#374151' }}>
              Order ID: <strong>{orderDetails?.orderId?.slice(-12)}</strong>
            </span>
          </div>

          {/* Order Summary */}
          <div
            style={{
              borderTop: '2px solid #e5e7eb',
              paddingTop: 24,
              marginBottom: 24,
            }}
          >
            <h3
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: '#1f2937',
                marginBottom: 16,
                textAlign: 'left',
              }}
            >
              Order Summary
            </h3>
            
            {orderDetails?.items?.map((item: any, index: number) => (
              <div
                key={item.id ?? `${getItemName(item)}-${index}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                  fontSize: 14,
                  color: '#6b7280',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>
                    {getItemName(item)} × {item.quantity}
                  </span>
                  <span>${(Number(item.price) * item.quantity).toFixed(2)}</span>
                </div>
                {(item.size_value || item.size) && (
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>
                    Size: {item.size?.system || item.size_system} {item.size?.value || item.size_value}
                  </span>
                )}
              </div>
            ))}

            <div
              style={{
                borderTop: '1px solid #e5e7eb',
                paddingTop: 12,
                marginTop: 12,
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 18,
                fontWeight: 700,
                color: '#1f2937',
              }}
            >
              <span>Total Paid</span>
              <span>${orderDetails?.total?.toFixed(2)}</span>
            </div>
          </div>

          {/* Shipping Address */}
          {orderDetails?.formData && (
            <div
              style={{
                background: '#f9fafb',
                borderRadius: 8,
                padding: 16,
                marginBottom: 24,
                textAlign: 'left',
              }}
            >
              <h4
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: 12,
                }}
              >
                Shipping Address
              </h4>
              <p style={{ fontSize: 14, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
                {orderDetails.formData.fullName}<br />
                {orderDetails.formData.address}<br />
                {orderDetails.formData.city}, {orderDetails.formData.state} {orderDetails.formData.zipCode}<br />
                {orderDetails.formData.country}
              </p>
            </div>
          )}
        </motion.div>

        {/* Next Steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            background: 'white',
            borderRadius: 16,
            padding: isMobile ? 24 : 32,
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            marginBottom: 24,
          }}
        >
          <h3
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#1f2937',
              marginBottom: 20,
            }}
          >
            What's Next?
          </h3>

          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: '#f5e0d5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Mail size={20} color="#9c6649" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', marginBottom: 4 }}>
                  Confirmation Email
                </div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>
                  Check your inbox for order details and tracking information
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: '#f5e0d5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Package size={20} color="#9c6649" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', marginBottom: 4 }}>
                  Processing (1-2 days)
                </div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>
                  We'll prepare your order for shipment
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: '#f5e0d5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Truck size={20} color="#9c6649" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', marginBottom: 4 }}>
                  Delivery (3-5 days)
                </div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>
                  Your order will be delivered to your address
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={() => navigate('/')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '14px 28px',
              background: 'linear-gradient(135deg, #361906 0%, #9c6649 100%)',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            Continue Shopping
            <ArrowRight size={18} />
          </button>

          <button
            onClick={() => window.print()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '14px 28px',
              background: 'white',
              color: '#374151',
              border: '2px solid #d1d5db',
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#9ca3af';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <Download size={18} />
            Print Receipt
          </button>
        </motion.div>
      </div>
    </div>
  );
}