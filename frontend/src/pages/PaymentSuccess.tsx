// Order confirmation after WhatsApp redirect (optional return path)
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, MessageCircle } from 'lucide-react';
import { useResponsive } from '../hooks/useResponsive';

interface LastPlacedOrder {
  orderNumber?: string;
  serverOrderId?: string;
  total?: number;
}

export default function PaymentSuccess() {
  const { isMobile } = useResponsive();
  const [order, setOrder] = useState<LastPlacedOrder | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('lastPlacedOrder');
      if (raw) {
        setOrder(JSON.parse(raw) as LastPlacedOrder);
      }
    } catch {
      setOrder(null);
    }
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? 20 : 40,
        background: 'linear-gradient(135deg, #f5e0d5 0%, #9c6649 55%, #361906 100%)',
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 20,
          padding: isMobile ? 24 : 40,
          maxWidth: 520,
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
        }}
      >
        <CheckCircle2 size={56} color="#10b981" style={{ marginBottom: 16 }} />
        <h1 style={{ margin: '0 0 12px', fontSize: isMobile ? 24 : 28, fontWeight: 800, color: '#1f2937' }}>
          Order received
        </h1>
        <p style={{ margin: '0 0 20px', color: '#6b7280', lineHeight: 1.6, fontSize: 15 }}>
          Your order has been saved. Complete your purchase by sending the pre-filled message in WhatsApp.
          We will confirm payment and processing after we receive your message.
        </p>
        {order?.serverOrderId && (
          <p style={{ margin: '0 0 8px', fontWeight: 700, color: '#374151' }}>
            Order ID: {order.serverOrderId}
          </p>
        )}
        {order?.orderNumber && (
          <p style={{ margin: '0 0 8px', color: '#6b7280', fontSize: 14 }}>
            Order number: {order.orderNumber}
          </p>
        )}
        {order?.total != null && (
          <p style={{ margin: '0 0 20px', color: '#6b7280' }}>Total: ${order.total.toFixed(2)}</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '14px 20px',
              background: 'linear-gradient(135deg, #361906 0%, #9c6649 100%)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: 12,
              fontWeight: 600,
            }}
          >
            Continue shopping
          </Link>
          <Link
            to="/orders"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '12px 20px',
              color: '#9c6649',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            <MessageCircle size={18} />
            Track your order
          </Link>
        </div>
      </div>
    </div>
  );
}
