import { test, expect, _electron as electron } from '@playwright/test';
import { launch, close } from './runtime-fixture';
import { historyServer } from './history-server';
import { selectOption } from './select';

test('история сводки считает разные экземпляры, открывает History и не меняет ширину панели при сбросе выбора', async () => {
  const api = await historyServer(); api.state.runtimeStatus = 200; api.state.summaryHistoryCount = 1000; api.state.summaryHistoryTotal = 10000;
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    await page.locator('.runtime-catalog .runtime-row').click();
    const panel = page.locator('.runtime-summary-details'); const canvas = page.locator('.runtime-canvas');
    await expect(panel).toContainText('Select an element to view details');
    const width = (await canvas.boundingBox())!.width;
    const element = canvas.locator('[data-element-id="HistoryReview"]');
    await expect(page.locator('.runtime-badge[data-activity-id="HistoryReview"]')).toHaveText('◷ 2+ · ● 1');
    const request = api.state.requests.find(url => url.pathname.endsWith('/historic-activity-instances') && url.searchParams.has('processDefinitionId'))!;
    expect(request.searchParams.get('processDefinitionId')).toBe('d1'); expect(request.searchParams.get('size')).toBe('1000');
    expect(request.searchParams.get('sort')).toBe('startTime'); expect(request.searchParams.get('order')).toBe('desc');
    const toggle = page.getByRole('button', { name: 'Version summary', exact: true }); await toggle.focus();
    await expect(page.getByRole('tooltip')).toContainText('1000/10000');
    await expect(page.getByRole('tooltip')).toContainText('1000 history activities'); await page.keyboard.press('Escape');
    const count = api.state.requests.length;
    await element.locator('.djs-hit').click();
    await panel.locator('.summary-source-tabs').getByRole('button', { name: 'History', exact: true }).click();
    await expect(panel.locator('.related-instance')).toHaveCount(2);
    expect(api.state.requests.length).toBe(count);
    expect((await canvas.boundingBox())!.width).toBe(width);
    await page.screenshot({ path: 'test-results/runtime-summary-history-en.png' });
    await selectOption(page.getByRole('combobox', { name: 'Language', exact: true }), 'ru');
    await expect(panel.locator('.summary-source-tabs').getByRole('button', { name: 'История', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: 'test-results/runtime-summary-history-ru.png' });
    await selectOption(page.getByRole('combobox', { name: 'Язык', exact: true }), 'en');
    await canvas.locator('.djs-container').click({ position: { x: 20, y: 20 } });
    await expect(panel).toContainText('Select an element to view details'); expect((await canvas.boundingBox())!.width).toBe(width);
    await page.getByTitle('Hide details', { exact: true }).click(); await element.locator('.djs-hit').click();
    await expect(panel).toBeHidden(); await expect(page.getByTitle('Show details', { exact: true })).toHaveAttribute('data-updated', 'true');
    await page.getByTitle('Show details', { exact: true }).click();
    await panel.getByRole('button', { name: 'Open instance: p1', exact: true }).click();
    await expect(page.locator('.instance-mode-tabs').getByRole('button', { name: 'History', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.history-metadata')).toHaveCount(0);
    const historyFields = page.locator('.instance-fields'); await expect(historyFields.getByRole('button', { name: 'd1', exact: true })).toBeVisible();
    const labels = await historyFields.locator('dt').allTextContents();
    await page.locator('.instance-mode-tabs').getByRole('button', { name: 'Runtime', exact: true }).click();
    const common = await page.locator('.instance-fields dt').allTextContents();
    expect(labels.filter(label => common.includes(label))).toEqual(common);
    await page.locator('.instance-fields').getByRole('button', { name: 'd1', exact: true }).click();
    await expect(page.locator('.runtime-diagram-heading')).toContainText('v1'); await expect(page.locator('.runtime-summary-details')).toContainText('Select an element to view details');
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});

test('переключатель общий, работает во время загрузки и сохраняется после перезапуска Electron', async () => {
  const api = await historyServer(); const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  let reopened: Awaited<ReturnType<typeof electron.launch>> | undefined;
  try {
    await page.getByTitle('Manage connections', { exact: true }).click();
    await expect(page.getByLabel('Load definition summary automatically')).toHaveCount(0);
    await selectOption(page.getByRole('combobox', { name: 'Authentication', exact: true }), 'none');
    await page.getByRole('button', { name: 'Save connection', exact: true }).click();
    await page.locator('.runtime-catalog .runtime-row').click();
    const toggle = page.getByRole('button', { name: 'Version summary', exact: true });
    await expect(toggle).toHaveAttribute('data-summary-state', 'ready');
    api.state.summaryDelay = 700; await page.getByTitle('Refresh state', { exact: true }).click();
    await expect(toggle).toHaveAttribute('data-summary-state', 'loading'); await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false'); await expect(toggle.locator('.summary-status-badge')).toHaveCount(0);
    await expect(page.locator('.runtime-badge')).toHaveCount(0);
    await expect.poll(() => api.state.summaryActive).toBe(0); await expect(toggle).toHaveAttribute('data-summary-state', 'off');
    await page.locator('.new-tab').click(); await page.getByRole('button', { name: 'Open monitor', exact: true }).click();
    await page.locator('.workspace-surface:not([hidden]) .runtime-row').click();
    await expect(page.locator('.workspace-surface:not([hidden])').getByRole('button', { name: 'Version summary', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await app.close();
    reopened = await electron.launch({ args: ['.'], chromiumSandbox: true, env: { ...process.env, BPMN_DESK_USER_DATA: directory, ELECTRON_RENDERER_URL: '' } });
    const next = await reopened.firstWindow(); await next.getByRole('button', { name: 'Open monitor', exact: true }).click();
    await next.locator('.runtime-row').click(); await expect(next.getByRole('button', { name: 'Version summary', exact: true })).toHaveAttribute('data-summary-state', 'off');
    expect(await next.evaluate(() => localStorage.getItem('bpmn-desk:summary-enabled'))).toBe('false');
  } finally { await reopened?.close(); try { await close(app, directory); } finally { await api.stop(); } }
});

test('старое autoSummary=false мигрирует один раз; ошибка истории не скрывает Runtime', async () => {
  const api = await historyServer(); const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    await page.evaluate(async () => {
      const profile = (await window.runtime!.connections()).items[0]!;
      await window.runtime!.saveConnection({ ...profile, rememberSecret: false, autoSummary: false });
      localStorage.removeItem('bpmn-desk:summary-enabled');
    });
    await page.reload(); await page.getByRole('button', { name: 'Open monitor', exact: true }).click();
    await page.locator('.runtime-row').click();
    const toggle = page.getByRole('button', { name: 'Version summary', exact: true });
    await expect(toggle).toHaveAttribute('data-summary-state', 'off');
    expect(await page.evaluate(() => localStorage.getItem('bpmn-desk:summary-enabled'))).toBe('false');
    expect(api.state.requests.filter(url => url.searchParams.has('processDefinitionId') && url.pathname.endsWith('/executions'))).toHaveLength(0);
    api.state.summaryHistoryStatus = 503; await toggle.click();
    await expect(toggle).toHaveAttribute('data-summary-state', 'error');
    await expect(page.locator('.runtime-badge[data-activity-id="HistoryReview"]')).toHaveText('● 1');
    await page.locator('.runtime-canvas [data-element-id="HistoryReview"] .djs-hit').click();
    const panel = page.locator('.runtime-summary-details'); await expect(panel.locator('.related-instance')).toHaveCount(1);
    await panel.locator('.summary-source-tabs').getByRole('button', { name: 'History', exact: true }).click();
    await expect(panel.getByRole('alert')).toBeVisible(); await expect(panel).toContainText('State unavailable');
    await page.reload(); await page.getByRole('button', { name: 'Open monitor', exact: true }).click(); await page.locator('.runtime-row').click();
    await expect(page.getByRole('button', { name: 'Version summary', exact: true })).toHaveAttribute('aria-pressed', 'true');
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});
