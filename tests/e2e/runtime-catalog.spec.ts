import { expect, test } from '@playwright/test';
import { launch, close, openCatalogFilters } from './runtime-fixture';
import { historyServer } from './history-server';
import { selectOption } from './select';

test('сворачиваемые фильтры, отдельные источники и съёмные чипы вместо нескольких поисков', async () => {
  const api = await historyServer(); api.state.runtimeStatus = 200;
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    const catalog = page.locator('.runtime-catalog'); const tabs = catalog.locator('> .runtime-tabs');
    const definitions = () => api.state.requests.filter(url => url.pathname.endsWith('/process-definitions'));
    expect(definitions().at(-1)?.searchParams.get('latest')).toBe('true');
    await expect(catalog.locator('input:visible')).toHaveCount(0);
    await expect(catalog.locator('.catalog-condition')).toHaveText('Latest versions only');
    let filters = await openCatalogFilters(page);
    await filters.getByLabel('Latest versions only').uncheck();
    await filters.getByLabel('Definition key', { exact: true }).fill('deskHistory');
    await filters.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await expect.poll(() => definitions().at(-1)?.searchParams.get('key')).toBe('deskHistory');
    expect(definitions().at(-1)?.searchParams.has('latest')).toBe(false);
    await catalog.locator('.runtime-row').click();
    await page.locator('.runtime-diagram-heading').getByRole('button', { name: 'Instances', exact: true }).click();
    await expect(tabs.getByRole('button', { name: 'Runtime', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const runtime = () => api.state.requests.filter(url => url.pathname.endsWith('/runtime/process-instances')).at(-1)!;
    await expect.poll(() => runtime()?.searchParams.get('processDefinitionId')).toBe('d1');
    await expect(catalog.locator('.catalog-condition')).toContainText('Definition: deskHistory · v1');
    await expect(catalog.locator('input:visible')).toHaveCount(0);
    filters = await openCatalogFilters(page);
    await filters.getByLabel('Business key (contains)', { exact: true }).fill('order');
    await filters.getByLabel('Instance name', { exact: true }).fill('Review');
    await filters.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await expect.poll(() => runtime()?.searchParams.get('businessKeyLikeIgnoreCase')).toBe('%order%');
    expect(runtime().searchParams.get('nameLikeIgnoreCase')).toBe('%Review%');
    expect(runtime().searchParams.get('processDefinitionId')).toBe('d1');
    await catalog.locator('.catalog-conditions').getByRole('button', { name: 'Remove filter: Definition: deskHistory · v1', exact: true }).click();
    await expect.poll(() => runtime().searchParams.has('processDefinitionId')).toBe(false);
    expect(runtime().searchParams.get('businessKeyLikeIgnoreCase')).toBe('%order%');
    await tabs.getByRole('button', { name: 'History', exact: true }).click();
    await expect(catalog.locator('.shared-context')).toHaveCount(0);
    await expect.poll(() => api.state.requests.filter(url => url.pathname.endsWith('/historic-process-instances')).at(-1)?.searchParams.has('processDefinitionId')).toBe(false);
    await tabs.getByRole('button', { name: 'Dead-letter jobs', exact: true }).click();
    await expect(catalog.locator('.shared-context')).toHaveCount(0);
    await expect.poll(() => api.state.requests.filter(url => url.pathname.endsWith('/deadletter-jobs')).at(-1)?.searchParams.has('processDefinitionId')).toBe(false);
    await tabs.getByRole('button', { name: 'History', exact: true }).click();
    await catalog.locator('.runtime-row').first().click();
    await expect(page.locator('.instance-mode-tabs').getByRole('button', { name: 'History', exact: true })).toHaveAttribute('aria-pressed', 'true');
    filters = await openCatalogFilters(page);
    await selectOption(filters.getByRole('combobox', { name: 'State', exact: true }), 'true');
    await filters.getByLabel('Started after', { exact: true }).fill('2026-10-01T00:00');
    await filters.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await expect.poll(() => api.state.requests.filter(url => url.pathname.endsWith('/historic-process-instances')).at(-1)?.searchParams.get('finished')).toBe('true');
    await tabs.getByRole('button', { name: 'Runtime', exact: true }).click();
    filters = await openCatalogFilters(page);
    await expect(filters.getByLabel('Business key (contains)', { exact: true })).toHaveValue('order');
    await expect(filters.getByLabel('Definition ID', { exact: true })).toHaveValue('');
    expect(runtime().searchParams.has('startedAfter')).toBe(false); expect(runtime().searchParams.has('finished')).toBe(false);
    await catalog.locator('.runtime-row').click();
    await expect(page.locator('.instance-mode-tabs').getByRole('button', { name: 'Runtime', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await tabs.getByRole('button', { name: 'Definitions', exact: true }).click();
    filters = await openCatalogFilters(page);
    await expect(filters.getByLabel('Definition key', { exact: true })).toHaveValue('deskHistory');
    await expect(filters.getByLabel('Latest versions only')).not.toBeChecked();
    await catalog.locator('.catalog-conditions').getByRole('button', { name: 'Reset filters', exact: true }).click();
    await expect.poll(() => definitions().at(-1)?.searchParams.get('latest')).toBe('true');
    expect(definitions().at(-1)?.searchParams.has('key')).toBe(false);
    await filters.locator('summary').click();
    for (const theme of ['Light theme', 'Dark theme']) {
      await page.getByTitle(theme, { exact: true }).click(); await page.setViewportSize({ width: 1050, height: 720 });
      expect(await catalog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await page.screenshot({ path: `test-results/runtime-catalog-${theme.startsWith('Light') ? 'light' : 'dark'}.png` });
    }
    await openCatalogFilters(page, 'Dead-letter jobs');
    await expect(catalog.getByLabel('Execution ID', { exact: true })).toBeVisible();
    await expect(catalog.getByLabel('Element ID', { exact: true })).toBeVisible();
    await expect(catalog.getByLabel('Business key (contains)', { exact: true })).toHaveCount(0);
    await selectOption(page.getByRole('combobox', { name: 'Language', exact: true }), 'ru');
    await expect(tabs.getByRole('button', { name: 'Текущее состояние', exact: true })).toBeVisible();
    await expect(tabs.getByRole('button', { name: 'История', exact: true })).toBeVisible();
    await expect(catalog.getByLabel('ID execution', { exact: true })).toBeVisible();
    expect(await catalog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: 'test-results/runtime-catalog-ru.png' });
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});

test('сброс общего контекста сохраняет локальные условия других каталогов', async () => {
  const api = await historyServer(); api.state.runtimeStatus = 200;
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    const catalog = page.locator('.runtime-catalog'); const tabs = catalog.locator('> .runtime-tabs');
    let filters = await openCatalogFilters(page, 'History');
    await filters.getByLabel('Tenant ID', { exact: true }).fill('history-tenant'); await filters.getByRole('button', { name: 'Apply filters', exact: true }).click();
    filters = await openCatalogFilters(page, 'Runtime');
    await filters.getByLabel('Business key (exact match)', { exact: true }).fill('order-1'); await filters.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await tabs.getByRole('button', { name: 'Definitions', exact: true }).click(); await catalog.locator('.runtime-row').click();
    await page.locator('.runtime-diagram-heading').getByRole('button', { name: 'Instances', exact: true }).click();
    const shared = catalog.locator('.shared-context'); await shared.focus();
    await expect(page.getByRole('tooltip')).toContainText('Shared by Runtime, History and Dead-letter jobs');
    await page.keyboard.press('Escape');
    for (const theme of ['Light theme', 'Dark theme']) {
      await page.getByTitle(theme, { exact: true }).click(); await page.screenshot({ path: `test-results/runtime-shared-context-${theme.startsWith('Light') ? 'light' : 'dark'}.png` });
    }
    await tabs.getByRole('button', { name: 'Dead-letter jobs', exact: true }).click(); await expect(shared).toBeVisible();
    await catalog.getByRole('button', { name: 'Reset filters', exact: true }).click(); await expect(shared).toHaveCount(0);
    await tabs.getByRole('button', { name: 'History', exact: true }).click(); await expect(shared).toHaveCount(0);
    await expect(catalog.locator('.catalog-condition')).toHaveText('Tenant ID: history-tenant');
    await expect.poll(() => api.state.requests.filter(url => url.pathname.endsWith('/historic-process-instances')).at(-1)?.searchParams.get('tenantId')).toBe('history-tenant');
    await tabs.getByRole('button', { name: 'Runtime', exact: true }).click(); await expect(shared).toHaveCount(0);
    await expect(catalog.locator('.catalog-condition')).toHaveText('Business key (exact match): order-1');
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});
