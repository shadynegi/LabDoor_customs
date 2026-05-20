// src/pages/ShippingPolicy.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Truck, Clock, Globe, Package, MapPin, AlertCircle } from 'lucide-react';

export default function ShippingPolicy() {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const Section = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
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

  const ShippingOption = ({ name, time, price }: { name: string; time: string; price: string }) => (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px 20px',
      background: '#f9fafb',
      borderRadius: 12,
      marginBottom: 12,
    }}>
      <div>
        <div style={{ fontWeight: 600, color: '#1f2937', marginBottom: 4 }}>{name}</div>
        <div style={{ fontSize: 14, color: '#6b7280' }}>{time}</div>
      </div>
      <div style={{
        fontWeight: 700,
        color: price === 'FREE' ? '#10b981' : '#1f2937',
        fontSize: 16,
      }}>
        {price}
      </div>
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      padding: isMobile ? '20px' : '40px',
    }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Back Button */}
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

        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
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
          <p style={{ opacity: 0.9, fontSize: 16 }}>
            Free Shipping on Orders Over $100
          </p>
        </div>

        {/* Content */}
        <div style={{
          background: 'white',
          borderRadius: 20,
          padding: isMobile ? 24 : 48,
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        }}>
          <Section icon={Truck} title="Shipping Options">
            <p style={{ marginBottom: 20 }}>
              We offer several shipping options to meet your needs:
            </p>
            <ShippingOption name="Standard Shipping" time="5-7 business days" price="$5.99" />
            <ShippingOption name="Express Shipping" time="2-3 business days" price="$12.99" />
            <ShippingOption name="Overnight Shipping" time="1 business day" price="$24.99" />
            <ShippingOption name="Free Standard Shipping" time="Orders over $100" price="FREE" />
          </Section>

          <Section icon={Clock} title="Processing Time">
            <ul style={{ paddingLeft: 20 }}>
              <li>Orders are processed within 1-2 business days</li>
              <li>Orders placed after 2 PM EST are processed the next business day</li>
              <li>Processing times may be extended during sales or holidays</li>
              <li>You'll receive a confirmation email when your order ships</li>
            </ul>
          </Section>

          <Section icon={Package} title="Order Tracking">
            <p style={{ marginBottom: 12 }}>
              Once your order ships, you'll receive an email with tracking information. You can also:
            </p>
            <ul style={{ paddingLeft: 20 }}>
              <li>Track your order on our website using your email address</li>
              <li>Track directly on the carrier's website using your tracking number</li>
              <li>Contact our customer service for tracking assistance</li>
            </ul>
            <p style={{ marginTop: 12 }}>
              Tracking information typically updates within 24 hours of shipment.
            </p>
          </Section>

          <Section icon={Globe} title="International Shipping">
            <p style={{ marginBottom: 12 }}>
              We ship to most countries worldwide! For international orders:
            </p>
            <ul style={{ paddingLeft: 20 }}>
              <li>Delivery times: 7-14 business days (varies by destination)</li>
              <li>International shipping rates calculated at checkout</li>
              <li>Customers are responsible for customs fees, duties, or taxes</li>
              <li>Tracking available for all international shipments</li>
            </ul>
          </Section>

          <Section icon={MapPin} title="Shipping Destinations">
            <p style={{ marginBottom: 12 }}>
              We currently ship to:
            </p>
            <ul style={{ paddingLeft: 20 }}>
              <li>All 50 US states and territories</li>
              <li>Canada</li>
              <li>United Kingdom</li>
              <li>European Union countries</li>
              <li>Australia and New Zealand</li>
              <li>Select countries in Asia</li>
            </ul>
            <p style={{ marginTop: 12 }}>
              Don't see your country? Contact us and we'll try to accommodate your request.
            </p>
          </Section>

          <Section icon={AlertCircle} title="Important Notes">
            <div style={{
              padding: 20,
              background: '#fef3c7',
              borderRadius: 12,
              borderLeft: '4px solid #f59e0b',
            }}>
              <ul style={{ paddingLeft: 20, margin: 0 }}>
                <li style={{ marginBottom: 8 }}>
                  Shipping times are estimates and may vary due to weather, holidays, or carrier delays
                </li>
                <li style={{ marginBottom: 8 }}>
                  We are not responsible for delays caused by customs inspections
                </li>
                <li style={{ marginBottom: 8 }}>
                  Please ensure your shipping address is correct - we cannot redirect packages in transit
                </li>
                <li>
                  P.O. Boxes are supported for standard shipping only
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
              <strong>shipping@labdoorcustoms.com</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
