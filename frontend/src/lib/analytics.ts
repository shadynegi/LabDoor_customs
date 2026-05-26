const MEASUREMENT_ID = import.meta.env.VITE_GA4_MEASUREMENT_ID as string | undefined;
const COOKIE_PREFERENCES_KEY = 'lab_door_cookie_preferences';

let gtagScriptLoaded = false;

function isProduction(): boolean {
  return import.meta.env.PROD;
}

function isDoNotTrack(): boolean {
  const dnt = navigator.doNotTrack ?? (window as unknown as { doNotTrack?: string }).doNotTrack;
  return dnt === '1' || dnt === 'yes';
}

export function hasAnalyticsConsent(): boolean {
  try {
    const raw = localStorage.getItem(COOKIE_PREFERENCES_KEY);
    if (!raw) return false;
    const prefs = JSON.parse(raw) as { analytics?: boolean };
    return prefs.analytics === true;
  } catch {
    return false;
  }
}

function canUseAnalytics(): boolean {
  return Boolean(
    isProduction() &&
      MEASUREMENT_ID &&
      hasAnalyticsConsent() &&
      !isDoNotTrack()
  );
}

function ensureGtagFn(): void {
  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
}

function loadGtagScript(): void {
  if (gtagScriptLoaded || !MEASUREMENT_ID || isDoNotTrack()) return;

  ensureGtagFn();

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.gtag?.('js', new Date());
  window.gtag?.('config', MEASUREMENT_ID, { send_page_view: false });
  gtagScriptLoaded = true;
}

/** Call once at app startup — listens for cookie consent updates. */
export function initAnalytics(): void {
  if (!MEASUREMENT_ID) return;

  const onConsent = () => {
    if (canUseAnalytics()) {
      loadGtagScript();
    }
  };

  window.addEventListener('cookieConsentUpdated', onConsent);
  onConsent();
}

export function trackGaPageView(pagePath: string): void {
  if (!canUseAnalytics() || !gtagScriptLoaded) return;
  window.gtag?.('event', 'page_view', { page_path: pagePath });
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}
