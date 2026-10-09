import { test, expect } from '@playwright/test';

test('системная тема меняется на ходу, ручной выбор фиксирует палитру и не теряет XML-черновик', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const root = page.locator('html');
  const auto = page.getByRole('button', { name: 'System theme', exact: true });
  await expect(auto).toHaveAttribute('aria-pressed', 'true');
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'flowable-showcase', exact: true }).click();
  await page.getByRole('button', { name: 'XML', exact: true }).click();
  const xml = page.getByLabel('Diagram XML', { exact: true });
  const original = await xml.textContent();
  await xml.focus(); await page.keyboard.press('Control+Home');
  await page.keyboard.insertText('<!-- theme draft -->\n');
  await page.keyboard.press('Control+f');
  const search = page.locator('.xml-panel input[name="search"]');
  await search.fill('prepareDocument');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(root).toHaveAttribute('data-theme', 'light');
  await expect(search).toHaveValue('prepareDocument');
  await expect(xml).toContainText('theme draft');
  expect(await page.evaluate(() => localStorage.getItem('bpmn-desk:theme'))).toBe('auto');
  await page.getByRole('button', { name: 'Dark theme', exact: true }).click();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.getByRole('button', { name: 'Dark theme', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await auto.click();
  await expect(root).toHaveAttribute('data-theme', 'light');
  await xml.focus(); await page.keyboard.press('Control+z');
  await expect(xml).toHaveText(original!);
  await expect(page.getByLabel('Unsaved changes')).toHaveCount(0);
  await page.reload();
  await expect(auto).toHaveAttribute('aria-pressed', 'true');
  await expect(root).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(root).toHaveAttribute('data-theme', 'dark');
});

for (const saved of ['light', 'dark'] as const) {
  test(`ранее сохранённая ${saved} тема сохраняет ручной выбор при обновлении приложения`, async ({ page }) => {
    const opposite = saved === 'light' ? 'dark' : 'light';
    await page.emulateMedia({ colorScheme: opposite });
    await page.addInitScript(value => { if (!localStorage.getItem('bpmn-desk:theme')) localStorage.setItem('bpmn-desk:theme', value); }, saved);
    await page.goto('/');
    const root = page.locator('html');
    await expect(root).toHaveAttribute('data-theme', saved);
    await expect(page.getByRole('button', { name: saved === 'light' ? 'Light theme' : 'Dark theme', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(root).toHaveAttribute('data-theme', saved);
    await page.getByRole('button', { name: 'System theme', exact: true }).click();
    await expect(root).toHaveAttribute('data-theme', opposite);
    await page.reload();
    await expect(page.getByRole('button', { name: 'System theme', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(root).toHaveAttribute('data-theme', opposite);
  });
}
