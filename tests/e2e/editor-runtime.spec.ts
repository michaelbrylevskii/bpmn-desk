import { test, expect } from './russian-fixture';

test('переключение монитора не теряет черновик, XML и undo локального документа', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'flowable-showcase', exact: true }).click();
  await page.getByLabel('Найти элемент').fill('prepareDocument'); await page.locator('.outline-item').first().click();
  await page.getByLabel('Название', { exact: true }).fill('Local draft'); await page.getByLabel('Название', { exact: true }).blur();
  await page.getByRole('button', { name: 'Состояние процессов', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Подключения к движкам доступны в desktop-приложении.');
  await expect(page.getByRole('button', { name: 'Новое подключение', exact: true })).toBeDisabled();
  await page.keyboard.press('Control+s'); await expect(page.locator('.runtime-workspace')).toBeVisible();
  await page.getByRole('button', { name: 'Состояние процессов', exact: true }).click();
  await expect(page.getByLabel('Название', { exact: true })).toHaveValue('Local draft');
  await page.getByTitle('Отменить (Ctrl+Z)', { exact: true }).click();
  await expect(page.getByLabel('Несохранённые изменения')).toHaveCount(0);
});
