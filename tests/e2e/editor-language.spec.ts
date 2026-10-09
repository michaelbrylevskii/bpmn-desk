import { test, expect } from '@playwright/test';

test('английский по умолчанию, смена языка сохраняет модель, поиск и XML undo', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'New diagram', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Language', exact: true })).toHaveValue('en');
  await page.getByRole('button', { name: 'New diagram', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Flowable', exact: true }).click();
  await page.locator('.outline-item').filter({ hasText: 'Process_1' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Название пользователя');
  await page.getByLabel('Name', { exact: true }).blur();
  await page.getByRole('button', { name: 'XML', exact: true }).click();
  const baseline = await page.getByLabel('Diagram XML', { exact: true }).textContent();
  await page.getByLabel('Diagram XML', { exact: true }).focus();
  await page.keyboard.press('Control+Home');
  await page.keyboard.insertText('<!-- untouched draft -->\n');
  await page.keyboard.press('Control+f');
  const search = page.locator('.xml-panel .xml-search-input[name="search"]');
  await search.fill('StartEvent_1');
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('ru');
  await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeVisible();
  await expect(page.getByLabel('Название', { exact: true })).toHaveValue('Название пользователя');
  await expect(search).toHaveValue('StartEvent_1');
  await expect(search).toHaveAttribute('aria-label', 'Найти');
  await expect(page.getByRole('button', { name: 'Создать задачу', exact: true })).toBeVisible();
  await expect(page.getByLabel('XML схемы')).toContainText('untouched draft');
  await page.getByLabel('XML схемы').focus();
  await page.keyboard.press('Control+z');
  await expect(page.getByLabel('XML схемы')).not.toContainText('untouched draft');
  await page.getByLabel('XML схемы').focus();
  await page.keyboard.press('Control+Home');
  await page.keyboard.insertText('<!-- second draft -->\n');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  const toast = page.getByRole('status');
  // XML остаётся черновиком до явного применения/отмены.
  await expect(toast).toContainText('Примени или отмени изменения XML');
  await page.getByRole('combobox', { name: 'Язык', exact: true }).selectOption('en');
  await expect(toast).toContainText('Apply or discard XML edits');
  await expect(page.getByRole('button', { name: 'Create task', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Discard XML edits', exact: true }).click();
  await expect(page.getByLabel('Diagram XML', { exact: true })).toHaveText(baseline!);
  await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('New process');
  await expect(page.getByLabel('Unsaved changes', { exact: true })).toHaveCount(0);
});

test('выбранный русский язык восстанавливается после обновления', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('ru');
  await expect(page.getByRole('button', { name: 'Новая схема', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Язык', exact: true })).toHaveValue('ru');
  await expect(page.getByRole('button', { name: 'Новая схема', exact: true })).toBeVisible();
});

test('смена языка сохраняет действия выбранного элемента и контролы поиска', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New diagram', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Flowable', exact: true }).click();
  await page.locator('.outline-item').filter({ hasText: 'StartEvent_1' }).click();
  const entries = page.locator('.djs-context-pad .entry');
  const initial = await entries.count(); expect(initial).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'XML', exact: true }).click();
  await page.getByLabel('Diagram XML').focus(); await page.keyboard.press('Control+f');
  await page.locator('.xml-panel input[name="search"]').fill('Start');
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('ru');
  await expect(entries).toHaveCount(initial);
  const panel = page.locator('.xml-panel');
  await expect(panel.getByRole('button', { name: 'Следующее совпадение', exact: true })).toBeInViewport();
  await expect(panel.getByRole('button', { name: 'Учитывать регистр', exact: true })).toBeVisible();
  await expect(panel.locator('.xml-search-count')).toHaveText('0/5');
  await expect(page.getByLabel('Несохранённые изменения', { exact: true })).toHaveCount(0);
});
