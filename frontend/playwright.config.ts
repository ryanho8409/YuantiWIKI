import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/*.spec.mjs'],
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL,
    headless: true,
  },
});

