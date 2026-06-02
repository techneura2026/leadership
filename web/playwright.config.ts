import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  expect: {
    timeout: 30_000,
  },

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  ],

  // Start Next.js dev server before tests
  webServer: [
    {
      command: 'npm run dev:api',
      cwd: '..',
      url: 'http://localhost:3001/api/docs',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npm run dev',
      cwd: '.',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
