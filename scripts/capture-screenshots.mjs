import process from 'node:process';
import { createServer } from 'vite';

process.env.PLAYWRIGHT_BROWSERS_PATH = '0';
const { chromium, expect } = await import('@playwright/test');
const { captureHero, prepareEditor, viewport } = await import('./lib/screenshots/editor.mjs');
const server = await createServer({ configFile: 'vite.web.config.ts', server: { host: '127.0.0.1', port: 5174, strictPort: true } });
await server.listen();
const origin = 'http://127.0.0.1:5174';
try {
  const browser = await chromium.launch({ chromiumSandbox: true });
  try {
    await captureHero(browser, origin);
    const page = await browser.newPage({ viewport });
    await page.goto(origin); await prepareEditor(page, 'Dark');
    await page.screenshot({ path: 'docs/images/editor.png' });
    await page.getByTitle('Light theme', { exact: true }).click();
    await page.screenshot({ path: 'docs/images/editor-light.png' });
    await page.getByRole('combobox', { name: 'Language', exact: true }).click();
    await page.getByRole('option', { name: 'RU', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeVisible();
    await page.screenshot({ path: 'docs/images/editor-russian.png' });
    await page.close();
    const home = await browser.newPage({ viewport });
    await home.goto(origin); await home.getByTitle('Light theme', { exact: true }).click();
    await expect(home.getByRole('button', { name: 'Create diagram', exact: true })).toBeVisible();
    await home.evaluate(() => globalThis.document.fonts.ready);
    await home.screenshot({ path: 'docs/images/start.png' });
    await home.getByTitle('Dark theme', { exact: true }).click();
    await home.getByRole('button', { name: 'camunda7-showcase', exact: true }).click();
    await home.getByRole('textbox', { name: 'Find element', exact: true }).fill('ArchiveOrder');
    await home.locator('.outline-item').first().click();
    await home.locator('.properties details').first().locator('summary').click();
    await home.getByTitle('Fit diagram', { exact: true }).click();
    await home.getByTitle('Zoom out', { exact: true }).click();
    await expect(home.locator('.engine-properties[data-engine="camunda7"]')).toBeVisible();
    await home.screenshot({ path: 'docs/images/camunda.png' });
  } finally { await browser.close(); }
} finally { await server.close(); }
