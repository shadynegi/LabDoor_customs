/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_SITE_URL?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_RELEASE?: string;
  readonly VITE_BACKEND_URL?: string;
  readonly VITE_API_TIMEOUT_MS?: string;
  readonly VITE_EXTENDED_API_TIMEOUT_MS?: string;
  /** @deprecated Use VITE_EXTENDED_API_TIMEOUT_MS */
  readonly VITE_CATALOG_TIMEOUT_MS?: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
