import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import {
  getClientIp,
  getPeerIp,
  isCloudflareIp,
  isIpv4InCidr,
  normalizeIp,
} from '../../../../backend/src/lib/clientIp';

function mockRequest(overrides: Partial<Request> & { headers?: Record<string, string> } = {}): Request {
  return {
    ip: undefined,
    socket: { remoteAddress: undefined },
    headers: {},
    ...overrides,
  } as Request;
}

describe('clientIp', () => {
  it('normalizes IPv4-mapped IPv6 addresses', () => {
    expect(normalizeIp('::ffff:173.245.48.1')).toBe('173.245.48.1');
  });

  it('matches Cloudflare IPv4 CIDR ranges', () => {
    expect(isIpv4InCidr('173.245.48.10', '173.245.48.0/20')).toBe(true);
    expect(isIpv4InCidr('8.8.8.8', '173.245.48.0/20')).toBe(false);
    expect(isCloudflareIp('104.16.2.3')).toBe(true);
  });

  it('uses CF-Connecting-IP when peer is Cloudflare and TRUST_CLOUDFLARE is enabled', () => {
    const previous = process.env.TRUST_CLOUDFLARE;
    process.env.TRUST_CLOUDFLARE = 'true';

    const req = mockRequest({
      ip: '104.16.2.3',
      headers: {
        'cf-connecting-ip': '203.0.113.50',
        'cf-ray': 'abc123',
      },
    });

    expect(getClientIp(req)).toBe('203.0.113.50');
    process.env.TRUST_CLOUDFLARE = previous;
  });

  it('does not trust CF-Connecting-IP from non-Cloudflare peers', () => {
    const previous = process.env.TRUST_CLOUDFLARE;
    process.env.TRUST_CLOUDFLARE = 'true';

    const req = mockRequest({
      ip: '203.0.113.99',
      headers: {
        'cf-connecting-ip': '1.2.3.4',
      },
    });

    expect(getClientIp(req)).toBe('203.0.113.99');
    process.env.TRUST_CLOUDFLARE = previous;
  });

  it('falls back to peer IP when TRUST_CLOUDFLARE is disabled', () => {
    const previous = process.env.TRUST_CLOUDFLARE;
    delete process.env.TRUST_CLOUDFLARE;

    const req = mockRequest({
      ip: '104.16.2.3',
      headers: {
        'cf-connecting-ip': '203.0.113.50',
      },
    });

    expect(getClientIp(req)).toBe('104.16.2.3');
    process.env.TRUST_CLOUDFLARE = previous;
  });

  it('getPeerIp prefers req.ip', () => {
    const req = mockRequest({
      ip: '10.0.0.5',
      socket: { remoteAddress: '10.0.0.9' },
    });

    expect(getPeerIp(req)).toBe('10.0.0.5');
  });
});
