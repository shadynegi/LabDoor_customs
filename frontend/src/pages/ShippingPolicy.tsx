// src/pages/ShippingPolicy.tsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useResponsive } from '../hooks/useResponsive';
import { ArrowLeft, Truck, Clock, Globe, Package, MapPin, AlertCircle } from 'lucide-react';
import {
  FREE_SHIPPING_MESSAGE,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_COST,
} from '../utils/pricing';
import { SITE_EMAILS } from '../lib/site';

export default function ShippingPolicy() {
  const navigate = useNavigate();
  const { isMobile } = useResponsive();

  const Section = ({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: 'linear-gradient(135deg, #361906 0%, #9c6649 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Icon size={20} color="white" />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', margin: 0 }}>{title}</h2>
      </div>
      <div style={{ paddingLeft: isMobile ? 0 : 52, color: '#4b5563', lineHeight: 1.8 }}>
        {children}
      </div>
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5e0d5 0%, #9c6649 55%, #361906 100%)',
      padding: isMobile ? '20px' : '40px',
    }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 20px',
            background: 'white',
            border: 'none',
            borderRadius: 10,
            cursor: 'pointer',
            marginBottom: 24,
            fontSize: 14,
            fontWeight: 600,
            color: '#374151',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <ArrowLeft size={18} />
          Back
        </button>

        <div style={{
          background: 'linear-gradient(135deg, #361906 0%, #9c6649 100%)',
          borderRadius: 20,
          padding: isMobile ? '32px 24px' : '48px',
          marginBottom: 32,
          textAlign: 'center',
          color: 'white',
        }}>
          <Truck size={48} style={{ marginBottom: 16 }} />
          <h1 style={{ fontSize: isMobile ? 32 : 42, fontWeight: 800, marginBottom: 12 }}>
            Shipping Policy
          </h1>
          <p style={{ opacity: 0.9, fontSize: 16 }} data-testid="shipping-policy-tagline">
            {FREE_SHIPPING_MESSAGE}
          </p>
        </div>

        <div style={{
          background: 'white',
          borderRadius: 20,
          padding: isMobile ? 24 : 48,
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        }}>
          <Section icon={Truck} title="Shipping rates">
            <div data-testid="shipping-policy-rates">
              <ul style={{ paddingLeft: 20, marginBottom: 16 }}>
                <li>
                  <strong>Standard shipping:</strong> ${SHIPPING_COST} flat rate on all orders
                </li>
                <li>
                  <strong>Free shipping:</strong> {FREE_SHIPPING_MESSAGE.toLowerCase()} (merchandise subtotal of ${FREE_SHIPPING_THRESHOLD}+ before volume or coupon discounts)
                </li>
              </ul>
              <p style={{ margin: 0 }}>
                Shipping is calculated at checkout from your cart subtotal. Cart and checkout show the exact
                shipping charge before you place your order.
              </p>
            </div>
          </Section>

          <Section icon={Clock} title="Processing time">
            <ul style={{ paddingLeft: 20 }}>
              <li>After checkout, our team confirms payment and prepares your custom order for shipment</li>
              <li>Orders are typically processed within 1–2 business days once payment is confirmed</li>
              <li>Processing may take longer during peak periods or holidays</li>
              <li>You will receive email updates when your order status changes</li>
            </ul>
          </Section>

          <Section icon={Package} title="Order tracking">
            <p style={{ marginBottom: 12 }}>
              Track your order anytime on the{' '}
              <Link to="/orders" style={{ color: '#9c6649', fontWeight: 600 }}>
                My Orders
              </Link>{' '}
              page with your <strong>order ID</strong> (UUID from your confirmation email or WhatsApp message)
              and the <strong>email address used at checkout</strong>.
            </p>
            <ul style={{ paddingLeft: 20 }}>
              <li>Confirmation emails include a link that pre-fills your order ID</li>
              <li>When your order ships, tracking details appear on My Orders when available</li>
              <li>Contact {SITE_EMAILS.support} if you need help locating your order</li>
            </ul>
          </Section>

          <Section icon={Globe} title="International orders">
            <p style={{ marginBottom: 12 }}>
              We primarily ship within the United States. Checkout may accept other countries, but international
              delivery is arranged case by case.
            </p>
            <ul style={{ paddingLeft: 20 }}>
              <li>Contact us before ordering if you are outside the US</li>
              <li>Additional shipping fees, customs duties, and taxes may apply</li>
              <li>Delivery times vary by destination once the package ships</li>
            </ul>
          </Section>

          <Section icon={MapPin} title="Shipping destinations">
            <p style={{ marginBottom: 12 }}>
              Standard shipping is available to all 50 US states and territories. For other destinations, email{' '}
              {SITE_EMAILS.support} and we will confirm whether we can fulfill your order.
            </p>
          </Section>

          <Section icon={AlertCircle} title="Important notes">
            <div style={{
              padding: 20,
              background: '#fef3c7',
              borderRadius: 12,
              borderLeft: '4px solid #f59e0b',
            }}>
              <ul style={{ paddingLeft: 20, margin: 0 }}>
                <li style={{ marginBottom: 8 }}>
                  Delivery times are estimates and may vary due to weather, holidays, or carrier delays
                </li>
                <li style={{ marginBottom: 8 }}>
                  We are not responsible for delays caused by customs inspections on international shipments
                </li>
                <li style={{ marginBottom: 8 }}>
                  Please ensure your shipping address is correct — we cannot redirect packages in transit
                </li>
                <li>
                  P.O. Boxes are supported where the carrier allows
                </li>
              </ul>
            </div>
          </Section>

          <div style={{
            marginTop: 32,
            padding: 20,
            background: '#f9fafb',
            borderRadius: 12,
            textAlign: 'center',
          }}>
            <p style={{ margin: 0, color: '#4b5563', fontSize: 14 }}>
              Questions about shipping? Contact us at{' '}
              <strong>{SITE_EMAILS.support}</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
