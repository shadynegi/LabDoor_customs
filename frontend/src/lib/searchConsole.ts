const VERIFICATION_TOKEN = import.meta.env.VITE_GSC_VERIFICATION as string | undefined;

function upsertMeta(name: string, content: string): void {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/** Inject Google Search Console site verification meta tag when configured. */
export function initSearchConsoleVerification(): void {
  if (!VERIFICATION_TOKEN?.trim()) return;
  upsertMeta('google-site-verification', VERIFICATION_TOKEN.trim());
}
