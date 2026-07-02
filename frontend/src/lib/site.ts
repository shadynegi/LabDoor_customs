/** Canonical site URL for SEO, OG tags, and sitemap (no trailing slash). */
export function getSiteUrl(): string {
  const raw = import.meta.env.VITE_SITE_URL || 'https://www.labdoorcustoms.com';
  return raw.replace(/\/$/, '');
}

export const SITE_NAME = 'Lab Door Customs';

export const SITE_EMAILS = {
  privacy: 'privacy@labdoorcustoms.com',
  support: 'support@labdoorcustoms.com',
  legal: 'legal@labdoorcustoms.com',
} as const;

export const DEFAULT_META = {
  title: `${SITE_NAME} — Premium Custom Footwear`,
  description:
    'Shop premium custom footwear at Lab Door Customs. Browse styles, order online, and track your purchase.',
} as const;
