// Activity tracking utility for user behavior analytics
import { config, apiFetch } from '../config';

// Generate or get session ID
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('sessionId');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('sessionId', sessionId);
  }
  return sessionId;
};

// Get user email from localStorage if available
const getUserEmail = (): string | null => {
  return localStorage.getItem('userEmail');
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
  | 'contact_form_submit'
  | 'size_select'
  | 'quantity_change';

interface ActivityData {
  actionType: ActionType;
  entityType?: 'product' | 'order' | 'cart' | 'page';
  entityId?: string | number;
  entityName?: string;
  metadata?: Record<string, any>;
  pageUrl?: string;
  referrer?: string;
}

// Queue for batching activities
let activityQueue: ActivityData[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

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
    await apiFetch('/activity/batch', {
      method: 'POST',
      body: JSON.stringify({ activities }),
    });
  } catch (error) {
    // Silently fail - don't interrupt user experience
    console.debug('Activity tracking failed:', error);
  }
};

// Schedule flush with debounce
const scheduleFlush = () => {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
  }
  flushTimeout = setTimeout(flushQueue, 2000); // Flush after 2 seconds of inactivity
};

// Track a single activity
export const trackActivity = (data: ActivityData) => {
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

// Set user email when they provide it (e.g., during checkout)
export const setUserEmail = (email: string) => {
  localStorage.setItem('userEmail', email);
};

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (activityQueue.length > 0) {
      // Use sendBeacon for reliable delivery on page unload
      const activities = activityQueue.map((activity) => ({
        ...activity,
        sessionId: getSessionId(),
        userEmail: getUserEmail(),
        pageUrl: activity.pageUrl || window.location.href,
        referrer: activity.referrer || document.referrer,
      }));
      
      navigator.sendBeacon(
        `${config.apiBaseUrl}/activity/batch`,
        JSON.stringify({ activities })
      );
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
  trackPurchaseComplete,
  trackSearch,
  trackFilterApply,
  setUserEmail,
};
