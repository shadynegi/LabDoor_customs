const CONSENT_KEY = 'lab_door_cookie_consent';

/** Sentry loads after the user has saved cookie preferences (essential operations monitoring). */
export function hasMonitoringConsent(): boolean {
  try {
    return Boolean(localStorage.getItem(CONSENT_KEY));
  } catch {
    return false;
  }
}

export function onMonitoringConsentReady(callback: () => void): () => void {
  const run = () => {
    if (hasMonitoringConsent()) callback();
  };
  run();
  const onConsent = () => run();
  window.addEventListener('cookieConsentUpdated', onConsent);
  return () => window.removeEventListener('cookieConsentUpdated', onConsent);
}
