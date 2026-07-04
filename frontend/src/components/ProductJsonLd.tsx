import { useEffect } from 'react';
import { getSiteUrl } from '../lib/site';

export interface ProductJsonLdProps {
  id: number;
  publicId?: string;
  name: string;
  description?: string;
  image?: string;
  price: number;
  inStock?: boolean;
}

export default function ProductJsonLd({
  id,
  publicId,
  name,
  description,
  image,
  price,
  inStock = true,
}: ProductJsonLdProps) {
  const siteUrl = getSiteUrl();

  useEffect(() => {
    const imageUrl =
      image && (image.startsWith('http://') || image.startsWith('https://'))
        ? image
        : image
          ? `${siteUrl}${image.startsWith('/') ? image : `/${image}`}`
          : `${siteUrl}/favicon.png`;

    const schema: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name,
      description: description || `${name} — Lab Door Customs`,
      image: imageUrl,
      sku: String(id),
      offers: {
        '@type': 'Offer',
        url: `${siteUrl}/product/${publicId ?? id}`,
        priceCurrency: 'USD',
        price: price.toFixed(2),
        availability: inStock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      },
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'product-json-ld';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      document.getElementById('product-json-ld')?.remove();
    };
  }, [id, publicId, name, description, image, price, inStock, siteUrl]);

  return null;
}
