import { defineConfig, devices } from '@playwright/test';

const jsonOutput = process.env.PLAYWRIGHT_JSON_OUTPUT;

const reporters: Parameters<typeof defineConfig>[0]['reporter'] = jsonOutput
  ? [
      ['list'],
      ['json', { outputFile: jsonOutput }],
    ]
  : process.env.CI
    ? 'github'
    : 'list';

export default defineConfig({
  testDir: './e2e/specs',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 1,
  workers: 1,
  reporter: reporters,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: [
        /mobile-ui\.spec\.ts/,
        /responsive-ui\.spec\.ts/,
        /responsive-pages-ui\.spec\.ts/,
      ],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      testMatch: /mobile-ui\.spec\.ts|responsive-ui\.spec\.ts|responsive-pages-ui\.spec\.ts/,
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run preview -- --port 4173 --host 127.0.0.1',
    cwd: '../frontend',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: process.env.PLAYWRIGHT_FORCE_NEW_SERVER !== 'true',
    timeout: 120_000,
    env: {
      PLAYWRIGHT: 'true',
      VITE_WHATSAPP_CONTACT_NUMBER: process.env.VITE_WHATSAPP_CONTACT_NUMBER || '+919888514572',
    },
  },
});
