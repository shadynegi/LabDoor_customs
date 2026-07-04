// src/pages/PrivacyPolicy.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, MessageCircle, Lock, Eye, Database, UserCheck } from 'lucide-react';
import { useResponsive } from '../hooks/useResponsive';
import { buildWhatsAppContactUrl, getWhatsAppContactDisplay } from '../lib/whatsappContact';

export default function PrivacyPolicy() {
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
          <Shield size={48} style={{ marginBottom: 16 }} />
          <h1 style={{ fontSize: isMobile ? 32 : 42, fontWeight: 800, marginBottom: 12 }}>
            Privacy Policy
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
            At Lab Door Customs, we are committed to protecting your privacy and ensuring the security 
            of your personal information. This Privacy Policy explains how we collect, use, and safeguard 
            your data when you visit our website or make a purchase.
          </p>

          <Section icon={Database} title="Information We Collect">
            <p style={{ marginBottom: 12 }}>
              We collect information you provide directly to us when you:
            </p>
            <ul style={{ paddingLeft: 20, marginBottom: 16 }}>
              <li>Create an account or make a purchase</li>
              <li>Subscribe to our newsletter</li>
              <li>Contact customer support</li>
              <li>Participate in surveys or promotions</li>
            </ul>
            <p>
              This may include your name, email address, shipping address, phone number, and payment information.
            </p>
          </Section>

          <Section icon={Eye} title="How We Use Your Information">
            <ul style={{ paddingLeft: 20 }}>
              <li>Process and fulfill your orders</li>
              <li>Send order confirmations and shipping updates via WhatsApp (when configured)</li>
              <li>Respond to your questions and requests</li>
              <li>Improve our products and services</li>
              <li>Detect and prevent fraud</li>
            </ul>
          </Section>

          <Section icon={Lock} title="Information Sharing">
            <p>
              We do not sell or rent your personal information to third parties. We may share your 
              information with service providers who help us operate our business (e.g., payment processors, 
              shipping companies) under strict confidentiality agreements.
            </p>
          </Section>

          <Section icon={Shield} title="Data Security">
            <p>
              We use industry-standard security measures to protect your information, including encryption, 
              secure servers, and regular security audits. All payment transactions are processed through 
              secure, PCI-compliant payment processors. However, no method of transmission over the internet 
              is 100% secure.
            </p>
          </Section>

          <Section icon={UserCheck} title="Your Rights">
            <p style={{ marginBottom: 12 }}>You have the right to:</p>
            <ul style={{ paddingLeft: 20, marginBottom: 16 }}>
              <li>Access and review your personal information</li>
              <li>Request corrections to inaccurate data</li>
              <li>Request deletion of your data (subject to legal requirements)</li>
              <li>Opt-out of marketing messages at any time</li>
              <li>Data portability - receive a copy of your data in a structured format</li>
            </ul>
          </Section>

          <Section icon={MessageCircle} title="Contact Us">
            <p>
              For privacy-related questions or to exercise your rights, message us on WhatsApp:
            </p>
            <div style={{
              marginTop: 16,
              padding: 20,
              background: '#f9fafb',
              borderRadius: 12,
              borderLeft: '4px solid #9c6649',
            }}>
              <p style={{ margin: 0, fontWeight: 600, color: '#1f2937' }}>
                <a href={buildWhatsAppContactUrl()} target="_blank" rel="noopener noreferrer" style={{ color: '#9c6649' }}>
                  {getWhatsAppContactDisplay()}
                </a>
              </p>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
