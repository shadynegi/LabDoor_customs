import { sanitizeObject, sanitizeString } from './sanitize';

export interface CheckoutCustomerInfo {
  fullName: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

const MAX_FIELD = 200;

function clip(value: string, max = MAX_FIELD): string {
  return value.slice(0, max);
}

/** Sanitize checkout customer fields before persistence. */
export function sanitizeCustomerInfo(info: CheckoutCustomerInfo): CheckoutCustomerInfo {
  return {
    fullName: clip(sanitizeString(info.fullName)),
    email: clip(sanitizeString(info.email)?.toLowerCase() ?? ''),
    phone: info.phone ? clip(sanitizeString(info.phone), 30) : undefined,
    address: info.address ? clip(sanitizeString(info.address)) : undefined,
    city: info.city ? clip(sanitizeString(info.city), 100) : undefined,
    state: info.state ? clip(sanitizeString(info.state), 100) : undefined,
    zipCode: info.zipCode ? clip(sanitizeString(info.zipCode), 20) : undefined,
    country: info.country ? clip(sanitizeString(info.country), 100) : undefined,
  };
}

export function sanitizeCustomerInfoLoose(info: Record<string, unknown>): CheckoutCustomerInfo {
  return sanitizeCustomerInfo(sanitizeObject(info) as unknown as CheckoutCustomerInfo);
}
