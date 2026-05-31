import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/postgres',
      JWT_SECRET: 'TestJwtSecretWithComplexity1!@#Aa',
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'test-admin-password',
      FRONTEND_URL: 'http://localhost:5173',
      PAYPAL_CLIENT_ID: 'test-client-id',
      PAYPAL_SECRET: 'test-client-secret',
      PAYPAL_MODE: 'sandbox',
      RESEND_API_KEY: 're_test_key',
    },
  },
});
