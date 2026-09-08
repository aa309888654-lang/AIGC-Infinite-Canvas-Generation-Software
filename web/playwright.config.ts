import { defineConfig, devices } from '@playwright/test';

const frontendPort = Number(process.env.PLAYWRIGHT_FRONTEND_PORT ?? 5190);
const frontendBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${frontendPort}`;
const useExistingFrontend = Boolean(process.env.PLAYWRIGHT_BASE_URL);

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: frontendBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: 'npm run build && npm start',
      cwd: '../backend',
      url: 'http://127.0.0.1:3200/api/health/ready',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `npm run preview -- --host 127.0.0.1 --port ${frontendPort} --strictPort`,
      url: frontendBaseUrl,
      reuseExistingServer: useExistingFrontend || !process.env.CI,
      timeout: 120_000,
    },
  ],
});
