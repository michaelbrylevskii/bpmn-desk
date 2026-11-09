import { expect, test, _electron as electron } from '@playwright/test';
import { launch, openInstance, openCatalogFilters } from './runtime-fixture';
import { openMonitor } from './open-monitor';
import { historyServer } from './history-server';
import { rm } from 'node:fs/promises';

test('мониторы восстанавливают место просмотра и фильтры, скрытый монитор ждёт открытия', async () => {
  const api = await historyServer(); const launched = await launch(api.baseUrl, true); let app = launched.app;
  const { directory } = launched;
  try {
    let page = launched.page;
    await openInstance(page, 'p1', true);
    await expect(page.locator('.history-activity')).toHaveCount(2);
    await page.locator('.new-tab').click(); await openMonitor(page);
    const filters = await openCatalogFilters(page, 'History');
    await filters.getByLabel('Business key (exact match)', { exact: true }).fill('Historical order');
    await filters.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await expect.poll(async () => {
      const items = await page.evaluate(() => window.desktop!.sessions()); if (!items.length) return 0;
      const session = await page.evaluate(id => window.desktop!.restoreSession(id), items[0]!.id); return session?.tabs.length ?? 0;
    }).toBe(2);
    await app.close(); const previous = api.state.requests.length;
    app = await electron.launch({ args: ['.'], chromiumSandbox: true, env: { ...process.env, BPMN_DESK_USER_DATA: directory, ELECTRON_RENDERER_URL: '' } });
    page = await app.firstWindow();
    await page.getByRole('region', { name: 'Sessions', exact: true }).locator('.welcome-file').hover();
    await expect(page.getByRole('tooltip').getByText('Flowable monitor · Fixture engine', { exact: true })).toHaveCount(2);
    await page.getByRole('button', { name: 'Restore', exact: true }).click();
    await expect(page.locator('.document-tab[data-kind=monitor]')).toHaveCount(2);
    await expect(page.locator('.workspace-surface:not([hidden]) .runtime-tabs.catalog-tabs').getByRole('button', { name: 'History', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.workspace-surface:not([hidden]) .catalog-conditions')).toContainText('Historical order');
    expect(api.state.requests.slice(previous).filter(url => url.pathname.includes('/historic-activity-instances'))).toHaveLength(0);
    api.state.activityCount = 3; api.state.total = 3;
    await page.locator('.document-tab[data-kind=monitor]').first().getByRole('tab').click();
    await expect(page.locator('.document-tab[data-kind=monitor]').first().getByRole('tab')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.history-activity')).toHaveCount(3);
    await expect(page.locator('.runtime-instance > code')).toHaveText('p1');
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); await api.stop(); }
});
