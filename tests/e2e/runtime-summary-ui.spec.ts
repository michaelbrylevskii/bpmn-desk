import { expect, test } from '@playwright/test';
import { launch, close, savedSummaryOff } from './runtime-fixture';
import { historyServer } from './history-server';

test('автосводка компактна; обновления сохраняют DOM, выбор, масштаб и страницу подробностей', async () => {
  const api = await historyServer(); api.state.summaryCount = 20; api.state.summaryTotal = 20;
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    await page.setViewportSize({ width: 1050, height: 720 });
    await page.locator('.runtime-catalog .runtime-row').click();
    const status = page.getByRole('button', { name: 'Version summary', exact: true });
    await expect(status).toHaveAttribute('data-summary-state', 'ready');
    await expect(page.locator('.runtime-summary-notice')).toHaveCount(0);
    const badge = page.locator('.runtime-badge[data-activity-id="HistoryReview"]'); await expect(badge).toHaveText('● 20');
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
    await expect(status).toHaveAttribute('data-summary-state', 'loading'); await expect(badge).toHaveText('● 20');
    await expect(status).toHaveAttribute('data-summary-state', 'ready');
    expect(await originalBadge!.evaluate(element => element.isConnected)).toBe(true); expect(await originalNode!.evaluate(element => element.isConnected)).toBe(true);
    expect(await body.evaluate(element => element.scrollTop)).toBe(scroll); expect(await viewport.getAttribute('transform')).toBe(transform);
    await expect(node).toHaveClass(/selected/); await expect(page.locator('.runtime-summary-details')).toContainText('p10');
    const requests = () => api.state.requests.filter(url => url.searchParams.has('processDefinitionId') && (url.pathname.endsWith('/executions') || url.pathname.endsWith('/deadletter-jobs') || url.pathname.endsWith('/historic-activity-instances'))).length;
    const before = requests(); await page.getByLabel('Refresh every 5 seconds').check();
    await expect.poll(requests, { timeout: 8000 }).toBeGreaterThan(before);
    await expect(status).toHaveAttribute('data-summary-state', 'ready');
    expect(await originalBadge!.evaluate(element => element.isConnected)).toBe(true);
    await page.getByLabel('Refresh every 5 seconds').uncheck(); await expect(status).toHaveAttribute('data-summary-state', 'ready');
    const loaded = requests(); await status.click(); await expect(badge).toHaveCount(0); await status.click(); await expect(badge).toHaveText('● 20'); await expect(status).toHaveAttribute('data-summary-state', 'ready'); expect(requests()).toBe(loaded + 3);
    api.state.summaryStatus = 503; await page.getByTitle('Refresh state', { exact: true }).click();
    await expect(status).toHaveAttribute('data-summary-state', 'error'); await expect(badge).toHaveText('● 20');
    await status.focus(); await expect(page.getByRole('tooltip')).toContainText('503'); await expect(page.getByRole('tooltip')).toContainText('stale'); await page.keyboard.press('Escape'); await status.blur();
    api.state.summaryStatus = 200; api.state.summaryTotal = 1000000;
    await page.getByTitle('Refresh state', { exact: true }).click(); await expect(status).toHaveAttribute('data-summary-state', 'partial'); await expect(badge).toHaveText('● 20+');
    await status.focus(); await expect(page.getByRole('tooltip')).toContainText('20/1000000'); await expect(page.getByRole('tooltip')).toContainText('Partial sample');
    await page.screenshot({ path: 'test-results/runtime-summary-status.png' });
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});

test('отключённая автосводка ждёт ручной загрузки; скрытая вкладка не опрашивает API', async () => {
  const api = await historyServer();
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    await savedSummaryOff(page);
    await page.locator('.runtime-catalog .runtime-row').click();
    const status = page.getByRole('button', { name: 'Version summary', exact: true }); await expect(status).toHaveAttribute('data-summary-state', 'off');
    await expect(page.getByLabel('Refresh every 5 seconds')).toBeDisabled();
    const requests = () => api.state.requests.filter(url => url.searchParams.has('processDefinitionId') && (url.pathname.endsWith('/executions') || url.pathname.endsWith('/deadletter-jobs') || url.pathname.endsWith('/historic-activity-instances'))).length;
    await page.waitForTimeout(5200); expect(requests()).toBe(0);
    await status.click(); await expect(status).toHaveAttribute('data-summary-state', 'ready'); expect(requests()).toBe(3);
    await page.getByLabel('Refresh every 5 seconds').check();
    await page.locator('.new-tab').click(); await page.waitForTimeout(5500); expect(requests()).toBe(3);
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});

test('смена определения не перекрывает сводки и не применяет прежний ответ', async () => {
  const api = await historyServer(); api.state.alternateDefinition = true; api.state.summaryDelay = 1000;
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    await page.locator('.runtime-row').filter({ hasText: 'deskHistory · v1' }).click();
    await expect.poll(() => api.state.summaryActive).toBe(3);
    await page.locator('.runtime-row').filter({ hasText: 'deskHistory2' }).click();
    const status = page.getByRole('button', { name: 'Version summary', exact: true });
    await expect(status).toHaveAttribute('data-summary-state', 'loading');
    await expect(page.locator('.runtime-badge')).toHaveCount(0);
    await expect(page.locator('.runtime-badge[data-activity-id="HistoryReview"]')).toHaveText('● 3');
    await expect(status).toHaveAttribute('data-summary-state', 'ready'); expect(api.state.summaryMaxActive).toBe(3);
    await expect(page.locator('.runtime-diagram-heading')).toContainText('v2');
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});

test('медленная сводка не задерживает отображение схемы и её XML', async () => {
  const api = await historyServer(); api.state.summaryDelay = 3000;
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    await page.locator('.runtime-catalog .runtime-row').click();
    await expect.poll(() => api.state.summaryActive).toBe(3);
    await expect(page.locator('.runtime-canvas [data-element-id="HistoryReview"]').first()).toBeVisible();
    const status = page.getByRole('button', { name: 'Version summary', exact: true });
    await expect(status).toHaveAttribute('data-summary-state', 'loading');
    await page.locator('.runtime-diagram-heading').getByTitle('Diagram XML', { exact: true }).click();
    await expect(page.locator('.runtime-xml .cm-content')).toContainText('HistoryReview');
    await expect(status).toHaveAttribute('data-summary-state', 'loading');
    await expect(status).toHaveAttribute('data-summary-state', 'ready');
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});


test('сначала загружается и отображается выбранная схема, затем начинается сводка', async () => {
  const api = await historyServer(); api.state.holdDiagram = true; api.state.alternateDefinition = true;
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  const summaryRequests = () => api.state.requests.filter(url => url.searchParams.has('processDefinitionId') && (url.pathname.endsWith('/executions') || url.pathname.endsWith('/deadletter-jobs') || url.pathname.endsWith('/historic-activity-instances')));
  try {
    await page.locator('.runtime-row').filter({ hasText: 'deskHistory · v1' }).click();
    await expect.poll(() => api.state.requests.filter(url => url.pathname.endsWith('/resourcedata')).length).toBe(1);
    expect(summaryRequests()).toHaveLength(0); await expect(page.locator('.runtime-canvas')).toHaveCount(0);
    api.releaseDiagram();
    await expect(page.locator('.runtime-canvas [data-element-id="HistoryReview"]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Version summary', exact: true })).toHaveAttribute('data-summary-state', 'ready');
    expect(summaryRequests()).toHaveLength(3);
    // Старое ready первой схемы не разрешает запросы для новой до получения её XML.
    api.state.holdDiagram = true;
    await page.locator('.runtime-row').filter({ hasText: 'deskHistory2' }).click();
    await expect.poll(() => api.state.requests.filter(url => url.pathname.endsWith('/resourcedata')).length).toBe(2);
    expect(summaryRequests()).toHaveLength(3);
    api.releaseDiagram(); await expect(page.locator('.runtime-diagram-heading')).toContainText('v2');
    await expect(page.getByRole('button', { name: 'Version summary', exact: true })).toHaveAttribute('data-summary-state', 'ready');
    expect(summaryRequests()).toHaveLength(6);
    expect(summaryRequests().slice(3).every(url => url.searchParams.get('processDefinitionId') === 'd2')).toBe(true);
    api.state.diagramStatus = 503; await page.locator('.runtime-row').filter({ hasText: 'deskHistory · v1' }).click();
    await expect(page.locator('.runtime-center > [role=alert]')).toContainText('503'); expect(summaryRequests()).toHaveLength(6);
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});


test('без BPMN DI сводка запускается после показа XML вместо бесконечного ожидания холста', async () => {
  const api = await historyServer(); api.state.withoutDi = true;
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    await page.locator('.runtime-row').click();
    await expect(page.locator('.runtime-xml .cm-content')).toContainText('HistoryReview');
    await expect(page.getByRole('button', { name: 'Version summary', exact: true })).toHaveAttribute('data-summary-state', 'ready');
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});
