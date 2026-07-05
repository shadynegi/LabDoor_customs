import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  buildWhatsAppContactUrl,
  formatContactFormWhatsAppMessage,
  getWhatsAppContactDisplay,
  validateContactForm,
} from '../../../../frontend/src/lib/whatsappContact';

describe('whatsappContact', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_WHATSAPP_CONTACT_NUMBER', '+919888514572');
  });

  it('formats display number with leading plus', () => {
    expect(getWhatsAppContactDisplay()).toBe('+919888514572');
  });

  it('builds wa.me URL with encoded message', () => {
    const url = buildWhatsAppContactUrl('Hello world');
    expect(url).toBe('https://wa.me/919888514572?text=Hello%20world');
  });

  it('rejects invalid contact form fields', () => {
    const result = validateContactForm({
      name: '',
      email: 'bad',
      subject: 'Help',
      message: 'Hi',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Name is required');
    }
  });

  it('accepts valid contact form fields', () => {
    const result = validateContactForm({
      name: 'Alex',
      email: 'Alex@Example.com',
      subject: 'Order question',
      message: 'Where is my order?',
      phone: '555-0100',
    });
    expect(result).toEqual({
      ok: true,
      data: {
        name: 'Alex',
        email: 'alex@example.com',
        subject: 'Order question',
        message: 'Where is my order?',
        phone: '555-0100',
      },
    });
  });

  it('formats WhatsApp body for contact submissions', () => {
    const body = formatContactFormWhatsAppMessage({
      name: 'Alex',
      email: 'alex@example.com',
      subject: 'Sizing',
      message: 'Need size 10',
      phone: '+1 555-0100',
    });
    expect(body).toContain('New Contact Form Submission');
    expect(body).toContain('Name: Alex');
    expect(body).toContain('Phone: +1 555-0100');
    expect(body).toContain('Message:\nNeed size 10');
  });
});
