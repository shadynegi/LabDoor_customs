import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['../Tests/setup.ts'],
    include: ['../Tests/backend/**/*.test.ts', '../Tests/api/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/postgres',
      JWT_SECRET: 'TestJwtSecretWithComplexity1!@#Aa',
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD_HASH: '$2b$12$ci.placeholder.hash.for.validation.only',
      FRONTEND_URL: 'http://localhost:5173',
      PAYPAL_CLIENT_ID: 'test-client-id',
      PAYPAL_SECRET: 'test-client-secret',
      PAYPAL_MODE: 'sandbox',
      RESEND_API_KEY: 're_test_key',
    },
  },
});
