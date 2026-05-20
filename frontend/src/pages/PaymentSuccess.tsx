// src/pages/PaymentSuccess.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Package, Truck, Mail, Download, ArrowRight, CreditCard, ShieldCheck, Loader2 } from 'lucide-react';
import { useCart } from './CartContext';
import { config } from '../config';
import { calculatePricing } from '../utils/pricing';
import { toast } from 'sonner';
import { getFriendlyError } from '../utils/errorMessages';

to do
4. frontend/src/pages/PaymentSuccess.tsx
Subtotal: Compute from order.items (e.g. order.items.reduce((s, i) => s + (Number(i.price) || 0) * (i.quantity || 0), 0)), then call calculatePricing(subtotal) so shipping is $25 or $0 by the same rule.
Total: Use subtotal − discount + shipping (no tax):
total = subtotal - (order.discount || 0) + shipping.
When saving the order (e.g. POST to /api/orders), send:
subtotal, shipping_cost: shipping, tax: 0, and the computed total.
Remove or avoid showing any tax line in the success UI.
So:
pricing = calculatePricing(computedSubtotal).
orderDetails.total and the body you send to the backend use:
pricing.subtotal - (order.discount || 0) + pricing.shipping, and tax: 0.
5. Backend
Coupons: Keep only 10%, 20%, 25% (your SAVE10/SAVE20/SAVE25). Ensure the discount is computed on subtotal only (your current validate logic likely already does).
Orders: Accept tax: 0 or omit tax; store shipping_cost as 25 or 0 per rule. No need to add a new “tax” component anywhere.
please explain to me in what file, what code i need to change/modify with what, simply tell me the current code snippet and new/replacement code snippets

// Payment progress steps
type PaymentStep = 'verifying' | 'capturing' | 'saving' | 'complete' | 'error';

const PAYMENT_STEPS = [
  { id: 'verifying', label: 'Verifying Payment', icon: ShieldCheck },
  { id: 'capturing', label: 'Processing Transaction', icon: CreditCard },
  { id: 'saving', label: 'Saving Order', icon: Package },
  { id: 'complete', label: 'Order Complete', icon: CheckCircle2 },
];

// Payment Progress Component
function PaymentProgress({ currentStep, isMobile }: { currentStep: PaymentStep; isMobile: boolean }) {
  const stepIndex = PAYMENT_STEPS.findIndex(s => s.id === currentStep);
  const isError = currentStep === 'error';

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
          borderTopColor: '#667eea',
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
          const isPending = index > stepIndex;

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
                background: isCurrent ? '#f0f9ff' : isCompleted ? '#f0fdf4' : '#f9fafb',
                borderRadius: 12,
                border: isCurrent ? '2px solid #3b82f6' : isCompleted ? '2px solid #10b981' : '2px solid transparent',
              }}
            >
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: isCompleted 
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : isCurrent 
                    ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
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
                  color: isCompleted ? '#059669' : isCurrent ? '#1d4ed8' : '#9ca3af',
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
  const [isMobile, setIsMobile] = useState(false);

  const token = searchParams.get('token');
  const payerId = searchParams.get('PayerID');

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const capturePayment = async () => {
      // Check for persisted order (page refresh after completion)
      if (!token) {
        const lastOrder = localStorage.getItem('lastCompletedOrder');
        if (lastOrder) {
          try {
            const parsedOrder = JSON.parse(lastOrder);
            // Check if order was completed within the last 24 hours
            const completedAt = new Date(parsedOrder.completedAt);
            const hoursSinceCompletion = (Date.now() - completedAt.getTime()) / (1000 * 60 * 60);
            
            if (hoursSinceCompletion < 24) {
              setOrderDetails(parsedOrder);
              setIsLoading(false);
              return;
            } else {
              // Clean up old order data
              localStorage.removeItem('lastCompletedOrder');
            }
          } catch (e) {
            console.error('Error parsing last order:', e);
            localStorage.removeItem('lastCompletedOrder');
          }
        }
        navigate('/');
        return;
      }

      try {
        // Step 1: Verifying payment
        setPaymentStep('verifying');
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief UI pause

        // Step 2: Capturing payment
        setPaymentStep('capturing');
        const response = await fetch(`${config.backendUrl}/api/paypal/capture-payment/${token}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          setPaymentStep('error');
          throw new Error('Payment capture failed');
        }

        const data = await response.json();

        // Step 3: Saving order
        setPaymentStep('saving');
        
        // Get order details from localStorage
        const pendingOrder = localStorage.getItem('pendingOrder');
        if (pendingOrder) {
          const order = JSON.parse(pendingOrder);
          
          // Calculate correct pricing using the pricing utility
          const pricing = calculatePricing(order.items);
          
          // Parse and ensure items have numeric prices
          const itemsWithParsedPrices = order.items.map((item: any) => ({
            ...item,
            price: parseFloat(item.price?.toString() || '0'),
          }));
          
          const orderDetails = {
            ...data,
            ...order,
            items: itemsWithParsedPrices,
            subtotal: pricing.subtotal,
            shipping_cost: pricing.shipping,
            tax: pricing.tax,
            total: pricing.total,
            orderId: data.captureId,
            orderDate: new Date().toISOString(),
          };
          setOrderDetails(orderDetails);

          // Save order to database
          try {

            const orderResponse = await fetch(`${config.backendUrl}/api/orders`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                customer_email: order.formData.email,
                customer_name: order.formData.fullName,
                shipping_address: order.formData,
                items: order.items.map((item: any) => ({
                  product_id: item.id,
                  product_name: item.name,
                  product_image: item.image, // Include product image for email templates
                  quantity: item.quantity,
                  price: item.price,
                  size_system: item.size?.system,
                  size_value: item.size?.value,
                })),
                subtotal: pricing.subtotal,
                shipping_cost: pricing.shipping,
                tax: pricing.tax,
                total: order.discount ? pricing.total - order.discount : pricing.total,
                discount: order.discount || 0,
                coupon_code: order.coupon?.code || null,
                payment_status: 'completed',
                payment_method: 'PayPal',
                paypal_order_id: token,
                paypal_capture_id: data.captureId,
                status: 'processing',
              }),
            });

            if (!orderResponse.ok) {
              throw new Error('Failed to save order to database');
            }

            const orderResult = await orderResponse.json();

            // Record coupon usage if a coupon was applied
            if (order.coupon && orderResult.data?.id) {
              try {
                await fetch(`${config.backendUrl}/api/coupons/use`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    coupon_id: order.coupon.id,
                    order_id: orderResult.data.id,
                    customer_email: order.formData.email,
                    discount_amount: order.coupon.discount_amount,
                  }),
                });
                console.log('Coupon usage recorded');
              } catch (couponError) {
                console.error('Failed to record coupon usage:', couponError);
                // Don't fail the order if coupon recording fails
              }
            }
          } catch (dbError) {
            console.error('Failed to save order to database:', dbError);
            toast.error('Order recording issue', {
              description: `Your payment was successful! Please save this ID: ${data.captureId?.slice(-12) || 'Check email'}`,
              duration: 10000,
            });
          }
        }

        // Clear cart and pending order
        clearCart();
        localStorage.removeItem('pendingOrder');
        
        // Store completed order for persistence (in case of page refresh)
        localStorage.setItem('lastCompletedOrder', JSON.stringify({
          ...orderDetails,
          captureId: data.captureId,
          completedAt: new Date().toISOString(),
        }));
        
        // Step 4: Complete
        setPaymentStep('complete');
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause to show completion
        setIsLoading(false);
      } catch (error) {
        setPaymentStep('error');
        console.error('Payment capture error:', error);
        const friendlyError = getFriendlyError(error);
        toast.error(friendlyError.message, {
          description: friendlyError.description + ' Please contact support with your order details.',
          duration: 10000,
        });
        navigate('/checkout');
      }
    };

    capturePayment();
  }, [token, payerId, navigate, clearCart]);

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
          padding: 20,
        }}
      >
        <PaymentProgress currentStep={paymentStep} isMobile={isMobile} />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
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
            Thank you for your order. We've sent a confirmation email to{' '}
            <strong>{orderDetails?.formData?.email}</strong>
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
            
            {orderDetails?.items?.map((item: any) => (
              <div
                key={item.id}
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
                    {item.name} × {item.quantity}
                  </span>
                  <span>${(item.price * item.quantity).toFixed(2)}</span>
                </div>
                {item.size && (
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>
                    Size: {item.size.system} {item.size.value}
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
                  background: '#dbeafe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Mail size={20} color="#2563eb" />
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
                  background: '#dbeafe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Package size={20} color="#2563eb" />
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
                  background: '#dbeafe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Truck size={20} color="#2563eb" />
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
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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