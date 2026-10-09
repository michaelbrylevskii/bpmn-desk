import { test, expect } from './russian-fixture';

test('свойства отличают заданное false от значения по умолчанию', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'boundary-events', exact: true }).click();
  await page.getByRole('textbox', { name: 'Найти элемент' }).fill('Review document');
  await page.locator('.outline-item').filter({ hasText: 'reviewCall' }).click();
  await expect(page.locator('.property-legend, .field-status')).toHaveCount(0);
  const field = page.getByLabel('isForCompensation', { exact: true });
  await expect(field).toHaveValue('');
  await expect(field.locator('..')).toHaveAttribute('data-presence', 'default');
  await field.selectOption('false');
  await expect(field.locator('..')).toHaveAttribute('data-presence', 'explicit');
  await expect(field).toHaveValue('false');
  await page.getByTitle('Отменить (Ctrl+Z)', { exact: true }).click();
  await expect(field.locator('..')).toHaveAttribute('data-presence', 'default');
  expect(await page.getByLabel('Название', { exact: true }).locator('..').locator('span').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBe(11);
  const call = page.getByLabel('calledElement', { exact: true });
  await expect(call.locator('..')).toHaveAttribute('data-presence', 'explicit');
  await expect(page.getByLabel('Название', { exact: true }).locator('..')).toHaveAttribute('data-presence', 'explicit');
});
