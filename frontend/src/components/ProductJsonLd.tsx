import { useEffect } from 'react';
import { getSiteUrl } from '../lib/site';

export interface ProductJsonLdProps {
  id: number;
  name: string;
  description?: string;
  image?: string;
  price: number;
  inStock?: boolean;
  rating?: number;
  reviewCount?: number;
}

export default function ProductJsonLd({
  id,
  name,
  description,
  image,
  price,
  inStock = true,
  rating,
  reviewCount,
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
        url: `${siteUrl}/product/${id}`,
        priceCurrency: 'USD',
        price: price.toFixed(2),
        availability: inStock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      },
    };

    if (rating && reviewCount && reviewCount > 0) {
      schema.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: rating.toFixed(1),
        reviewCount,
      };
    }

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'product-json-ld';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      document.getElementById('product-json-ld')?.remove();
    };
  }, [id, name, description, image, price, inStock, rating, reviewCount, siteUrl]);

  return null;
}
