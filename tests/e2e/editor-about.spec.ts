import { test, expect } from '@playwright/test';
import { selectOption } from './select';

test('logo opens application information in both themes and locales and restores keyboard focus', async ({ page }) => {
  await page.addInitScript(() => {
    window.application = {
      info: async () => ({ version: '1.2.3', electron: '44.7.0', chromium: '152.0.0.0', node: '26.0.0', platform: 'linux', arch: 'x64' }),
      openLink: async link => { document.documentElement.dataset.aboutLink = link; },
    };
  });
  await page.goto('/');
  for (const locale of ['en', 'ru']) {
    await page.getByRole('button', { name: locale === 'en' ? 'Light theme' : 'Dark theme', exact: true }).click();
    await selectOption(page.locator('.language-picker'), locale);
    const label = locale === 'en' ? 'About' : 'О приложении'; const logo = page.getByRole('button', { name: label, exact: true });
    await logo.click(); const dialog = page.getByRole('dialog', { name: label, exact: true });
    await expect(dialog).toBeVisible(); await expect(dialog).toContainText(locale === 'en' ? 'Version 1.2.3' : 'Версия 1.2.3');
    await expect(dialog).toContainText('OpenAI Codex'); await expect(dialog).toContainText('Linux · x64');
    await expect(dialog).toContainText('44.7.0'); await expect(dialog).toContainText('152.0.0.0'); await expect(dialog).toContainText('26.0.0');
    await dialog.getByRole('link', { name: 'Mikhail Brylevskii' }).click(); await expect(page.locator('html')).toHaveAttribute('data-about-link', 'author');
    await dialog.getByRole('link', { name: locale === 'en' ? 'Project on GitHub' : 'Проект на GitHub' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-about-link', 'repository');
    await dialog.screenshot({ path: `test-results/about-${locale}.png` });
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(logo).toBeFocused();
  }
});
