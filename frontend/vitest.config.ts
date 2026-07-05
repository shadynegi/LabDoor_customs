import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('test'),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['../Tests/unit/frontend/setup.ts'],
    include: ['../Tests/unit/frontend/**/*.{test,spec}.{ts,tsx}'],
    css: true,
    env: {
      VITE_WHATSAPP_CONTACT_NUMBER: '+919888514572',
    },
  },
});
