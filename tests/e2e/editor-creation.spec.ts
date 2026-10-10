import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { createDiagram } from './create-diagram';

test('главная и новые вкладки предлагают одинаковые действия, меню создания работает клавиатурой', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Offline', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open monitor', exact: true })).toBeDisabled();
  const create = page.getByRole('button', { name: 'Create diagram', exact: true });
  await create.focus(); await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'BPMN 2.0', exact: true })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(create).toBeFocused(); await expect(page.locator('.document-tab')).toHaveCount(0);
  await page.getByTitle('New tab (Ctrl+N)', { exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.locator('.document-tab[data-kind=home]')).toHaveCount(1);
  await createDiagram(page, 'Camunda 7'); await expect(page.locator('.engine-badge')).toHaveText('Camunda 7');
  await expect(page.locator('.document-tab')).toHaveCount(1);
  await page.keyboard.press('Control+n'); await createDiagram(page, 'Flowable');
  await expect(page.locator('.engine-badge')).toHaveText('Flowable');
  await page.locator('.new-tab').click(); await createDiagram(page, 'BPMN 2.0');
  await expect(page.locator('.engine-badge')).toHaveText('BPMN 2.0'); await expect(page.locator('.document-tab')).toHaveCount(3);
  await page.locator('.new-tab').click(); await page.getByTitle('Close New tab', { exact: true }).click();
  await expect(page.locator('.document-tab')).toHaveCount(3); await expect(page.locator('.engine-badge')).toHaveText('BPMN 2.0');
});

test('стартовая вкладка сохраняет черновик и доступна в небольшом окне, пример и drop заменяют её', async ({ page }) => {
  await page.goto('/'); await createDiagram(page, 'Flowable');
  await page.locator('.outline-item').filter({ hasText: 'Process_1' }).click();
  await page.locator('.document-workspace:visible').getByLabel('Name', { exact: true }).fill('Retained draft'); await page.locator('.document-workspace:visible').getByLabel('Name', { exact: true }).blur();
  await page.setViewportSize({ width: 1050, height: 680 });
  for (const theme of ['Light theme', 'Dark theme']) {
    await page.getByTitle(theme, { exact: true }).click(); await page.locator('.new-tab').click();
    const home = page.locator('.welcome');
    await expect(home.getByRole('heading', { name: 'Sample diagrams', exact: true })).toBeVisible();
    await expect(home.getByRole('heading', { name: 'Recent files', exact: true })).toBeVisible();
    await expect(home.getByRole('button', { name: 'Create diagram', exact: true })).toBeInViewport();
    expect(await home.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: `test-results/start-page-${theme.startsWith('Light') ? 'light' : 'dark'}.png` });
    if (theme.startsWith('Light')) await page.getByTitle('Close New tab', { exact: true }).click();
    else await home.getByRole('button', { name: 'flowable-vacation-request', exact: true }).click();
  }
  await expect(page.locator('.welcome')).toHaveCount(0); await expect(page.locator('.document-tab')).toHaveCount(2);
  await page.locator('.document-tab').first().getByRole('tab').click(); await expect(page.locator('.document-workspace:visible').getByLabel('Name', { exact: true })).toHaveValue('Retained draft');
  await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click(); await expect(page.getByLabel('Unsaved changes')).toHaveCount(0);
  await page.locator('.new-tab').click();
  const dataTransfer = await page.evaluateHandle(xml => { const data = new DataTransfer(); data.items.add(new File([xml], 'dropped.bpmn', { type: 'application/xml' })); return data; }, readFileSync('examples/camunda7-showcase.bpmn20.xml', 'utf8'));
  await page.locator('.welcome').dispatchEvent('drop', { dataTransfer }); await dataTransfer.dispose();
  await expect(page.locator('.welcome')).toHaveCount(0); await expect(page.locator('.document-tab')).toHaveCount(3);
  await expect(page.locator('.engine-badge')).toHaveText('Camunda 7');
});

test('Ctrl+N завершает редактирование поля и сохраняет undo при возврате со стартовой страницы', async ({ page }) => {
  await page.goto('/'); await createDiagram(page, 'Flowable');
  await page.locator('.outline-item').filter({ hasText: 'Process_1' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Pending field edit'); await page.keyboard.press('Control+n');
  await expect(page.locator('.welcome')).toBeVisible(); await page.getByTitle('Close New tab', { exact: true }).click();
  await page.getByRole('button', { name: 'XML', exact: true }).click(); await expect(page.getByLabel('Diagram XML', { exact: true })).toContainText('Pending field edit');
  await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click(); await expect(page.getByLabel('Unsaved changes')).toHaveCount(0);
});
