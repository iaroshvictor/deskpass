// Playwright configuration for the end-to-end suite.
//
// The app is expected to be running already (`npm start`); Playwright does not
// start it, because a cold Meteor build here takes minutes and would time out
// a webServer block.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,       // one browser at a time: the dev server is the bottleneck
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.DESKPASS_HTTP_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
});
