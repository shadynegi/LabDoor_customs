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
