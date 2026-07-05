import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  formatContactFormWhatsAppMessage,
  validateContactForm,
  buildWhatsAppContactUrl,
} from '../../../../frontend/src/lib/whatsappContact';

describe('contact WhatsApp helpers', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_WHATSAPP_CONTACT_NUMBER', '+919888514572');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('formats contact form message with all fields', () => {
    const message = formatContactFormWhatsAppMessage({
      name: 'Jane Doe',
      email: 'jane@example.com',
      subject: 'Order help',
      message: 'Need sizing advice.',
    });
    expect(message).toContain('New Contact Form Submission');
    expect(message).toContain('Name: Jane Doe');
    expect(message).toContain('Email: jane@example.com');
    expect(message).toContain('Subject: Order help');
    expect(message).toContain('Message:');
    expect(message).toContain('Need sizing advice.');
  });

  it('rejects empty contact form fields', () => {
    expect(validateContactForm({ name: '', email: '', subject: '', message: '' }).ok).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = validateContactForm({
      name: 'Jane',
      email: 'not-an-email',
      subject: 'Hi',
      message: 'Hello',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Invalid email format');
    }
  });

  it('rejects whitespace-only fields', () => {
    const result = validateContactForm({
      name: '   ',
      email: 'jane@example.com',
      subject: 'Help',
      message: 'Hello',
    });
    expect(result.ok).toBe(false);
  });

  it('buildWhatsAppContactUrl encodes the contact message', () => {
    const url = buildWhatsAppContactUrl('Hello & welcome');
    expect(url).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    expect(url).toContain(encodeURIComponent('Hello & welcome'));
  });
});
