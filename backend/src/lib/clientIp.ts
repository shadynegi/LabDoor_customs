import type { Request } from 'express';

/**
 * Cloudflare proxy IP ranges — refresh periodically from:
 * https://www.cloudflare.com/ips-v4 and https://www.cloudflare.com/ips-v6
 */
export const CLOUDFLARE_IPV4_CIDRS = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
] as const;

export const CLOUDFLARE_IPV6_PREFIXES = [
  '2400:cb00:',
  '2606:4700:',
  '2803:f800:',
  '2405:b500:',
  '2405:8100:',
  '2a06:98c0:',
  '2c0f:f248:',
] as const;

export function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  if (trimmed.startsWith('::ffff:')) {
    return trimmed.slice(7);
  }
  return trimmed;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;

  let value = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    value = (value << 8) + octet;
  }

  return value >>> 0;
}

export function isIpv4InCidr(ip: string, cidr: string): boolean {
  const [network, bitsText] = cidr.split('/');
  const bits = Number(bitsText);
  const ipInt = ipv4ToInt(ip);
  const networkInt = ipv4ToInt(network);

  if (ipInt === null || networkInt === null || !Number.isInteger(bits) || bits < 0 || bits > 32) {
    return false;
  }

  if (bits === 0) return true;

  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (networkInt & mask);
}

function expandIpv6(ip: string): string | null {
  if (!ip.includes(':')) return null;

  const [head, tail = ''] = ip.split('::');
  const headGroups = head ? head.split(':') : [];
  const tailGroups = tail ? tail.split(':') : [];
  const missing = 8 - headGroups.length - tailGroups.length;

  if (missing < 0) return null;

  const groups = [
    ...headGroups,
    ...Array(missing).fill('0'),
    ...tailGroups,
  ].map((group) => group.padStart(4, '0'));

  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/i.test(group))) {
    return null;
  }

  return groups.join(':').toLowerCase();
}

export function isIpv6InCloudflareRange(ip: string): boolean {
  const expanded = expandIpv6(normalizeIp(ip));
  if (!expanded) return false;

  return CLOUDFLARE_IPV6_PREFIXES.some((prefix) => expanded.startsWith(prefix));
}

export function isCloudflareIp(ip: string): boolean {
  const normalized = normalizeIp(ip);
  if (!normalized) return false;

  if (normalized.includes(':')) {
    return isIpv6InCloudflareRange(normalized);
  }

  return CLOUDFLARE_IPV4_CIDRS.some((cidr) => isIpv4InCidr(normalized, cidr));
}

export function isTrustCloudflareEnabled(): boolean {
  return process.env.TRUST_CLOUDFLARE === 'true';
}

/** Immediate peer IP (Railway/proxy socket), before Cloudflare header resolution. */
export function getPeerIp(req: Request): string {
  const fromExpress = req.ip ? normalizeIp(req.ip) : '';
  if (fromExpress) return fromExpress;

  const socketIp = req.socket?.remoteAddress;
  if (socketIp) return normalizeIp(socketIp);

  const forwarded = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim();
  return forwarded ? normalizeIp(forwarded) : 'unknown';
}

/**
 * Resolve the real client IP.
 * When TRUST_CLOUDFLARE=true and the peer is a Cloudflare proxy, prefer CF-Connecting-IP.
 */
export function getClientIp(req: Request): string {
  const peerIp = getPeerIp(req);
  const cfConnectingIp = req.headers['cf-connecting-ip']?.toString().trim();

  if (isTrustCloudflareEnabled() && cfConnectingIp && isCloudflareIp(peerIp)) {
    return normalizeIp(cfConnectingIp);
  }

  if (peerIp && peerIp !== 'unknown') {
    return peerIp;
  }

  const forwarded = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim();
  return forwarded ? normalizeIp(forwarded) : 'unknown';
}
