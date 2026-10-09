import process from 'node:process';
import { createServer } from 'vite';

process.env.PLAYWRIGHT_BROWSERS_PATH = '0';
const { chromium, expect } = await import('@playwright/test');
const server = await createServer({ configFile: 'vite.web.config.ts', server: { host: '127.0.0.1', port: 5174, strictPort: true } });
await server.listen();
try {
  const browser = await chromium.launch({ chromiumSandbox: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto('http://127.0.0.1:5174');
    await page.getByRole('button', { name: 'flowable-showcase', exact: true }).click();
    await page.getByRole('textbox', { name: 'Find element', exact: true }).fill('prepareDocument');
    await page.locator('.outline-item').first().click();
    await page.getByRole('button', { name: 'XML', exact: true }).click();
    await page.getByLabel('Diagram XML').focus();
    await page.keyboard.press('Control+f');
    await page.locator('.xml-panel input[name="search"]').fill('flowable');
    await expect(page.locator('.xml-element-tag').first()).toContainText('prepareDocument');
    await page.evaluate(() => globalThis.document.fonts.ready);
    await page.screenshot({ path: 'docs/images/editor.png' });
    await page.getByTitle('Light theme', { exact: true }).click();
    await page.screenshot({ path: 'docs/images/editor-light.png' });
    await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('ru');
    await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeVisible();
    await page.screenshot({ path: 'docs/images/editor-russian.png' });
  } finally { await browser.close(); }
} finally { await server.close(); }
