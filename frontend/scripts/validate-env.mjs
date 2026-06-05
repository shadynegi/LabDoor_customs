/**
 * Fail production/CI builds when required VITE_* env vars are missing or unsafe.
 */
const isStrict =
  process.env.NODE_ENV === 'production' ||
  process.env.CI === 'true' ||
  process.env.VITE_STRICT_ENV === 'true';

if (!isStrict) {
  console.log('validate-env: skipping strict checks (development build)');
  process.exit(0);
}

const errors = [];

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    errors.push(`${name} is required for production/CI builds`);
    return null;
  }
  return value;
}

function rejectLocalhost(name, value) {
  if (/localhost|127\.0\.0\.1/i.test(value)) {
    errors.push(`${name} must not point to localhost in production/CI builds (got ${value})`);
  }
}

function rejectPlaceholder(name, value) {
  if (/example\.com/i.test(value)) {
    errors.push(`${name} must not use placeholder domains in production/CI builds (got ${value})`);
  }
}

const apiBaseUrl = requireEnv('VITE_API_BASE_URL');
const siteUrl = requireEnv('VITE_SITE_URL');
requireEnv('VITE_SENTRY_DSN');

if (apiBaseUrl) {
  const isRelativeApi = apiBaseUrl.startsWith('/');
  if (!isRelativeApi) {
    rejectLocalhost('VITE_API_BASE_URL', apiBaseUrl);
    rejectPlaceholder('VITE_API_BASE_URL', apiBaseUrl);
  }
}
if (siteUrl) rejectLocalhost('VITE_SITE_URL', siteUrl);

const backendUrl = process.env.VITE_BACKEND_URL?.trim();
if (backendUrl) rejectLocalhost('VITE_BACKEND_URL', backendUrl);

if (errors.length > 0) {
  console.error('Frontend environment validation failed:');
  for (const message of errors) {
    console.error(`  - ${message}`);
  }
  process.exit(1);
}

console.log('Frontend environment validation passed');
