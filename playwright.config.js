import { defineConfig } from '@playwright/test';

// End-to-end tests drive the real app against the Firebase emulators.
// Playwright starts both the Bun dev server and the emulators for us (and
// reuses already-running ones locally). Requires a JDK 21+ for the emulators.
export default defineConfig({
  testDir: './e2e',
  // Not *.spec.js / *.test.js: Bun's test runner also matches those, and it
  // would try (and fail) to run the Playwright spec.
  testMatch: '**/*.e2e.js',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    // Use the installed Google Chrome so no browser download is needed
    // (available locally and on GitHub's ubuntu runners).
    channel: 'chrome',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'bun run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command:
        'firebase emulators:start --only auth,database,functions --project demo-flipdraw',
      url: 'http://127.0.0.1:9099/',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
