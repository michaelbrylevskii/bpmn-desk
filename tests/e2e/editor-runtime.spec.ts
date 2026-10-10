import { test, expect } from './russian-fixture';

test('браузерное preview оставляет монитор недоступным и сохраняет черновик редактора', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'flowable-showcase', exact: true }).click();
  await page.getByLabel('Найти элемент').fill('prepareDocument'); await page.locator('.outline-item').first().click();
  await page.getByLabel('Название', { exact: true }).fill('Local draft'); await page.getByLabel('Название', { exact: true }).blur();
  await page.getByTitle('Новая вкладка (Ctrl+N)', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Открыть монитор', exact: true })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: 'Выбери подключение', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Название', { exact: true })).toHaveValue('Local draft');
  await page.getByTitle('Отменить (Ctrl+Z)', { exact: true }).click();
  await expect(page.getByLabel('Несохранённые изменения')).toHaveCount(0);
});
