// src/pages/ReturnsPolicy.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw, CheckCircle, XCircle, Clock, CreditCard, HelpCircle } from 'lucide-react';

export default function ReturnsPolicy() {
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
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
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
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          borderRadius: 20,
          padding: isMobile ? '32px 24px' : '48px',
          marginBottom: 32,
          textAlign: 'center',
          color: 'white',
        }}>
          <RotateCcw size={48} style={{ marginBottom: 16 }} />
          <h1 style={{ fontSize: isMobile ? 32 : 42, fontWeight: 800, marginBottom: 12 }}>
            Returns & Refunds
          </h1>
          <p style={{ opacity: 0.9, fontSize: 16 }}>
            30-Day Hassle-Free Returns
          </p>
        </div>

        {/* Content */}
        <div style={{
          background: 'white',
          borderRadius: 20,
          padding: isMobile ? 24 : 48,
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        }}>
          <p style={{ fontSize: 16, color: '#6b7280', lineHeight: 1.8, marginBottom: 32 }}>
            We want you to be completely satisfied with your purchase. If for any reason you're not 
            happy with your order, we offer a straightforward 30-day return policy.
          </p>

          <Section icon={CheckCircle} title="What Can Be Returned">
            <ul style={{ paddingLeft: 20 }}>
              <li>Unworn items in original condition</li>
              <li>Items with all original tags attached</li>
              <li>Items in original packaging/box</li>
              <li>Items returned within 30 days of delivery</li>
              <li>Defective or damaged items (contact us immediately)</li>
            </ul>
          </Section>

          <Section icon={XCircle} title="What Cannot Be Returned">
            <ul style={{ paddingLeft: 20 }}>
              <li>Worn or used items</li>
              <li>Items without original tags</li>
              <li>Items marked as "Final Sale"</li>
              <li>Gift cards</li>
              <li>Items returned after 30 days</li>
              <li>Items damaged due to misuse or improper care</li>
            </ul>
          </Section>

          <Section icon={RotateCcw} title="How to Return">
            <ol style={{ paddingLeft: 20 }}>
              <li style={{ marginBottom: 12 }}>
                <strong>Contact Us:</strong> Email returns@labdoorcustoms.com with your order number 
                and reason for return
              </li>
              <li style={{ marginBottom: 12 }}>
                <strong>Receive Authorization:</strong> We'll send you a return authorization number 
                and shipping instructions within 24-48 hours
              </li>
              <li style={{ marginBottom: 12 }}>
                <strong>Pack Securely:</strong> Place items in original packaging with all tags attached
              </li>
              <li style={{ marginBottom: 12 }}>
                <strong>Ship:</strong> Send to the address provided (customer pays return shipping 
                unless item is defective)
              </li>
              <li>
                <strong>Receive Refund:</strong> Once we receive and inspect your return, we'll 
                process your refund
              </li>
            </ol>
          </Section>

          <Section icon={CreditCard} title="Refund Processing">
            <ul style={{ paddingLeft: 20 }}>
              <li>Refunds are processed within 5-7 business days of receiving the return</li>
              <li>Refunds are issued to the original payment method</li>
              <li>Original shipping costs are non-refundable (unless item is defective)</li>
              <li>You will receive an email confirmation when your refund is processed</li>
              <li>Allow 3-5 additional business days for the refund to appear in your account</li>
            </ul>
          </Section>

          <Section icon={Clock} title="Exchanges">
            <p style={{ marginBottom: 12 }}>
              Need a different size or color? We're happy to help!
            </p>
            <ul style={{ paddingLeft: 20 }}>
              <li>Contact us within 30 days of delivery for exchanges</li>
              <li>Subject to availability of the replacement item</li>
              <li>Free exchange shipping for defective items</li>
              <li>Standard return shipping applies for size/preference exchanges</li>
            </ul>
          </Section>

          <Section icon={HelpCircle} title="Questions?">
            <p>
              Our customer service team is here to help with any return-related questions.
            </p>
            <div style={{
              marginTop: 16,
              padding: 20,
              background: '#f0fdf4',
              borderRadius: 12,
              border: '1px solid #10b981',
            }}>
              <p style={{ margin: 0, marginBottom: 8 }}>
                <strong>Email:</strong> returns@labdoorcustoms.com
              </p>
              <p style={{ margin: 0 }}>
                <strong>Response Time:</strong> Within 24 hours
              </p>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
