// src/pages/PaymentSuccess.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Package, Truck, Mail, Download, ArrowRight, CreditCard, ShieldCheck, Loader2 } from 'lucide-react';
import { useCart } from './CartContext';
import { apiFetch } from '../config';
import { toast } from 'sonner';
import { getFriendlyError } from '../utils/errorMessages';
import { logError } from '../lib/logger';
import { useResponsive } from '../hooks/useResponsive';

// Payment progress steps
type PaymentStep = 'verifying' | 'capturing' | 'saving' | 'complete' | 'error';

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

const PAYMENT_STEPS = [
  { id: 'verifying', label: 'Verifying Payment', icon: ShieldCheck },
  { id: 'capturing', label: 'Processing Transaction', icon: CreditCard },
  { id: 'saving', label: 'Saving Order', icon: Package },
  { id: 'complete', label: 'Order Complete', icon: CheckCircle2 },
];

// Payment Progress Component
function PaymentProgress({ currentStep, isMobile }: { currentStep: PaymentStep; isMobile: boolean }) {
  const stepIndex = PAYMENT_STEPS.findIndex(s => s.id === currentStep);

  return (
    <motion.div
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
  const { isMobile } = useResponsive();

  const token = searchParams.get('token');
  const payerId = searchParams.get('PayerID');

  useEffect(() => {
    const capturePayment = async () => {
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
        navigate('/');
        return;
      }

      try {
        // Step 1: Verifying payment
        setPaymentStep('verifying');
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief UI pause

        const pendingOrderRaw = localStorage.getItem('pendingOrder');
        let pendingOrder: PendingOrderContext | null = pendingOrderRaw
          ? JSON.parse(pendingOrderRaw)
          : null;

        const checkoutCode = searchParams.get('code');
        const legacyAid = searchParams.get('aid');

        if (!pendingOrder && checkoutCode) {
          const exchangeRes = await apiFetch(
            `/paypal/checkout-exchange/${encodeURIComponent(checkoutCode)}`
          );
          const exchange = await exchangeRes.json();

          if (exchangeRes.ok && exchange.accessToken) {
            pendingOrder = {
              serverOrderId: exchange.serverOrderId,
              orderNumber: exchange.orderNumber,
              accessToken: exchange.accessToken,
              paypalOrderId: token || exchange.paypalOrderId || undefined,
              total: exchange.total,
              coupon: exchange.couponId
                ? {
                    id: exchange.couponId,
                    discount_amount: exchange.discount_amount,
                  }
                : null,
            };
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
          }
        }

        if (!pendingOrder) {
          setPaymentStep('error');
          throw new Error('Missing pending order context');
        }

        if (!pendingOrder.serverOrderId) {
          setPaymentStep('error');
          throw new Error('Missing server order binding');
        }

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

        clearCart();
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
        setIsLoading(false);
      } catch (error) {
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
  }, [token, payerId, navigate, clearCart]);

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
              onClick={() => window.location.reload()}
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