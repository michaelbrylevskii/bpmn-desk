import { test, expect } from '@playwright/test';

test('все способы создания предлагают профиль, Escape отменяет создание', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Offline', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'New diagram', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.document-tab')).toHaveCount(0);
  await page.getByTitle('New diagram (Ctrl+N)', { exact: true }).click();
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
