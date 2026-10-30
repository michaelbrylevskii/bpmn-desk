import { selectOption } from './select';
import { expect, test } from '@playwright/test';
import { close, launch, openInstance } from './runtime-fixture';
import { historyServer } from './history-server';

test('единая схема сохраняет выбор, масштаб и ширину при смене вкладки и переживает отказ одного API', async () => {
  const api = await historyServer(); api.state.runtimeStatus = 200; api.state.finished = false; api.state.unfinishedActivities = true;
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    await openInstance(page, 'p1');
    const element = page.locator('.runtime-canvas .djs-element[data-element-id="HistoryReview"]');
    const badge = page.locator('.runtime-badge[data-activity-id="HistoryReview"]');
    await expect(badge).toHaveCount(1); await expect(badge).toHaveText('✓ 1 · ● 1');
    await expect(element).toHaveClass(/runtime-active/);
    await page.getByTitle('Light theme', { exact: true }).click();
    await expect(element.locator('.djs-visual > rect').first()).toHaveCSS('stroke', 'rgb(34, 141, 114)');
    await element.locator('.djs-hit').click();
    const viewport = page.locator('.runtime-canvas .viewport');
    const transform = await viewport.getAttribute('transform');
    const width = (await page.locator('.runtime-instance-panel').boundingBox())!.width;
    await page.locator('.instance-mode-tabs').getByRole('button', { name: 'Execution history', exact: true }).click();
    await expect(page.locator('.history-activity')).toHaveCount(2); await expect(element).toHaveClass(/selected/);
    expect(await viewport.getAttribute('transform')).toBe(transform);
    expect((await page.locator('.runtime-instance-panel').boundingBox())!.width).toBe(width);
    await expect(badge).toHaveText('✓ 1 · ● 1');
    await page.locator('.instance-mode-tabs').getByRole('button', { name: 'Current state', exact: true }).click();
    await expect(element).toHaveClass(/selected/); expect(await viewport.getAttribute('transform')).toBe(transform);
    api.state.metadataStatus = 403;
    await page.getByTitle('Refresh state', { exact: true }).click();
    await expect(page.locator('.runtime-center [role=alert]')).toContainText('403');
    await expect(element).toHaveClass(/runtime-active/); await expect(badge).toHaveCount(1);
    api.state.metadataStatus = 200; api.state.runtimeStatus = 404; api.state.finished = true; api.state.unfinishedActivities = false;
    await expect(page.getByTitle('Refresh state', { exact: true })).toBeEnabled(); await page.getByTitle('Refresh state', { exact: true }).click();
    await expect(element).toHaveClass(/runtime-visited/); await expect(element).not.toHaveClass(/runtime-active/);
    await expect(badge).toHaveText('✓ 2'); await expect(page.locator('.runtime-source-status')).toContainText('absent from runtime');
    await page.locator('.instance-mode-tabs').getByRole('button', { name: 'Execution history', exact: true }).click();
    await expect(page.locator('.history-details .runtime-instance')).toContainText('Finished');
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});

test('родитель и дочерний экземпляр имеют одинаковые карточки с названием схемы и открываются с возвратом', async () => {
  const api = await historyServer(); api.state.runtimeStatus = 200; api.state.related = true; api.state.finished = false;
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    await openInstance(page, 'p1');
    const child = page.locator('.instance-relationships').getByRole('button', { name: 'Child instance: p2', exact: true });
    await expect(child).toContainText('Review decisions'); await expect(child).toContainText('Other instance'); await child.click();
    const parent = page.locator('.instance-relationships').getByRole('button', { name: 'Parent instance: p1', exact: true });
    await expect(parent).toContainText('Order fulfillment'); await expect(parent).toContainText('Historical order');
    await page.locator('.instance-mode-tabs').getByRole('button', { name: 'Execution history', exact: true }).click();
    await expect(parent).toContainText('Order fulfillment');
    await parent.click(); await expect(page.locator('.runtime-instance > code')).toHaveText('p1');
    await page.locator('.monitor-navigation').getByRole('button', { name: 'Back', exact: true }).click(); await expect(page.locator('.runtime-instance > code')).toHaveText('p2');
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});

test('история остаётся доступной при запрете runtime, а пустой runtime не подтверждает завершение', async () => {
  const api = await historyServer(); api.state.runtimeStatus = 403; api.state.finished = false; api.state.unfinishedActivities = true;
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    const catalog = page.locator('.runtime-catalog');
    await catalog.locator('.runtime-tabs').getByRole('button', { name: 'Instances', exact: true }).click();
    await selectOption(catalog.getByRole('combobox', { name: 'Search by', exact: true }), 'instanceId'); await catalog.getByLabel('Instance ID', { exact: true }).fill('p1'); await catalog.getByRole('button', { name: 'Open instance', exact: true }).click();
    await expect(page.locator('.runtime-center [role=alert]')).toContainText('403');
    const element = page.locator('.runtime-canvas .djs-element[data-element-id="HistoryReview"]');
    await expect(element).toHaveClass(/runtime-unfinished/); await expect(element).not.toHaveClass(/runtime-active/);
    await page.locator('.instance-mode-tabs').getByRole('button', { name: 'Execution history', exact: true }).click();
    await expect(page.locator('.history-activity')).toHaveCount(2);
    api.state.runtimeStatus = 404;
    await expect(page.getByTitle('Refresh state', { exact: true })).toBeEnabled(); await page.getByTitle('Refresh state', { exact: true }).click();
    await expect(page.locator('.runtime-center [role=alert]')).toHaveCount(0);
    await expect(page.locator('.history-details .runtime-instance')).toContainText('Not ended in history');
    await expect(element).toHaveClass(/runtime-unfinished/);
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});


test('журнал раскрывает несколько записей без фильтра, а XML подсвечен и защищён от ввода', async () => {
  const api = await historyServer(); api.state.runtimeStatus = 200;
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    await openInstance(page, 'p1');
    await page.locator('.instance-mode-tabs').getByRole('button', { name: 'Execution history', exact: true }).click();
    const rows = page.locator('.history-activity');
    await expect(rows).toHaveCount(2);
    await rows.first().getByRole('button').click();
    await rows.last().getByRole('button').click();
    await expect(page.locator('.history-activity-details')).toHaveCount(2);
    await expect(page.locator('.history-element-filter')).toHaveCount(0);
    const element = page.locator('.runtime-canvas .djs-element[data-element-id="HistoryReview"]');
    await expect(element).toHaveClass(/selected/);
    await expect(element.locator('.djs-outline')).toHaveCSS('stroke-dasharray', '6px, 3px');
    // Прямой клик включает фильтр даже для уже выделенного из журнала узла.
    await element.locator('.djs-hit').click();
    await expect(page.locator('.history-element-filter')).toContainText('HistoryReview');
    await rows.first().getByRole('button').click();
    await expect(page.locator('.history-element-filter')).toContainText('HistoryReview');
    await page.getByTitle('Show all steps', { exact: true }).click();
    await expect(page.locator('.history-element-filter')).toHaveCount(0);
    await page.getByTitle('Diagram XML', { exact: true }).click();
    const xml = page.locator('.runtime-xml .cm-content');
    await expect(xml).toHaveAttribute('aria-readonly', 'true');
    await expect(xml.locator('span').first()).toBeVisible();
    const source = await xml.textContent();
    await xml.click(); await page.keyboard.type('MUST_NOT_BE_INSERTED');
    expect(await xml.textContent()).toBe(source);
    await page.getByTitle('Dark theme', { exact: true }).click();
    expect(await xml.textContent()).toBe(source);
    await expect(page.locator('.dirty-dot')).toHaveCount(0);
    await expect(page.locator('.history-activity-details')).toHaveCount(1);
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});
