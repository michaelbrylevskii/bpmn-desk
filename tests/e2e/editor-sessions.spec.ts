import { test, expect } from '@playwright/test';
import { createDiagram } from './create-diagram';

test('сессия сохраняет чистые вкладки, порядок и активную вкладку', async ({ page }) => {
  await page.goto('/'); await createDiagram(page, 'Flowable');
  await page.locator('.new-tab').click(); await createDiagram(page, 'Camunda 7');
  await page.locator('.document-tab').first().getByRole('tab').click();
  await page.reload(); await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(page.locator('.document-tab')).toHaveCount(2);
  await expect(page.locator('.engine-badge')).toHaveText('Flowable');
  await expect(page.locator('.dirty-dot')).toHaveCount(0);
  await page.locator('.document-tab').nth(1).getByRole('tab').click(); await expect(page.locator('.engine-badge')).toHaveText('Camunda 7');
});

test('скрытие предложения переживает запуск, запись остаётся и восстановление снова разрешает предложение', async ({ page }) => {
  await page.goto('/'); await createDiagram(page, 'Flowable'); await page.reload();
  await page.getByRole('button', { name: 'Dismiss restoration offer' }).click(); await page.reload();
  await expect(page.locator('.recovery-banner')).toHaveCount(0);
  const sessions = page.getByRole('region', { name: 'Recent sessions', exact: true });
  await expect(sessions.locator('.recent-entry')).toHaveCount(1);
  await sessions.getByRole('button').first().click(); await expect(page.locator('.engine-badge')).toHaveText('Flowable');
  await page.reload(); await expect(page.locator('.recovery-banner')).toBeVisible();
  await expect(sessions.locator('.recent-entry')).toHaveCount(1);
});

test('игнорирование сессии сохраняет её рядом с новой; восстановление открывает отдельное окно', async ({ page, context }) => {
  await page.goto('/'); await createDiagram(page, 'Flowable'); await page.reload();
  await page.getByRole('button', { name: 'Dismiss restoration offer' }).click(); await createDiagram(page, 'Camunda 7');
  await page.reload(); const sessions = page.getByRole('region', { name: 'Recent sessions', exact: true });
  await expect(sessions.locator('.recent-entry')).toHaveCount(2);
  await page.getByRole('button', { name: 'Restore', exact: true }).click(); await page.locator('.new-tab').click();
  const opened = context.waitForEvent('page'); await sessions.getByRole('button').first().click();
  const restored = await opened;
  await expect(restored.locator('.engine-badge')).toHaveText('Flowable');
  await expect(page.locator('.document-tab[data-kind=document]')).toHaveCount(1);
  await page.locator('.document-tab[data-kind=document]').getByRole('tab').click(); await expect(page.locator('.engine-badge')).toHaveText('Camunda 7');
  await restored.close();
});

test('меню вкладки дублирует неприменённый XML и массовое закрытие подтверждается один раз', async ({ page }) => {
  await page.goto('/'); await createDiagram(page, 'Flowable');
  await page.getByRole('button', { name: 'XML', exact: true }).click(); await page.getByLabel('Diagram XML', { exact: true }).fill('<unfinished');
  await page.locator('.document-tab').click({ button: 'right' }); await page.getByRole('menuitem', { name: 'Duplicate diagram', exact: true }).click();
  await expect(page.locator('.document-tab')).toHaveCount(2);
  await page.getByRole('button', { name: 'XML', exact: true }).click(); await expect(page.locator('.document-workspace:visible').getByLabel('Diagram XML', { exact: true })).toContainText('<unfinished');
  await page.reload(); await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await page.getByRole('button', { name: 'XML', exact: true }).click(); await expect(page.locator('.document-workspace:visible').getByLabel('Diagram XML', { exact: true })).toContainText('<unfinished');
  let dialogs = 0; page.on('dialog', async dialog => { dialogs++; await dialog.accept(); });
  await page.locator('.document-tab').last().click({ button: 'right' }); await page.getByRole('menuitem', { name: 'Close all tabs', exact: true }).click();
  await expect(page.locator('.document-tab')).toHaveCount(0); expect(dialogs).toBe(1);
  await page.reload(); await expect(page.locator('.recovery-banner')).toHaveCount(0);
});

test('удаление сессии удаляет снимок, а список ограничен 15 записями', async ({ page }) => {
  await page.goto('/'); await createDiagram(page, 'Flowable'); await page.reload();
  await expect(page.getByRole('region', { name: 'Recent sessions', exact: true }).locator('.recent-entry')).toHaveCount(1);
  await page.getByRole('button', { name: 'Delete session' }).click(); await page.reload();
  await expect(page.locator('.recent-entry')).toHaveCount(0);
  const snapshot = { id: 'test', updatedAt: new Date().toISOString(), dismissed: false, tabs: [{ kind: 'monitor', id: 'monitor', connectionId: 'missing' }], activeId: 'monitor', documents: [] };
  await page.evaluate(record => localStorage.setItem('bpmn-desk:sessions:v1', JSON.stringify(Array.from({ length: 15 }, (_, index) => ({ ...record, id: `old-${index}` })))), snapshot);
  await page.reload(); await createDiagram(page, 'Flowable'); await page.reload();
  await expect(page.getByRole('region', { name: 'Recent sessions', exact: true }).locator('.recent-entry')).toHaveCount(15);
});

test('черновики прежнего формата переносятся в сессию вместе с неприменённым XML', async ({ page }) => {
  const { emptyDiagram } = await import('../../src/renderer/bpmn/template');
  await page.goto('/'); await page.evaluate(xml => localStorage.setItem('bpmn-desk:recovery:v1', JSON.stringify([{ name: 'Legacy.bpmn', xml, savedXml: '', draft: '<unfinished' }])), emptyDiagram);
  await page.reload(); await expect(page.getByRole('region', { name: 'Recent sessions', exact: true }).locator('.recent-entry')).toHaveCount(1);
  await page.getByRole('button', { name: 'Restore', exact: true }).click(); await expect(page.locator('.document-tab')).toContainText('Legacy.bpmn');
  await page.getByRole('button', { name: 'XML', exact: true }).click(); await expect(page.getByLabel('Diagram XML', { exact: true })).toContainText('<unfinished');
  expect(await page.evaluate(() => localStorage.getItem('bpmn-desk:recovery:v1'))).toBeNull();
});

test('удаление сессии с изменениями подтверждается и сохраняется между запусками', async ({ page }) => {
  await page.goto('/'); await createDiagram(page, 'Flowable');
  await page.locator('.outline-item').filter({ hasText: 'Process_1' }).click(); await page.getByLabel('Name', { exact: true }).fill('Unsaved'); await page.getByLabel('Name', { exact: true }).blur();
  await page.reload(); page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('button', { name: 'Delete session', exact: true }).click();
  await expect(page.locator('.recent-entry')).toHaveCount(1);
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Delete session', exact: true }).click();
  await page.reload(); await expect(page.locator('.recent-entry')).toHaveCount(0);
});

test('после восстановления сохраняются выбор, масштаб и разрешённые изменения расширений', async ({ page }) => {
  const { emptyDiagram } = await import('../../src/renderer/bpmn/template'); const { readFile } = await import('node:fs/promises');
  const xml = emptyDiagram.replace('<bpmn:process ', '<bpmn:process xmlns:custom="urn:custom" custom:mode="before" ');
  await page.goto('/'); const chooser = page.waitForEvent('filechooser'); await page.getByRole('button', { name: 'Open diagram', exact: true }).click();
  await (await chooser).setFiles({ name: 'custom.bpmn', mimeType: 'application/xml', buffer: Buffer.from(xml) });
  await page.locator('.outline-item').filter({ hasText: 'Process_1' }).click(); await page.getByText('Custom attributes', { exact: true }).click();
  await page.getByLabel('custom:mode', { exact: true }).fill('after'); await page.getByLabel('custom:mode', { exact: true }).blur();
  await page.locator('.zoom-controls button').last().click();
  const transform = await page.locator('.viewport').evaluate(element => { const matrix = (element as SVGGElement).transform.baseVal.consolidate()!.matrix; return [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f]; });
  await page.reload(); await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect.poll(async () => {
    const actual = await page.locator('.viewport').evaluate(element => { const matrix = (element as SVGGElement).transform.baseVal.consolidate()!.matrix; return [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f]; });
    return Math.max(...actual.map((value, index) => Math.abs(value - transform[index]!)));
  }).toBeLessThan(0.001);
  await page.getByText('Custom attributes', { exact: true }).click(); await expect(page.getByLabel('custom:mode', { exact: true })).toHaveValue('after');
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect(await readFile((await (await download).path())!, 'utf8')).toContain('custom:mode="after"');
});
