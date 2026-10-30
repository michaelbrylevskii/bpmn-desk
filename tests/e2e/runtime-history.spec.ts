import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { close, fixture, launch, openInstance, useRuntimeFixture } from './runtime-fixture';
import { selectOption } from './select';

useRuntimeFixture();
const surface = (page: Page) => page.locator('.workspace-surface:not([hidden])');
async function openHistory(page: Page, id: string) {
  await surface(page).locator('.runtime-catalog > .runtime-tabs').getByRole('button', { name: 'Instances', exact: true }).click();
  await selectOption(surface(page).getByRole('combobox', { name: 'Instance view', exact: true }), 'completed');
  await surface(page).getByLabel('Instance ID', { exact: true }).fill(id);
  await surface(page).getByRole('button', { name: 'Open instance', exact: true }).click();
  await expect(surface(page).locator('.history-details .runtime-instance > code')).toHaveText(id);
}

test('Flowable возвращает завершённые экземпляры, повторы, вызванный процесс и сохранённые переменные через GET', async () => {
  const { app, page, directory } = await launch();
  try {
    const result = await page.evaluate(async ({ instance, definition }) => {
      const api = window.runtime!; const connection = (await api.connections()).items[0]!.id;
      const history = await api.history(connection, instance);
      const finished = await api.historicInstances(connection, { finished: true, definitionId: definition, search: 'HISTORY:ORDER:123' });
      const future = await api.historicInstances(connection, { startedAfter: '2099-01-01T00:00:00Z' });
      return { history, finished, future, diagram: await api.diagram(connection, history.instance.processDefinitionId) };
    }, { instance: fixture.historyInstanceId, definition: fixture.historyDefinitionId });
    expect(result.finished.total).toBe(1); expect(result.future.total).toBe(0);
    expect(result.history.instance.endTime).not.toBe(''); expect(result.history.instance.processDefinitionId).toBe(fixture.historyDefinitionId);
    expect(result.diagram.definition.version).toBe(1); expect(result.diagram.xml).not.toContain('Historical review v2');
    expect(result.history.activities.complete).toBe(true); expect(result.history.activities.error).toBeUndefined();
    const reviews = result.history.activities.data.filter(item => item.activityId === 'HistoryReview');
    expect(reviews).toHaveLength(2); expect(new Set(reviews.map(item => item.id)).size).toBe(2); expect(reviews.map(item => item.assignee).sort()).toEqual(['alice', 'bob']);
    expect(result.history.activities.data.find(item => item.activityId === 'HistoryChild')?.calledProcessInstanceId).toBe(fixture.historyChildId);
    expect(result.history.children.data.map(item => item.id)).toContain(fixture.historyChildId);
    expect(result.history.variables.error).toBeUndefined(); expect(result.history.variables.data.find(item => item.name === 'round')?.value).toBe(2);
    const notes = result.history.variables.data.filter(item => item.name === 'reviewerNote');
    expect(notes).toHaveLength(2); expect(notes.every(item => item.scope.startsWith('task:'))).toBe(true);
    // В этой версии и конфигурации движок действительно сохраняет прохождения стрелок.
    expect(result.history.activities.data.some(item => item.activityType === 'sequenceFlow')).toBe(true);
  } finally { await close(app, directory); }
});

test('журнал и схема связываются в обе стороны, переходы и повторы экспортируются без изменения BPMN', async () => {
  const { app, page, directory } = await launch();
  try {
    await openHistory(page, fixture.historyInstanceId);
    await expect(surface(page).locator('.runtime-diagram-heading')).toContainText('v1');
    const reviews = surface(page).locator('.history-activity[data-element-id="HistoryReview"]');
    await expect(reviews).toHaveCount(2); await expect(reviews.first()).toContainText('Visit 1 of 2');
    await expect(surface(page).locator('.history-group > summary').filter({ hasText: 'Document checks' })).toBeVisible();
    expect(await surface(page).locator('.history-journal > .history-activity, .history-journal > .history-group').evaluateAll(elements => elements.map(element => element.getAttribute('data-element-id') || element.querySelector('summary > code')?.textContent))).toEqual(['HistoryStart', 'HistoryChecks', 'HistoryChild', 'HistoryEnd']);
    await reviews.last().getByRole('button').click();
    await expect(surface(page).locator('.runtime-canvas .djs-element[data-element-id="HistoryReview"]')).toHaveClass(/selected/);
    await expect(surface(page).locator('.history-activity-details')).toContainText('bob');
    await surface(page).getByTitle('Show all steps', { exact: true }).click();
    await surface(page).locator('.runtime-canvas .djs-element[data-element-id="HistoryChild"] .djs-hit').click();
    await expect(surface(page).locator('.history-activity')).toHaveCount(1); await expect(surface(page).locator('.history-activity')).toContainText('Final review');
    await surface(page).getByTitle('Show all steps', { exact: true }).click();
    await expect(surface(page).locator('.runtime-badge[data-activity-id="HistoryReview"]')).toHaveText('✓ 2');
    await expect(surface(page).locator('.runtime-canvas .djs-element[data-element-id="CheckAgain"]')).toHaveClass(/runtime-visited/);
    await expect(surface(page).locator('.runtime-canvas .djs-element[data-element-id="CheckAgain"] .djs-visual > path').first()).toHaveCSS('stroke', 'rgb(82, 123, 172)');
    await surface(page).getByTitle('Fit diagram', { exact: true }).click();
    const canvasBounds = (await surface(page).locator('.runtime-canvas').boundingBox())!;
    const endBadge = (await surface(page).locator('.runtime-badge[data-activity-id="HistoryEnd"]').boundingBox())!;
    expect(endBadge.x + endBadge.width).toBeLessThan(canvasBounds.x + canvasBounds.width);
    await page.screenshot({ path: 'test-results/runtime-history-finished.png' });
    const file = resolve(directory, 'history.svg'); await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, file);
    await page.getByTitle('Export SVG', { exact: true }).click();
    await expect(async () => { const svg = await readFile(file, 'utf8'); expect(svg).toContain('✓ 2'); expect(svg).toContain('stroke="#527bac"'); expect(svg).not.toContain('data-runtime-badge="CheckAgain"'); }).toPass();
    await surface(page).getByRole('button', { name: 'Saved variables', exact: true }).click();
    await expect(surface(page).locator('.history-note')).toContainText('not values at the selected step');
    await expect(surface(page).locator('.runtime-variable').filter({ hasText: 'round' })).toBeVisible();
    expect(await page.evaluate(() => window.desktop!.recentFiles())).toEqual([]); await expect(page.locator('.dirty-dot')).toHaveCount(0);
    await surface(page).getByTitle('Hide catalog', { exact: true }).click(); await expect(surface(page).locator('.runtime-catalog')).toBeHidden();
    await surface(page).getByTitle('Show catalog', { exact: true }).click(); await expect(surface(page).locator('.runtime-catalog')).toBeVisible();
  } finally { await close(app, directory); }
});

test('история вызванного процесса открывается с возвратом, а прекращение не выглядит успешным завершением', async () => {
  const { app, page, directory } = await launch();
  try {
    await openHistory(page, fixture.historyInstanceId);
    const child = surface(page).locator('.history-activity[data-element-id="HistoryChild"]'); await child.getByRole('button').click();
    await child.getByRole('button', { name: `Child instance: ${fixture.historyChildId}`, exact: true }).click();
    await expect(surface(page).locator('.history-details .runtime-instance > code')).toHaveText(fixture.historyChildId);
    await surface(page).getByRole('button', { name: 'Back to instance', exact: true }).click();
    await expect(surface(page).locator('.history-details .runtime-instance > code')).toHaveText(fixture.historyInstanceId);
    await openHistory(page, fixture.terminatedInstanceId);
    await expect(surface(page).locator('.history-details .runtime-instance')).toContainText('Terminated');
    await expect(surface(page).locator('.history-details .runtime-instance')).toContainText('Fixture cancellation');
    await surface(page).locator('.instance-mode-tabs').getByRole('button', { name: 'Current state', exact: true }).click();
    await expect(surface(page).locator('.runtime-source-status')).toContainText('absent from runtime');
  } finally { await close(app, directory); }
});

test('история работающего multi-instance сохраняет отдельные записи и состояние монитора между вкладками и темами', async () => {
  const { app, page, directory } = await launch();
  try {
    await openInstance(page, fixture.parallelInstanceId);
    await surface(page).locator('.instance-mode-tabs').getByRole('button', { name: 'Execution history', exact: true }).click();
    await expect(surface(page).locator('.history-activity[data-element-id="ReviewMany"]')).toHaveCount(3);
    await expect(surface(page).locator('.runtime-badge[data-activity-id="ReviewMany"]')).toHaveText('● 3');
    for (const theme of ['Light theme', 'Dark theme']) {
      await page.getByTitle(theme, { exact: true }).click(); await page.setViewportSize({ width: 1050, height: 720 });
      for (const selector of ['.history-details', '.history-journal', '.runtime-catalog', '.instance-mode-tabs']) expect(await surface(page).locator(selector).evaluate(element => element.scrollWidth <= element.clientWidth + 1), selector).toBe(true);
      await page.screenshot({ path: `test-results/runtime-history-${theme.startsWith('Light') ? 'light' : 'dark'}.png` });
    }
    const tab = page.locator('.document-tab[data-kind=monitor]').getByRole('tab'); await page.locator('.new-tab').click(); await tab.click();
    await expect(surface(page).locator('.history-activity[data-element-id="ReviewMany"]')).toHaveCount(3);
    await surface(page).locator('.instance-mode-tabs').getByRole('button', { name: 'Current state', exact: true }).click();
    await expect(surface(page).locator('.runtime-badge[data-activity-id="ReviewMany"]')).toHaveText('● 3');
  } finally { await close(app, directory); }
});
