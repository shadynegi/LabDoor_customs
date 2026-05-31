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
  testDir: './frontend',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: reporters,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run preview -- --port 4173 --host 127.0.0.1',
    cwd: '../frontend',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
