import { test, expect } from '@playwright/test';

test('после перезапуска восстанавливаются все 21 изменённая вкладка', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  for (let index = 0; index < 21; index++) {
    await page.getByTitle('New diagram (Ctrl+N)', { exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Flowable', exact: true }).click();
    const workspace = page.locator('.document-workspace:visible');
    await workspace.locator('.outline-item').filter({ hasText: 'Process_1' }).click();
    await workspace.getByLabel('Name', { exact: true }).fill(`Recovered process ${index}`);
    await workspace.getByLabel('Name', { exact: true }).blur();
    await expect(page.locator('.document-tab.active .dirty-dot')).toBeVisible();
  }
  await page.reload();
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(page.locator('.document-tab')).toHaveCount(21);
  await expect(page.locator('.document-tab .dirty-dot')).toHaveCount(21);
  for (const index of [0, 20]) {
    await page.locator('.document-tab > button:first-child').nth(index).click();
    const workspace = page.locator('.document-workspace:visible');
    await expect(workspace.locator('.outline-item').filter({ hasText: `Recovered process ${index}` })).toBeVisible();
  }
});
