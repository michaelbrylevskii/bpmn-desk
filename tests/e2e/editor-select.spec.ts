import { test, expect } from '@playwright/test';

test('общий listbox поддерживает клавиатуру, команды модели и Escape внутри модального окна', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('select')).toHaveCount(0);
  const language = page.getByRole('combobox', { name: 'Language', exact: true });
  await language.focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('End'); await page.keyboard.press('Enter');
  await expect(page.getByRole('combobox', { name: 'Язык', exact: true })).toHaveAttribute('data-value', 'ru');
  await page.getByRole('button', { name: 'flowable-boundary-events', exact: true }).click();
  await page.getByLabel('Найти элемент').fill('reviewCall'); await page.locator('.outline-item').first().click();
  const compensation = page.getByRole('combobox', { name: 'isForCompensation', exact: true });
  await compensation.focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('End'); await page.keyboard.press('Enter');
  await expect(compensation).toHaveAttribute('data-value', 'false');
  await page.getByTitle('Отменить (Ctrl+Z)', { exact: true }).click(); await expect(compensation).toHaveAttribute('data-value', '');
  await compensation.focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await expect(compensation).toHaveAttribute('data-value', 'true');
  await page.getByTitle('Новая вкладка (Ctrl+N)', { exact: true }).click(); await page.keyboard.press('Escape');
  await expect(compensation).toHaveAttribute('data-value', 'true');
});
