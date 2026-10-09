import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig(base, {
  testDir: 'tests/extra', outputDir: '.cache/extra-test-results',
  reporter: [['list']],
  projects: [{ name: 'extra', testMatch: 'ui.spec.ts' }],
});
