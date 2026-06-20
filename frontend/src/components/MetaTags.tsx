import { useEffect } from 'react';
import { getSiteUrl } from '../lib/site';

export interface MetaTagsProps {
  title: string;
  description: string;
  /** Path only, e.g. `/products` or `/product/12` */
  path?: string;
  /** Absolute URL or site-relative path */
  image?: string;
  type?: 'website' | 'product';
  noIndex?: boolean;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string): void {
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function resolveImage(siteUrl: string, image?: string): string {
  if (!image) return `${siteUrl}/favicon.png`;
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  return `${siteUrl}${image.startsWith('/') ? image : `/${image}`}`;
}

export default function MetaTags({
  title,
  description,
  path = '',
  image,
  type = 'website',
  noIndex = false,
}: MetaTagsProps) {
  const siteUrl = getSiteUrl();
  const canonical = `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const imageUrl = resolveImage(siteUrl, image);

  useEffect(() => {
    document.title = title;
    upsertMeta('name', 'description', description);
    upsertLink('canonical', canonical);

    upsertMeta('name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow');

    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:type', type);
    upsertMeta('property', 'og:url', canonical);
    upsertMeta('property', 'og:image', imageUrl);
    upsertMeta('property', 'og:site_name', 'Lab Door Customs');

    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', imageUrl);
  }, [title, description, canonical, imageUrl, type, noIndex]);

  return null;
}
