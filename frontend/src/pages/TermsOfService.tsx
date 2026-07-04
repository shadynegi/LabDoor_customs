// src/pages/TermsOfService.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useResponsive } from '../hooks/useResponsive';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Scale, ShoppingBag, AlertTriangle, Copyright, Globe, ShieldCheck } from 'lucide-react';
import { NO_REFUND_POLICY_SHORT, REPLACEMENT_POLICY_SHORT } from '../constants/returnPolicy';
import { buildWhatsAppContactUrl, getWhatsAppContactDisplay } from '../lib/whatsappContact';

export default function TermsOfService() {
  const navigate = useNavigate();
  const { isMobile } = useResponsive();

  const Section = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
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
      minHeight: '100dvh',
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
          background: 'linear-gradient(135deg, #361906 0%, #9c6649 100%)',
          borderRadius: 20,
          padding: isMobile ? '32px 24px' : '48px',
          marginBottom: 32,
          textAlign: 'center',
          color: 'white',
        }}>
          <FileText size={48} style={{ marginBottom: 16 }} />
          <h1 style={{ fontSize: isMobile ? 32 : 42, fontWeight: 800, marginBottom: 12 }}>
            Terms of Service
          </h1>
          <p style={{ opacity: 0.9, fontSize: 16 }}>
            Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
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
            Welcome to Lab Door Customs. By accessing and using our website and services, you agree to 
            be bound by these Terms of Service. Please read them carefully before making a purchase.
          </p>

          <Section icon={Scale} title="Acceptance of Terms">
            <p>
              By accessing and using Lab Door Customs' website and services, you agree to be bound by 
              these Terms and Conditions. If you do not agree with any part of these terms, you may not 
              use our services. We reserve the right to update these terms at any time, and your continued 
              use of the site constitutes acceptance of any changes.
            </p>
          </Section>

          <Section icon={ShieldCheck} title="No Refund & Replacement Policy">
            <p style={{ marginBottom: 12 }}>
              <strong>All sales are final.</strong> {NO_REFUND_POLICY_SHORT}
            </p>
            <p style={{ marginBottom: 12 }}>{REPLACEMENT_POLICY_SHORT}</p>
            <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
              <li>By placing an order, you acknowledge and agree to this no-refund policy</li>
              <li>Replacements are not guaranteed until we verify a manufacturing defect</li>
              <li>
                Message us on{' '}
                <a href={buildWhatsAppContactUrl()} target="_blank" rel="noopener noreferrer">
                  {getWhatsAppContactDisplay()}
                </a>{' '}
                with your order number and photos
              </li>
            </ul>
            <p style={{ margin: 0 }}>
              Full details:{' '}
              <Link to="/returns-policy" style={{ color: '#9c6649', fontWeight: 600 }}>
                Replacement Policy
              </Link>
            </p>
          </Section>

          <Section icon={ShoppingBag} title="Product Information & Pricing">
            <p style={{ marginBottom: 12 }}>
              We strive to provide accurate product descriptions and pricing. However:
            </p>
            <ul style={{ paddingLeft: 20 }}>
              <li>Product colors may vary slightly due to monitor settings and lighting</li>
              <li>Prices are subject to change without prior notice</li>
              <li>We reserve the right to limit quantities per customer</li>
              <li>We reserve the right to refuse or cancel any order</li>
              <li>In case of pricing errors, we will notify you before processing</li>
            </ul>
          </Section>

          <Section icon={FileText} title="Orders & Payment">
            <p style={{ marginBottom: 12 }}>
              When you place an order with us:
            </p>
            <ul style={{ paddingLeft: 20 }}>
              <li>You warrant that you are legally capable of entering into binding contracts</li>
              <li>You warrant that all information provided is true and accurate</li>
              <li>Payment is arranged via WhatsApp after you place your order on the site</li>
              <li>You must accept the No Refund & Replacement Policy before checkout</li>
              <li>Orders are subject to product availability and are final once paid</li>
            </ul>
          </Section>

          <Section icon={Copyright} title="Intellectual Property">
            <p>
              All content on this website, including text, graphics, logos, images, product designs, 
              and software, is the property of Lab Door Customs and is protected by copyright and 
              trademark laws. Unauthorized reproduction, modification, distribution, or use of any 
              content is strictly prohibited and may result in legal action.
            </p>
          </Section>

          <Section icon={AlertTriangle} title="Limitation of Liability">
            <p style={{ marginBottom: 12 }}>
              Lab Door Customs shall not be liable for:
            </p>
            <ul style={{ paddingLeft: 20, marginBottom: 16 }}>
              <li>Any indirect, incidental, special, or consequential damages</li>
              <li>Loss of profits, data, or other intangible losses</li>
              <li>Damages arising from your use or inability to use our services</li>
              <li>Any unauthorized access to your personal information</li>
            </ul>
            <p>
              Our total liability shall not exceed the amount you paid for the product in question.
            </p>
          </Section>

          <Section icon={Globe} title="Governing Law">
            <p>
              These Terms of Service are governed by and construed in accordance with the laws of 
              the State of New York, United States, without regard to its conflict of law provisions. 
              Any disputes arising from these terms shall be resolved in the courts of New York.
            </p>
          </Section>

          <div style={{
            marginTop: 32,
            padding: 20,
            background: '#f9fafb',
            borderRadius: 12,
            borderLeft: '4px solid #9c6649',
          }}>
            <p style={{ margin: 0, color: '#4b5563', fontSize: 14 }}>
              For questions about these Terms of Service, please contact us at{' '}
              <strong>legal@labdoorcustoms.com</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
