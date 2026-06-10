import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildOrderPortalUrl } from '../../backend/src/lib/email';
import * as orderAccessExchange from '../../backend/src/lib/orderAccessExchange';

describe('buildOrderPortalUrl', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns /orders when orderId is missing', async () => {
    const url = await buildOrderPortalUrl({}, 'https://shop.example.com');
    expect(url).toBe('https://shop.example.com/orders');
  });

  it('mints access exchange code when orderId and accessToken are provided', async () => {
    vi.spyOn(orderAccessExchange, 'createOrderAccessExchangeCode').mockResolvedValue('EMAIL-CODE-ABC');

    const url = await buildOrderPortalUrl(
      { orderId: '00000000-0000-0000-0000-00000000aa01', accessToken: 'a'.repeat(64) },
      'https://shop.example.com'
    );

    expect(url).toBe('https://shop.example.com/orders?code=EMAIL-CODE-ABC');
    expect(orderAccessExchange.createOrderAccessExchangeCode).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-00000000aa01',
      'a'.repeat(64)
    );
  });

  it('falls back to durable order token minting when accessToken is omitted', async () => {
    vi.spyOn(orderAccessExchange, 'issueOrderTrackingExchangeFromOrder').mockResolvedValue(
      'DURABLE-CODE-XYZ'
    );

    const url = await buildOrderPortalUrl(
      { orderId: '00000000-0000-0000-0000-00000000bb02' },
      'https://shop.example.com'
    );

    expect(url).toBe('https://shop.example.com/orders?code=DURABLE-CODE-XYZ');
    expect(orderAccessExchange.issueOrderTrackingExchangeFromOrder).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-00000000bb02'
    );
  });

  it('returns plain /orders when durable minting fails', async () => {
    vi.spyOn(orderAccessExchange, 'issueOrderTrackingExchangeFromOrder').mockResolvedValue(null);

    const url = await buildOrderPortalUrl(
      { orderId: '00000000-0000-0000-0000-00000000cc03' },
      'https://shop.example.com'
    );

    expect(url).toBe('https://shop.example.com/orders');
  });
});
