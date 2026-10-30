import { expect, test } from '@playwright/test';
import { launch, close } from './runtime-fixture';
import { historyServer } from './history-server';
import { selectOption } from './select';

test('единый поиск, последние версии и контекстный переход к экземплярам точного определения', async () => {
  const api = await historyServer();
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    const catalog = page.locator('.runtime-catalog'); const filters = catalog.locator('.catalog-filters');
    const definitions = () => api.state.requests.filter(url => url.pathname.endsWith('/process-definitions'));
    expect(definitions().at(-1)?.searchParams.get('latest')).toBe('true');
    await expect(catalog.getByRole('button', { name: 'Definitions', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await filters.locator('summary').click();
    await expect(filters.getByLabel('Latest versions only')).toBeChecked();
    await filters.getByLabel('Latest versions only').uncheck(); await filters.getByRole('button', { name: 'Apply filters' }).click();
    await expect.poll(() => definitions().at(-1)?.searchParams.has('latest')).toBe(false);
    await selectOption(catalog.getByRole('combobox', { name: 'Search by' }), 'key');
    await catalog.getByLabel('Definition key', { exact: true }).fill('deskHistory'); await catalog.getByTitle('Search', { exact: true }).click();
    await expect.poll(() => definitions().at(-1)?.searchParams.get('key')).toBe('deskHistory');
    await expect(catalog.locator('.runtime-row button')).toHaveCount(0);
    await catalog.locator('.runtime-row').click();
    await page.locator('.runtime-diagram-heading').getByRole('button', { name: 'Instances', exact: true }).click();
    await expect(catalog.getByRole('button', { name: 'Instances', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => api.state.requests.filter(url => url.pathname.endsWith('/runtime/process-instances')).at(-1)?.searchParams.get('processDefinitionId')).toBe('d1');
    await expect(catalog.locator('.catalog-search input')).toHaveCount(1);
    await expect(catalog.locator('.catalog-open-instance')).toHaveCount(0);
    await selectOption(catalog.getByRole('combobox', { name: 'Search by' }), 'businessKeyLike');
    await catalog.getByLabel('Business key (contains)', { exact: true }).fill('order'); await catalog.getByTitle('Search', { exact: true }).click();
    await expect.poll(() => api.state.requests.filter(url => url.pathname.endsWith('/runtime/process-instances')).at(-1)?.searchParams.get('businessKeyLikeIgnoreCase')).toBe('%order%');
    await catalog.getByRole('button', { name: 'Definitions', exact: true }).click();
    await expect(catalog.getByLabel('Definition key', { exact: true })).toHaveValue('deskHistory');
    await expect(filters.getByLabel('Latest versions only')).not.toBeChecked();
    await catalog.locator('.catalog-conditions').getByRole('button', { name: 'Reset filters' }).click();
    await expect(filters.getByLabel('Latest versions only')).toBeChecked();
    await expect.poll(() => definitions().at(-1)?.searchParams.get('latest')).toBe('true');
    expect(definitions().at(-1)?.searchParams.has('key')).toBe(false);
    for (const theme of ['Light theme', 'Dark theme']) {
      await page.getByTitle(theme, { exact: true }).click(); await page.setViewportSize({ width: 1050, height: 720 });
      expect(await catalog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await page.screenshot({ path: `test-results/runtime-catalog-${theme.startsWith('Light') ? 'light' : 'dark'}.png` });
    }
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});
