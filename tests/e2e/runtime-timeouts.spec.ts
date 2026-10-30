import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { launch, close } from './runtime-fixture';
import { catalogServer } from './runtime-catalog-server';

test('медленный список: таймаут черновика и сохранённого подключения, восстановление без автоматических повторов', async () => {
  const api = await catalogServer(6000);
  const launched = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  const { app, page, directory } = launched;
  const manage = async (seconds: number) => {
    await page.getByTitle('Manage connections', { exact: true }).click();
    const timeout = page.getByLabel('Request timeout, seconds', { exact: true });
    await expect(timeout).toHaveValue('15'); await timeout.fill(String(seconds));
  };
  try {
    await manage(5);
    await page.getByRole('button', { name: 'Test connection', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('status')).toHaveText('Connection verified.');
    expect((await page.evaluate(() => window.runtime!.connections())).items[0]?.requestTimeoutSeconds).toBe(15);
    await page.getByRole('button', { name: 'Save connection', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const tabs = page.locator('.runtime-catalog > .runtime-tabs');
    await tabs.getByRole('button', { name: 'Instances', exact: true }).click();
    await expect(page.locator('.runtime-list [role=alert]')).toContainText('API request timed out.', { timeout: 8000 });
    expect(api.state.requests).toHaveLength(1);
    await page.getByTitle('Manage connections', { exact: true }).click();
    await expect(page.getByLabel('Request timeout, seconds', { exact: true })).toHaveValue('5');
    await page.getByLabel('Request timeout, seconds', { exact: true }).fill('30');
    await page.getByRole('button', { name: 'Save connection', exact: true }).click();
    await expect(page.locator('.runtime-row').filter({ hasText: 'Example order' })).toBeVisible({ timeout: 10000 });
    expect(api.state.requests).toHaveLength(2);
    expect((JSON.parse(await readFile(join(directory, 'connections.json'), 'utf8')) as { items: { profile: { requestTimeoutSeconds: number } }[] }).items[0]?.profile.requestTimeoutSeconds).toBe(30);
  } finally {
    try { await close(app, directory); }
    finally { await api.stop(); }
  }
});

test('ошибка обновления сохраняет страницу, новые фильтры и поздние ответы не показывают чужие строки', async () => {
  const api = await catalogServer();
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    await page.getByTitle('Manage connections', { exact: true }).click();
    await page.getByLabel('Request timeout, seconds', { exact: true }).fill('5');
    await page.getByRole('button', { name: 'Save connection', exact: true }).click();
    const catalog = page.locator('.runtime-catalog');
    const tabs = catalog.locator('.runtime-tabs');
    await tabs.getByRole('button', { name: 'Instances', exact: true }).click();
    const row = catalog.locator('.runtime-row').filter({ hasText: 'Example order' });
    await expect(row).toBeVisible(); api.state.delay = 6000;
    await catalog.getByTitle('Refresh', { exact: true }).click();
    await expect(row).toBeVisible(); await expect(catalog.locator('.runtime-stale')).toBeVisible();
    await expect(catalog.getByRole('alert')).toContainText('API request timed out.', { timeout: 8000 });
    await expect(catalog.getByRole('alert')).toContainText('Narrow the filters');
    await expect(row).toBeVisible(); expect(api.state.requests).toHaveLength(2);
    for (const theme of ['Light theme', 'Dark theme']) {
      await page.getByTitle(theme, { exact: true }).click(); await page.setViewportSize({ width: 1050, height: 680 });
      await expect(row).toBeVisible(); await expect(catalog.locator('.runtime-stale')).toContainText('Showing previously loaded data.');
      expect(await catalog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await page.screenshot({ path: `test-results/runtime-timeout-${theme.startsWith('Light') ? 'light' : 'dark'}.png` });
    }
    api.state.delay = 500;
    await catalog.getByLabel('Business key (exact match)', { exact: true }).fill('missing');
    await catalog.locator('.runtime-query').getByTitle('Search', { exact: true }).click();
    await expect(row).toHaveCount(0); await expect(catalog.locator('.runtime-stale')).toHaveCount(0);
    await expect(catalog.getByText('No results', { exact: true })).toBeVisible();
    api.state.delay = 6000;
    await catalog.getByLabel('Business key (exact match)', { exact: true }).fill('slow-filter');
    await catalog.locator('.runtime-query').getByTitle('Search', { exact: true }).click();
    await expect.poll(() => api.state.requests.length).toBe(4);
    await tabs.getByRole('button', { name: 'Definitions', exact: true }).click();
    await expect(catalog.locator('.runtime-row')).toContainText('Example process');
    // Дождёмся завершения оставленного запроса; его ошибка не должна попасть в другой список.
    await expect.poll(() => api.state.closed, { timeout: 7000 }).toBe(4);
    await expect(catalog.getByRole('alert')).toHaveCount(0);
    await expect(catalog.locator('.runtime-row')).toContainText('Example process'); expect(api.state.requests).toHaveLength(4);
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});
