/** Store contact number from VITE_WHATSAPP_CONTACT_NUMBER (must match backend WHATSAPP_CONTACT_NUMBER). */
function getRaw(): string {
  return (import.meta.env.VITE_WHATSAPP_CONTACT_NUMBER as string | undefined)?.trim() ?? '';
}

export function getWhatsAppContactDisplay(): string {
  const raw = getRaw();
  if (!raw) return '';
  if (raw.startsWith('+')) return raw;
  const digits = raw.replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

export function getWhatsAppContactDigits(): string {
  return getRaw().replace(/\D/g, '');
}

export function buildWhatsAppContactUrl(message?: string): string {
  const phone = getWhatsAppContactDigits();
  if (!phone) return '#';
  const base = `https://wa.me/${phone}`;
  if (!message?.trim()) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}

export interface ContactFormFields {
  name: string;
  email: string;
  subject: string;
  message: string;
  phone?: string;
}

export type ContactFormValidationResult =
  | { ok: true; data: ContactFormFields }
  | { ok: false; error: string; description: string };

/** Client-side validation aligned with the former contact API rules. */
export function validateContactForm(fields: ContactFormFields): ContactFormValidationResult {
  const name = fields.name.trim();
  const email = fields.email.trim().toLowerCase();
  const subject = fields.subject.trim();
  const message = fields.message.trim();
  const phone = fields.phone?.trim();

  if (!name) {
    return { ok: false, error: 'Name is required', description: 'Please provide your name' };
  }
  if (!email) {
    return { ok: false, error: 'Email is required', description: 'Please provide your email address' };
  }
  if (!subject) {
    return { ok: false, error: 'Subject is required', description: 'Please provide a subject for your message' };
  }
  if (!message) {
    return { ok: false, error: 'Message is required', description: 'Please write your message' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      ok: false,
      error: 'Invalid email format',
      description: 'Please provide a valid email address (e.g., user@example.com)',
    };
  }
  if (name.length > 100) {
    return { ok: false, error: 'Name too long', description: 'Name must be less than 100 characters' };
  }
  if (subject.length > 200) {
    return { ok: false, error: 'Subject too long', description: 'Subject must be less than 200 characters' };
  }
  if (message.length > 2000) {
    return { ok: false, error: 'Message too long', description: 'Message must be less than 2000 characters' };
  }

  return {
    ok: true,
    data: { name, email, subject, message, ...(phone ? { phone } : {}) },
  };
}

/** Prefilled WhatsApp body for the contact form (wa.me `text` parameter). */
export function formatContactFormWhatsAppMessage(data: ContactFormFields): string {
  const lines = [
    'New Contact Form Submission',
    '',
    `Name: ${data.name}`,
    `Email: ${data.email}`,
  ];
  if (data.phone?.trim()) {
    lines.push(`Phone: ${data.phone.trim()}`);
  }
  lines.push(`Subject: ${data.subject}`, '', 'Message:', data.message);
  return lines.join('\n');
}
