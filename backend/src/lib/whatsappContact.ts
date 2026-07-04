/** Store contact number from WHATSAPP_CONTACT_NUMBER (E.164, e.g. +919888514572). */
export function getWhatsAppContactNumberRaw(): string {
  return process.env.WHATSAPP_CONTACT_NUMBER?.trim() ?? '';
}

/** Digits only — used for wa.me links. */
export function getWhatsAppContactDigits(): string {
  return getWhatsAppContactNumberRaw().replace(/\D/g, '');
}

/** Human-readable E.164 display (adds leading + when missing). */
export function formatWhatsAppContactDisplay(): string {
  const raw = getWhatsAppContactNumberRaw();
  if (!raw) return '';
  if (raw.startsWith('+')) return raw;
  const digits = getWhatsAppContactDigits();
  return digits ? `+${digits}` : '';
}

export function buildWhatsAppContactUrl(message?: string): string {
  const phone = getWhatsAppContactDigits();
  if (!phone) return '';
  const base = `https://wa.me/${phone}`;
  if (!message?.trim()) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}
