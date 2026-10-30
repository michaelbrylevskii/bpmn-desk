import { expect, test, type Page } from '@playwright/test';
import { launch, close } from './runtime-fixture';
import { historyServer } from './history-server';

async function disableAutoSummary(page: Page) {
  await page.getByTitle('Manage connections', { exact: true }).click();
  await expect(page.getByLabel('Load definition summary automatically')).toBeChecked();
  await page.getByLabel('Load definition summary automatically').uncheck();
  await page.getByRole('button', { name: 'Save connection', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('автосводка компактна; обновления сохраняют DOM, выбор, масштаб и страницу подробностей', async () => {
  const api = await historyServer(); api.state.summaryCount = 20; api.state.summaryTotal = 20;
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    await page.setViewportSize({ width: 1050, height: 720 });
    await page.locator('.runtime-catalog .runtime-row').click();
    const status = page.getByRole('button', { name: 'Version summary', exact: true });
    await expect(status).toHaveAttribute('data-summary-state', 'ready');
    await expect(page.locator('.runtime-summary-notice')).toHaveCount(0);
    const badge = page.locator('.runtime-badge[data-activity-id="HistoryReview"]'); await expect(badge).toHaveText('20');
    await status.focus(); await expect(page.getByRole('tooltip')).toContainText('20/20');
    await expect(page.getByRole('tooltip')).not.toContainText('Green'); await page.keyboard.press('Escape');
    const node = page.locator('.runtime-canvas .djs-element[data-element-id="HistoryReview"]'); await node.locator('.djs-hit').click();
    await page.locator('.runtime-summary-details').getByTitle('Next page', { exact: true }).click();
    await expect(page.locator('.runtime-summary-details')).toContainText('p10');
    const originalBadge = await badge.elementHandle(); const originalNode = await node.elementHandle();
    const viewport = page.locator('.runtime-canvas .viewport'); const transform = await viewport.getAttribute('transform');
    const body = page.locator('.runtime-summary-details'); await body.evaluate(element => { element.scrollTop = 50; }); const scroll = await body.evaluate(element => element.scrollTop); expect(scroll).toBeGreaterThan(0);
    api.state.summaryDelay = 150;
    await page.getByTitle('Refresh state', { exact: true }).click();
    await expect(status).toHaveAttribute('data-summary-state', 'loading'); await expect(badge).toHaveText('20');
    await expect(status).toHaveAttribute('data-summary-state', 'ready');
    expect(await originalBadge!.evaluate(element => element.isConnected)).toBe(true); expect(await originalNode!.evaluate(element => element.isConnected)).toBe(true);
    expect(await body.evaluate(element => element.scrollTop)).toBe(scroll); expect(await viewport.getAttribute('transform')).toBe(transform);
    await expect(node).toHaveClass(/selected/); await expect(page.locator('.runtime-summary-details')).toContainText('p10');
    const requests = () => api.state.requests.filter(url => url.searchParams.has('processDefinitionId') && (url.pathname.endsWith('/executions') || url.pathname.endsWith('/deadletter-jobs'))).length;
    const before = requests(); await page.getByLabel('Refresh every 5 seconds').check();
    await expect.poll(requests, { timeout: 8000 }).toBeGreaterThan(before);
    await expect(status).toHaveAttribute('data-summary-state', 'ready');
    expect(await originalBadge!.evaluate(element => element.isConnected)).toBe(true);
    await page.getByLabel('Refresh every 5 seconds').uncheck(); await expect(status).toHaveAttribute('data-summary-state', 'ready');
    const loaded = requests(); await status.click(); await expect(badge).toHaveCount(0); await status.click(); await expect(badge).toHaveText('20'); expect(requests()).toBe(loaded);
    api.state.summaryStatus = 503; await page.getByTitle('Refresh state', { exact: true }).click();
    await expect(status).toHaveAttribute('data-summary-state', 'error'); await expect(badge).toHaveText('20');
    await status.focus(); await expect(page.getByRole('tooltip')).toContainText('503'); await expect(page.getByRole('tooltip')).toContainText('stale'); await page.keyboard.press('Escape'); await status.blur();
    api.state.summaryStatus = 200; api.state.summaryTotal = 1000000;
    await page.getByTitle('Refresh state', { exact: true }).click(); await expect(status).toHaveAttribute('data-summary-state', 'partial'); await expect(badge).toHaveText('≥20');
    await status.focus(); await expect(page.getByRole('tooltip')).toContainText('20/1000000'); await expect(page.getByRole('tooltip')).toContainText('Partial sample');
    await page.screenshot({ path: 'test-results/runtime-summary-status.png' });
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});

test('отключённая автосводка ждёт ручной загрузки; скрытая вкладка не опрашивает API', async () => {
  const api = await historyServer();
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    await disableAutoSummary(page); expect((await page.evaluate(() => window.runtime!.connections())).items[0]?.autoSummary).toBe(false);
    await page.locator('.runtime-catalog .runtime-row').click();
    const status = page.getByRole('button', { name: 'Version summary', exact: true }); await expect(status).toHaveAttribute('data-summary-state', 'idle');
    await page.getByLabel('Refresh every 5 seconds').check();
    const requests = () => api.state.requests.filter(url => url.searchParams.has('processDefinitionId') && (url.pathname.endsWith('/executions') || url.pathname.endsWith('/deadletter-jobs'))).length;
    await page.waitForTimeout(5200); expect(requests()).toBe(0);
    await status.click(); await expect(status).toHaveAttribute('data-summary-state', 'ready'); expect(requests()).toBe(2);
    await page.locator('.new-tab').click(); await page.waitForTimeout(5500); expect(requests()).toBe(2);
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});

test('смена определения не перекрывает сводки и не применяет прежний ответ', async () => {
  const api = await historyServer(); api.state.alternateDefinition = true; api.state.summaryDelay = 1000;
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    await page.locator('.runtime-row').filter({ hasText: 'deskHistory · v1' }).click();
    await expect.poll(() => api.state.summaryActive).toBe(2);
    await page.locator('.runtime-row').filter({ hasText: 'deskHistory2' }).click();
    const status = page.getByRole('button', { name: 'Version summary', exact: true });
    await expect(status).toHaveAttribute('data-summary-state', 'loading');
    await expect(page.locator('.runtime-badge')).toHaveCount(0);
    await expect(page.locator('.runtime-badge[data-activity-id="HistoryReview"]')).toHaveText('3');
    await expect(status).toHaveAttribute('data-summary-state', 'ready'); expect(api.state.summaryMaxActive).toBe(2);
    await expect(page.locator('.runtime-diagram-heading')).toContainText('v2');
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});

test('медленная сводка не задерживает отображение схемы и её XML', async () => {
  const api = await historyServer(); api.state.summaryDelay = 3000;
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    await page.locator('.runtime-catalog .runtime-row').click();
    await expect.poll(() => api.state.summaryActive).toBe(2);
    await expect(page.locator('.runtime-canvas [data-element-id="HistoryReview"]').first()).toBeVisible();
    const status = page.getByRole('button', { name: 'Version summary', exact: true });
    await expect(status).toHaveAttribute('data-summary-state', 'loading');
    await page.locator('.runtime-diagram-heading').getByTitle('Diagram XML', { exact: true }).click();
    await expect(page.locator('.runtime-xml .cm-content')).toContainText('HistoryReview');
    await expect(status).toHaveAttribute('data-summary-state', 'loading');
    await expect(status).toHaveAttribute('data-summary-state', 'ready');
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});
