import { describe, it, expect } from 'vitest';
import { buildOrderPortalUrl } from '../../../../backend/src/lib/orderPortalUrl';

describe('buildOrderPortalUrl', () => {
  it('returns /orders when orderId is missing', () => {
    const url = buildOrderPortalUrl({}, 'https://shop.example.com');
    expect(url).toBe('https://shop.example.com/orders');
  });

  it('returns /orders?orderId= when orderId is provided', () => {
    const url = buildOrderPortalUrl(
      { orderId: '00000000-0000-0000-0000-00000000aa01' },
      'https://shop.example.com'
    );

    expect(url).toBe(
      'https://shop.example.com/orders?orderId=00000000-0000-0000-0000-00000000aa01'
    );
  });

  it('URL-encodes orderId query param', () => {
    const url = buildOrderPortalUrl(
      { orderId: '00000000-0000-4000-8000-000000000099' },
      'https://shop.example.com'
    );

    expect(url).toContain('orderId=00000000-0000-4000-8000-000000000099');
  });
});
