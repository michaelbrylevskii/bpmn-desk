import { expect, test } from '@playwright/test';
import { close, launch, openInstance } from './runtime-fixture';
import { historyServer } from './history-server';

for (const native of [false, true]) test(`назад/вперёд ${native ? 'через команды боковых кнопок мыши' : 'через тулбар'}; подсказки и новая ветка`, async () => {
  const api = await historyServer(); api.state.runtimeStatus = 200; api.state.finished = false; api.state.related = true;
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    const url = page.url(); const nav = page.locator('.monitor-navigation');
    const back = nav.getByRole('button', { name: 'Back', exact: true }); const forward = nav.getByRole('button', { name: 'Forward', exact: true });
    const move = async (direction: 'back' | 'forward') => {
      if (native) await app.evaluate(({ BrowserWindow }, command) => { BrowserWindow.getAllWindows()[0]!.emit('app-command', {}, command); }, direction === 'back' ? 'browser-backward' : 'browser-forward');
      else await (direction === 'back' ? back : forward).click();
    };
    await expect(back).toBeDisabled(); await expect(forward).toBeDisabled();
    await openInstance(page, 'p1'); await expect(back).toBeDisabled();
    await page.locator('.instance-relationships').getByRole('button', { name: 'Child instance: p2', exact: true }).click();
    await expect(page.locator('.runtime-instance > code')).toHaveText('p2'); await expect(back).toBeEnabled(); await expect(forward).toBeDisabled();
    await expect(page.locator('.runtime-context-bar')).toHaveCount(0);
    await back.hover(); await expect(page.getByRole('tooltip')).toContainText('Order fulfillment'); await expect(page.getByRole('tooltip')).toContainText('Historical order'); await expect(page.getByRole('tooltip').locator('code')).toHaveText('p1');
    await page.keyboard.press('Escape'); await move('back'); await expect(page.locator('.runtime-instance > code')).toHaveText('p1');
    await expect(back).toBeDisabled(); await expect(forward).toBeEnabled();
    await forward.focus(); await expect(page.getByRole('tooltip')).toContainText('Review decisions'); await expect(page.getByRole('tooltip')).toContainText('Other instance');
    await page.keyboard.press('Escape'); await move('forward'); await expect(page.locator('.runtime-instance > code')).toHaveText('p2');
    await page.locator('.instance-mode-tabs').getByRole('button', { name: 'History', exact: true }).click();
    await page.getByTitle('Refresh state', { exact: true }).click(); await expect(page.locator('.history-details .runtime-instance > code')).toHaveText('p2');
    await move('back'); await expect(page.locator('.runtime-instance > code')).toHaveText('p1'); await move('forward');
    await expect(page.locator('.history-details .runtime-instance > code')).toHaveText('p2');
    await move('back'); await expect(page.locator('.runtime-instance > code')).toHaveText('p1');
    await page.locator('.runtime-catalog > .runtime-tabs').getByRole('button', { name: 'Definitions', exact: true }).click(); await page.locator('.runtime-catalog .runtime-row').first().click();
    await expect(page.locator('.runtime-instance-panel')).toHaveCount(0); await expect(forward).toBeDisabled(); await expect(back).toBeEnabled();
    await move('back'); await expect(page.locator('.runtime-instance > code')).toHaveText('p1'); await forward.hover();
    await expect(page.getByRole('tooltip')).toContainText('Definition version'); await expect(page.getByRole('tooltip')).toContainText('v1');
    expect(page.url()).toBe(url); expect(await page.evaluate(() => !!window.desktop)).toBe(true);
    await page.screenshot({ path: `test-results/runtime-navigation-${native ? 'mouse' : 'toolbar'}.png` });
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});

test('история отдельна для мониторов; редактор и диалог подключения не реагируют на app-command', async () => {
  const api = await historyServer(); api.state.runtimeStatus = 200; api.state.finished = false; api.state.related = true;
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    await openInstance(page, 'p1'); await page.locator('.instance-relationships').getByRole('button', { name: 'Child instance: p2', exact: true }).click();
    await expect(page.locator('.runtime-instance > code')).toHaveText('p2'); const first = page.locator('.document-tab[data-kind=monitor]').getByRole('tab').first();
    await page.getByTitle('Manage connections', { exact: true }).click();
    await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0]!.emit('app-command', {}, 'browser-backward'); });
    await expect(page.locator('.runtime-instance > code')).toHaveText('p2'); await page.getByRole('dialog').getByTitle('Close', { exact: true }).click();
    await page.locator('.new-tab').click(); await expect(page.locator('.monitor-navigation')).toHaveCount(0);
    await page.locator('.welcome').getByRole('button', { name: 'flowable-boundary-events', exact: true }).click();
    await expect(page.locator('.monitor-navigation')).toHaveCount(0);
    await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0]!.emit('app-command', {}, 'browser-backward'); });
    await expect(page.locator('.document-workspace:visible')).toBeVisible();
    await page.locator('.new-tab').click(); await page.getByRole('button', { name: 'Open monitor', exact: true }).click(); await openInstance(page, 'p1');
    await expect(page.locator('.monitor-navigation').getByRole('button', { name: 'Back', exact: true })).toBeDisabled();
    await first.click(); await expect(page.locator('.workspace-surface:not([hidden]) .runtime-instance > code')).toHaveText('p2');
    await page.locator('.monitor-navigation').getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.locator('.workspace-surface:not([hidden]) .runtime-instance > code')).toHaveText('p1');
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});
