import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e', fullyParallel: false, workers: 1, timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:5173', viewport: { width: 1500, height: 960 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev:web', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'chromium', testMatch: 'editor*.spec.ts' },
    { name: 'electron', testMatch: 'desktop.spec.ts' },
    { name: 'appimage', testMatch: 'appimage.spec.ts' },
    { name: 'windows', testMatch: 'windows.spec.ts' },
    { name: 'runtime', testMatch: 'runtime.spec.ts', timeout: 60000 },
  ],
});
