// Activity tracking utility for user behavior analytics
import { config, slowApiFetch } from '../config';
import { logDebug } from '../lib/logger';
import { hasAnalyticsConsent } from '../lib/analytics';

// Generate or get session ID
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('sessionId');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('sessionId', sessionId);
  }
  return sessionId;
};

const getUserEmail = (): string | null => {
  if (!hasAnalyticsConsent()) return null;
  return sessionStorage.getItem('userEmail');
};

// Action types
export type ActionType =
  | 'page_view'
  | 'product_view'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'checkout_start'
  | 'checkout_complete'
  | 'purchase_complete'
  | 'search'
  | 'filter_apply'
  | 'contact_submit'
  | 'size_select'
  | 'quantity_change';

interface ActivityData {
  actionType: ActionType;
  entityType?: 'product' | 'order' | 'cart' | 'page';
  entityId?: string | number;
  entityName?: string;
  metadata?: Record<string, unknown>;
  pageUrl?: string;
  referrer?: string;
}

// Queue for batching activities
let activityQueue: ActivityData[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;

// Flush the activity queue to the server
const flushQueue = async () => {
  if (activityQueue.length === 0) return;

  const activities = activityQueue.map((activity) => ({
    ...activity,
    sessionId: getSessionId(),
    userEmail: getUserEmail(),
    pageUrl: activity.pageUrl || window.location.href,
    referrer: activity.referrer || document.referrer,
  }));

  activityQueue = [];

  try {
    await slowApiFetch('/activity/batch', {
      method: 'POST',
      body: JSON.stringify({ activities }),
    });
  } catch (error) {
    logDebug('Activity tracking failed:', error);
    if (import.meta.env.DEV) {
      console.warn('[activity] batch flush failed', error);
    }
  }
};

// Schedule flush with debounce
const scheduleFlush = () => {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
  }
  flushTimeout = setTimeout(flushQueue, 2000); // Flush after 2 seconds of inactivity
};

// Track a single activity (requires analytics cookie consent)
export const trackActivity = (data: ActivityData) => {
  if (!hasAnalyticsConsent()) return;

  activityQueue.push({
    ...data,
    pageUrl: window.location.href,
    referrer: document.referrer,
  });
  scheduleFlush();
};

// Convenience methods for common actions
export const trackPageView = (pageName?: string) => {
  trackActivity({
    actionType: 'page_view',
    entityType: 'page',
    entityName: pageName || document.title,
  });
};

export const trackProductView = (productId: number | string, productName: string) => {
  trackActivity({
    actionType: 'product_view',
    entityType: 'product',
    entityId: String(productId),
    entityName: productName,
  });
};

export const trackAddToCart = (
  productId: number | string,
  productName: string,
  quantity: number = 1,
  size?: string
) => {
  trackActivity({
    actionType: 'add_to_cart',
    entityType: 'product',
    entityId: String(productId),
    entityName: productName,
    metadata: { quantity, size },
  });
};

export const trackRemoveFromCart = (
  productId: number | string,
  productName: string,
  quantity: number = 1
) => {
  trackActivity({
    actionType: 'remove_from_cart',
    entityType: 'product',
    entityId: String(productId),
    entityName: productName,
    metadata: { quantity },
  });
};

export const trackCheckoutStart = (cartTotal: number, itemCount: number) => {
  trackActivity({
    actionType: 'checkout_start',
    entityType: 'cart',
    metadata: { cartTotal, itemCount },
  });
};

export const trackCheckoutComplete = (cartTotal: number, itemCount: number) => {
  trackActivity({
    actionType: 'checkout_complete',
    entityType: 'cart',
    metadata: { cartTotal, itemCount },
  });
};

export const trackPurchaseComplete = (orderId: string, orderTotal: number, itemCount: number) => {
  trackActivity({
    actionType: 'purchase_complete',
    entityType: 'order',
    entityId: orderId,
    metadata: { orderTotal, itemCount },
  });
};

export const trackSearch = (query: string, resultCount: number) => {
  trackActivity({
    actionType: 'search',
    metadata: { query, resultCount },
  });
};

export const trackFilterApply = (filters: Record<string, any>) => {
  trackActivity({
    actionType: 'filter_apply',
    metadata: filters,
  });
};

export const trackContactSubmit = (subject?: string) => {
  trackActivity({
    actionType: 'contact_submit',
    entityType: 'page',
    metadata: { subject: subject?.slice(0, 120) },
  });
};

export const trackSizeSelect = (productId: number | string, size: string) => {
  trackActivity({
    actionType: 'size_select',
    entityType: 'product',
    entityId: String(productId),
    metadata: { size },
  });
};

export const trackQuantityChange = (
  productId: number | string,
  productName: string,
  quantity: number
) => {
  trackActivity({
    actionType: 'quantity_change',
    entityType: 'product',
    entityId: String(productId),
    entityName: productName,
    metadata: { quantity },
  });
};

/** Store email for analytics batches only when consent is granted (session-scoped). */
export const setUserEmail = (email: string) => {
  if (!hasAnalyticsConsent()) return;
  sessionStorage.setItem('userEmail', email.trim().toLowerCase());
};

export const clearUserEmail = () => {
  sessionStorage.removeItem('userEmail');
  localStorage.removeItem('userEmail');
};

// Flush on page unload (batch endpoint is CSRF-exempt; prefer keepalive fetch)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (!hasAnalyticsConsent() || activityQueue.length === 0) return;

    const activities = activityQueue.map((activity) => ({
      ...activity,
      sessionId: getSessionId(),
      userEmail: getUserEmail(),
      pageUrl: activity.pageUrl || window.location.href,
      referrer: activity.referrer || document.referrer,
    }));

    const body = JSON.stringify({ activities });
    const url = `${config.apiBaseUrl}/activity/batch`;

    if (typeof fetch !== 'undefined') {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
        credentials: 'include',
      }).catch(() => {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
        }
      });
    } else if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    }
  });
}

export default {
  trackActivity,
  trackPageView,
  trackProductView,
  trackAddToCart,
  trackRemoveFromCart,
  trackCheckoutStart,
  trackCheckoutComplete,
  trackPurchaseComplete,
  trackSearch,
  trackFilterApply,
  trackContactSubmit,
  trackSizeSelect,
  trackQuantityChange,
  setUserEmail,
};
