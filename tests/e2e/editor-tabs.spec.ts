import { test, expect } from './russian-fixture';
import { createDiagram } from './create-diagram';

test('перетаскивание и клавиатурная перестановка сохраняют активную вкладку, модель и undo', async ({ page }) => {
  await page.goto('/'); await createDiagram(page, 'Flowable');
  await page.locator('.outline-item').filter({ hasText: 'Process_1' }).click();
  await page.getByLabel('Название', { exact: true }).fill('Переставляемый процесс');
  await page.getByLabel('Название', { exact: true }).blur();
  await page.locator('.new-tab').click(); await createDiagram(page, 'BPMN 2.0');
  await page.locator('.new-tab').click();
  const tabs = page.getByRole('tab');
  const ids = await tabs.evaluateAll(elements => elements.map(element => element.getAttribute('data-tab-id')));
  const first = page.locator(`[data-tab-id="${ids[0]}"]`); const last = page.locator(`[data-tab-id="${ids[2]}"]`);
  const bounds = (await last.boundingBox())!;
  await first.dragTo(last, { targetPosition: { x: bounds.width - 5, y: bounds.height / 2 } });
  await expect(first).toHaveAttribute('draggable', 'true');
  expect(await tabs.evaluateAll(elements => elements.map(element => element.getAttribute('data-tab-id')))).toEqual([ids[1], ids[2], ids[0]]);
  await expect(last).toHaveAttribute('aria-selected', 'true'); await expect(page.locator('.welcome')).toBeVisible();
  await first.click(); await expect(page.getByLabel('Название', { exact: true }).filter({ visible: true })).toHaveValue('Переставляемый процесс');
  await first.focus(); await page.keyboard.press('Control+Shift+ArrowLeft');
  expect(await tabs.evaluateAll(elements => elements.map(element => element.getAttribute('data-tab-id')))).toEqual([ids[1], ids[0], ids[2]]);
  await expect(first).toBeFocused(); await expect(first).toHaveAttribute('aria-selected', 'true');
  await page.getByTitle('Отменить (Ctrl+Z)', { exact: true }).click();
  await expect(page.getByLabel('Название', { exact: true }).filter({ visible: true })).toHaveValue('Новый процесс');
  await first.click(); await page.keyboard.press('ArrowRight'); await expect(last).toBeFocused();
  await expect(page.locator('.welcome')).toBeVisible();
  await page.getByTitle('Закрыть Новая вкладка', { exact: true }).click();
  await expect(first).toHaveAttribute('aria-selected', 'true');
});
