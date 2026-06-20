// Replacement policy — all sales final; manufacturing-defect replacements only
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useResponsive } from '../hooks/useResponsive';
import {
  ArrowLeft,
  ShieldCheck,
  XCircle,
  Package,
  Camera,
  Mail,
  AlertTriangle,
} from 'lucide-react';
import {
  NO_REFUND_POLICY_SHORT,
  REPLACEMENT_POLICY_SHORT,
  REPLACEMENT_SUPPORT_EMAIL,
} from '../constants/returnPolicy';

export default function ReturnsPolicy() {
  const navigate = useNavigate();
  const { isMobile } = useResponsive();

  const Section = ({
    icon: Icon,
    title,
    children,
  }: {
    icon: React.ComponentType<{ size?: number; color?: string }>;
    title: string;
    children: React.ReactNode;
  }) => (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #361906 0%, #9c6649 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
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
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f5e0d5 0%, #9c6649 55%, #361906 100%)',
        padding: isMobile ? '20px' : '40px',
      }}
    >
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <button
          type="button"
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

        <div
          style={{
            background: 'linear-gradient(135deg, #361906 0%, #9c6649 100%)',
            borderRadius: 20,
            padding: isMobile ? '32px 24px' : '48px',
            marginBottom: 32,
            textAlign: 'center',
            color: 'white',
          }}
        >
          <ShieldCheck size={48} style={{ marginBottom: 16 }} />
          <h1 style={{ fontSize: isMobile ? 32 : 42, fontWeight: 800, marginBottom: 12 }}>
            Replacement Policy
          </h1>
          <p style={{ opacity: 0.95, fontSize: 16, maxWidth: 560, margin: '0 auto' }}>
            All sales are final — no refunds. Replacements are offered only for verified manufacturing
            defects.
          </p>
        </div>

        <div
          style={{
            background: '#fff7ed',
            border: '2px solid #fdba74',
            borderRadius: 16,
            padding: 20,
            marginBottom: 24,
            color: '#9a3412',
            fontSize: 15,
            lineHeight: 1.7,
          }}
        >
          <strong>No refund policy:</strong> {NO_REFUND_POLICY_SHORT}
        </div>

        <div
          style={{
            background: 'white',
            borderRadius: 20,
            padding: isMobile ? 24 : 48,
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          }}
        >
          <p style={{ fontSize: 16, color: '#6b7280', lineHeight: 1.8, marginBottom: 32 }}>
            {REPLACEMENT_POLICY_SHORT} By completing checkout, you agree to this policy and our{' '}
            <Link to="/terms-of-service" style={{ color: '#9c6649', fontWeight: 600 }}>
              Terms of Service
            </Link>
            .
          </p>

          <Section icon={XCircle} title="What we do not offer">
            <ul style={{ paddingLeft: 20 }}>
              <li>Refunds to your original payment method (PayPal or card)</li>
              <li>Returns or exchanges for size, fit, color, or change of mind</li>
              <li>Store credit in place of a refund</li>
              <li>Replacements for wear-and-tear, misuse, or damage after delivery</li>
            </ul>
          </Section>

          <Section icon={ShieldCheck} title="When a replacement may be approved">
            <p style={{ marginBottom: 12 }}>A one-time replacement of the <strong>same item</strong> may be approved when:</p>
            <ul style={{ paddingLeft: 20 }}>
              <li>You contact us within <strong>30 days of delivery</strong></li>
              <li>The issue is a <strong>manufacturing defect</strong> (e.g. sole separation, structural flaw, misaligned stitching from production — not normal wear)</li>
              <li>The shoes were not worn beyond inspection needed to identify the defect</li>
              <li>We can verify the defect with photos or video you provide</li>
              <li>Replacement stock is available for your size and style</li>
            </ul>
          </Section>

          <Section icon={Camera} title="How to request a replacement">
            <ol style={{ paddingLeft: 20 }}>
              <li style={{ marginBottom: 12 }}>
                Email{' '}
                <a href={`mailto:${REPLACEMENT_SUPPORT_EMAIL}`} style={{ color: '#9c6649', fontWeight: 600 }}>
                  {REPLACEMENT_SUPPORT_EMAIL}
                </a>{' '}
                with your <strong>order number</strong> and a clear description of the defect
              </li>
              <li style={{ marginBottom: 12 }}>
                Attach <strong>photos or video</strong> showing the defect and the overall product
              </li>
              <li style={{ marginBottom: 12 }}>
                Our team reviews your claim within <strong>2–3 business days</strong>
              </li>
              <li style={{ marginBottom: 12 }}>
                If approved, we ship a replacement pair; you may be asked to return the defective pair
                (we cover return shipping when the defect is verified)
              </li>
              <li>Replacement fulfillment typically ships within 5–10 business days after approval</li>
            </ol>
          </Section>

          <Section icon={Package} title="PayPal purchases">
            <p>
              Payments are processed through PayPal. Because all sales are final, PayPal&apos;s standard
              buyer protection does not entitle you to a refund for preference or fit issues. If you
              believe you have a manufacturing defect, follow the replacement process above — do not
              open a PayPal dispute for a refund before contacting us.
            </p>
          </Section>

          <Section icon={AlertTriangle} title="Important notes">
            <ul style={{ paddingLeft: 20 }}>
              <li>Approval is at Lab Door Customs&apos; sole discretion after review</li>
              <li>One replacement per order line for a verified manufacturing defect</li>
              <li>Custom or made-to-order items follow the same no-refund rule</li>
              <li>
                See also our{' '}
                <Link to="/terms-of-service" style={{ color: '#9c6649' }}>
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/help" style={{ color: '#9c6649' }}>
                  Help Center
                </Link>
              </li>
            </ul>
          </Section>

          <Section icon={Mail} title="Contact">
            <div
              style={{
                marginTop: 8,
                padding: 20,
                background: '#f9fafb',
                borderRadius: 12,
                border: '1px solid #e5e7eb',
              }}
            >
              <p style={{ margin: 0, marginBottom: 8 }}>
                <strong>Replacement requests:</strong>{' '}
                <a href={`mailto:${REPLACEMENT_SUPPORT_EMAIL}`}>{REPLACEMENT_SUPPORT_EMAIL}</a>
              </p>
              <p style={{ margin: 0 }}>
                <strong>Response time:</strong> Within 2–3 business days
              </p>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
