import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

test('все способы создания предлагают профиль, Escape отменяет создание', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Offline', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'New tab', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.document-tab')).toHaveCount(0);
  await page.getByTitle('New tab (Ctrl+N)', { exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Camunda 7', exact: true }).click();
  await expect(page.locator('.engine-badge')).toHaveText('Camunda 7');
  await page.keyboard.press('Control+n');
  await page.getByRole('dialog').getByRole('button', { name: 'Flowable', exact: true }).click();
  await expect(page.locator('.engine-badge')).toHaveText('Flowable');
  await page.locator('.new-tab').click();
  await page.getByRole('dialog').getByRole('button', { name: 'BPMN 2.0', exact: true }).click();
  await expect(page.locator('.engine-badge')).toHaveText('BPMN 2.0');
  await expect(page.locator('.document-tab')).toHaveCount(3);
});

test('примеры доступны из новой вкладки с открытым черновиком, диалог помещается в небольшое окно', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'New tab', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Flowable', exact: true }).click();
  await page.locator('.outline-item').filter({ hasText: 'Process_1' }).click();
  await page.locator('.document-workspace:visible').getByLabel('Name', { exact: true }).fill('Retained draft'); await page.locator('.document-workspace:visible').getByLabel('Name', { exact: true }).blur();
  await page.setViewportSize({ width: 1050, height: 680 });
  for (const theme of ['Light theme', 'Dark theme']) {
    await page.getByTitle(theme, { exact: true }).click(); await page.locator('.new-tab').click();
    const dialog = page.getByRole('dialog'); await expect(dialog.getByRole('heading', { name: 'Sample diagrams', exact: true })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Recent files', exact: true })).toBeVisible();
    await expect(dialog.getByTitle('Close', { exact: true })).toBeInViewport();
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: `test-results/new-tab-library-${theme.startsWith('Light') ? 'light' : 'dark'}.png` });
    if (theme.startsWith('Light')) await page.keyboard.press('Escape');
    else await dialog.getByRole('button', { name: 'flowable-vacation-request', exact: true }).click();
  }
  await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.locator('.document-tab')).toHaveCount(2);
  await page.locator('.document-tab').first().getByRole('tab').click(); await expect(page.locator('.document-workspace:visible').getByLabel('Name', { exact: true })).toHaveValue('Retained draft');
  await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click(); await expect(page.getByLabel('Unsaved changes')).toHaveCount(0);
  await page.locator('.new-tab').click();
  const dataTransfer = await page.evaluateHandle(xml => { const data = new DataTransfer(); data.items.add(new File([xml], 'dropped.bpmn', { type: 'application/xml' })); return data; }, readFileSync('examples/camunda7-showcase.bpmn20.xml', 'utf8'));
  await page.getByRole('dialog').dispatchEvent('drop', { dataTransfer }); await dataTransfer.dispose();
  await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.locator('.document-tab')).toHaveCount(3);
  await expect(page.locator('.engine-badge')).toHaveText('Camunda 7');
});
