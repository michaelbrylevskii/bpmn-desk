import { test, expect, type Page } from '@playwright/test';
import { launch, close, openCatalogFilters } from './runtime-fixture';
import { historyServer } from './history-server';
import { selectOption } from './select';

async function openHistory(page: Page, id = 'p1') {
  const filters = await openCatalogFilters(page, 'History');
  await selectOption(filters.getByRole('combobox', { name: 'State', exact: true }), 'true');
  await filters.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await filters.getByLabel('Instance ID', { exact: true }).fill(id); await filters.getByRole('button', { name: 'Open instance', exact: true }).click();
}

test('недоступная история и недоступные шаги показываются без ложного пустого успешного результата', async () => {
  const api = await historyServer(); api.state.metadataStatus = 403;
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    await openHistory(page);
    await expect(page.locator('.runtime-center [role=alert]')).toContainText('403');
    await expect(page.locator('.runtime-center [role=alert]')).toContainText('Check access to the history API');
    await expect(page.locator('.history-details')).toHaveCount(0);
    api.state.metadataStatus = 200; api.state.activityStatus = 403;
    await page.getByTitle('Refresh state', { exact: true }).click();
    await expect(page.locator('.history-details .runtime-instance > code')).toHaveText('p1');
    await expect(page.locator('.history-journal [role=alert]')).toContainText('403');
    await expect(page.locator('.history-journal')).toContainText('History is partially loaded');
    await expect(page.locator('.runtime-visited')).toHaveCount(0);
    api.state.activityStatus = 200; api.state.activityCount = 0; api.state.total = 0;
    await page.getByTitle('Refresh state', { exact: true }).click();
    await expect(page.locator('.history-journal')).toContainText('History may have been disabled or cleaned');
    await expect(page.locator('.history-journal [role=alert]')).toHaveCount(0);
    api.state.activityCount = 2; api.state.total = 2;
    await page.getByTitle('Refresh state', { exact: true }).click();
    await expect(page.locator('.history-activity')).toHaveCount(2);
    await expect(page.locator('.history-journal')).toContainText('no sequence flow records');
    await expect(page.locator('.runtime-canvas .djs-connection.runtime-visited')).toHaveCount(0);
    await expect(page.locator('.history-journal')).not.toContainText('partially loaded');
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});

test('ограниченная история обозначает нижнюю границу счётчика и сохраняет данные при ошибке обновления', async () => {
  const api = await historyServer(); api.state.activityCount = 2000; api.state.total = 2000;
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    await openHistory(page);
    await expect(page.locator('.history-list-controls')).toContainText('Records loaded: 1000 of 2000');
    await expect(page.locator('.runtime-badge[data-activity-id="HistoryReview"]')).toHaveText('✓ ≥1000');
    await expect(page.locator('.history-journal')).toContainText('History is partially loaded');
    expect(api.state.requests.filter(url => url.pathname.endsWith('/historic-activity-instances'))).toHaveLength(10);
    api.state.metadataStatus = 500; await page.getByTitle('Refresh state', { exact: true }).click();
    await expect(page.locator('.runtime-center [role=alert]')).toContainText('The last snapshot is stale');
    await expect(page.locator('.history-details .runtime-instance > code')).toHaveText('p1');
    await expect(page.locator('.runtime-badge[data-activity-id="HistoryReview"]')).toHaveText('✓ ≥1000');
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});

test('поздний ответ другого экземпляра не перезаписывает открытый журнал', async () => {
  const api = await historyServer(); api.state.delayFirst = 700;
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    await openHistory(page);
    await expect.poll(() => api.state.requests.some(url => url.pathname.endsWith('/historic-process-instances/p1'))).toBe(true);
    const catalog = page.locator('.runtime-catalog'); await catalog.getByLabel('Instance ID', { exact: true }).fill('p2');
    await catalog.getByRole('button', { name: 'Open instance', exact: true }).click();
    await expect(page.locator('.history-details .runtime-instance > code')).toHaveText('p2');
    await expect.poll(() => api.state.deliveredFirst).toBe(1);
    await expect(page.locator('.history-details .runtime-instance > code')).toHaveText('p2');
    await expect(page.locator('.history-details .runtime-instance')).toContainText('Other instance');
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});

test('даты и сортировка истории не переносятся в runtime, а удалённый deployment не скрывает журнал', async () => {
  const api = await historyServer(); api.state.diagramStatus = 404;
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    await openHistory(page);
    await expect(page.locator('.runtime-center [role=alert]')).toContainText('404');
    await expect(page.locator('.history-activity')).toHaveCount(2);
    await page.locator('.history-activity').last().getByRole('button').click();
    await expect(page.locator('.history-activity-details')).toContainText('Activity instance ID');
    const filters = await openCatalogFilters(page);
    await filters.getByLabel('Started after', { exact: true }).fill('2026-10-01T00:00');
    await filters.getByLabel('Started before', { exact: true }).fill('2026-10-30T00:00');
    await filters.getByLabel('Definition key', { exact: true }).fill('deskHistory');
    await selectOption(filters.getByRole('combobox', { name: 'Sort by', exact: true }), 'duration');
    await filters.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await expect.poll(() => api.state.requests.some(url => url.searchParams.get('sort') === 'duration' && url.searchParams.has('startedAfter') && url.searchParams.get('finished') === 'true')).toBe(true);
    await page.locator('.runtime-catalog > .runtime-tabs').getByRole('button', { name: 'Runtime', exact: true }).click();
    await expect.poll(() => api.state.requests.some(url => url.pathname.endsWith('/runtime/process-instances'))).toBe(true);
    const runtime = api.state.requests.findLast(url => url.pathname.endsWith('/runtime/process-instances'))!;
    expect(runtime.searchParams.get('sort')).toBe('id'); expect(runtime.searchParams.has('startedAfter')).toBe(false); expect(runtime.searchParams.has('finished')).toBe(false);
    await page.locator('.runtime-catalog > .runtime-tabs').getByRole('button', { name: 'History', exact: true }).click();
    await page.locator('.catalog-filters > summary').click();
    await expect(page.getByRole('combobox', { name: 'Order', exact: true })).toHaveAttribute('data-value', 'desc');
    await page.locator('.runtime-catalog > .runtime-tabs').getByRole('button', { name: 'Definitions', exact: true }).click();
    await page.locator('.runtime-catalog > .runtime-tabs').getByRole('button', { name: 'History', exact: true }).click();
    await page.locator('.catalog-filters > summary').click();
    await expect(page.getByRole('combobox', { name: 'Order', exact: true })).toHaveAttribute('data-value', 'desc');
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});
